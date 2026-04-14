const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");
const { DEFAULT_RUNTIME_ACCOUNT_ID, DEFAULT_RUNTIME_PROFILE_ID } = require("../config/env");

/**
 * Build the runtime context block injected at the start of each call session.
 * All fields are always present — missing data gets a sensible default.
 */
async function buildRuntimeContext(callCtx) {
  const { traceId, accountId, profileId, activeModeId, callerNumber } = callCtx;

  // --- Temporary fallback when account/profile not yet resolved ---
  const resolvedAccountId = accountId || DEFAULT_RUNTIME_ACCOUNT_ID;
  const resolvedProfileId = profileId || DEFAULT_RUNTIME_PROFILE_ID;
  const usingFallback = !accountId;

  if (usingFallback) {
    log.call("runtime_context_fallback_account_used", traceId,
      `accountId missing — using fallback account=${resolvedAccountId} profile=${resolvedProfileId}`);
  }

  let userName = "Unknown";
  let userPreferences = "No specific preferences configured.";
  let activeMode = "standard";
  let assistantControlMode = "strict_policy";
  let activeModeCapabilities = "Booking: use caller-group policy.";
  let activeModeAllowBooking = null;
  let callerGroupRules = "No specific caller group rules configured.";
  let smartScenarios = "No smart scenarios active.";
  
  let callerContext = "No prior caller context available.";
  let currentTimezone = "Europe/Paris";

  try {
    // 1. Resolve user name from profile via account_members (owner/admin)
    const { data: member, error: memberErr } = await supabaseAdmin
      .from("account_members")
      .select("profile_id, profiles!account_members_profile_id_fkey(display_name, first_name, last_name)")
      .eq("account_id", resolvedAccountId)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    if (memberErr) {
      log.call("runtime_context_member_lookup_error", traceId, memberErr.message);
    }

    if (member?.profiles) {
      const p = member.profiles;
      userName = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
    } else {
      // Fallback: direct profile lookup via member.profile_id or resolvedProfileId
      const fallbackProfileId = member?.profile_id || resolvedProfileId;
      if (fallbackProfileId) {
        const { data: profile } = await supabaseAdmin
          .from("profiles")
          .select("display_name, first_name, last_name")
          .eq("id", fallbackProfileId)
          .maybeSingle();
        if (profile) {
          userName = profile.display_name || [profile.first_name, profile.last_name].filter(Boolean).join(" ") || "Unknown";
          log.call("runtime_context_name_resolved_via_profile", traceId, `profileId=${fallbackProfileId}, name=${userName}`);
        }
      }
    }

    // 2. Resolve timezone from account
    const { data: account } = await supabaseAdmin
      .from("accounts")
      .select("timezone")
      .eq("id", resolvedAccountId)
      .maybeSingle();

    if (account?.timezone) {
      currentTimezone = account.timezone;
    }

    // 3. Resolve active mode
    const resolvedModeId = activeModeId;
    if (!resolvedModeId) {
      log.call("runtime_context_active_mode_missing_input", traceId,
        `activeModeId not provided — defaulting to "standard"`);
    } else {
      log.call("runtime_context_active_mode_lookup_started", traceId,
        `modeId=${resolvedModeId}, accountId=${resolvedAccountId}`);
      const { data: mode, error: modeErr } = await supabaseAdmin
        .from("assistant_modes")
        .select("name, description, urgency_sensitivity, control_mode, allow_booking")
        .eq("id", resolvedModeId)
        .eq("account_id", resolvedAccountId)
        .maybeSingle();

      if (modeErr) {
        log.call("runtime_context_active_mode_error", traceId, modeErr.message);
      } else if (!mode) {
        log.call("runtime_context_active_mode_not_found", traceId,
          `no row matched modeId=${resolvedModeId} + accountId=${resolvedAccountId}`);
      } else {
        activeMode = `${mode.name}${mode.description ? " — " + mode.description : ""} (urgency sensitivity: ${mode.urgency_sensitivity})`;
        assistantControlMode = mode.control_mode || "strict_policy";
        activeModeAllowBooking = mode.allow_booking === true;
        activeModeCapabilities = activeModeAllowBooking
          ? "Booking: allowed for all caller groups in this active mode."
          : "Booking: use caller-group policy only.";

        // Store control_mode on callCtx for downstream guardrails
        callCtx.controlMode = assistantControlMode;

        log.call("runtime_context_active_mode_resolved", traceId,
          `modeId=${resolvedModeId}, name=${mode.name}, control_mode=${assistantControlMode}, allow_booking=${activeModeAllowBooking}`);
      }
    }

    // 4. Resolve caller group rules
    log.call("runtime_context_group_rules_lookup_started", traceId,
      `accountId=${resolvedAccountId}`);
    let rulesQuery = supabaseAdmin
      .from("call_handling_rules")
      .select(`
        priority_rank,
        behavior,
        caller_groups(name, slug, priority_rank)
      `)
      .eq("account_id", resolvedAccountId);

    if (resolvedModeId) {
      rulesQuery = rulesQuery.eq("assistant_mode_id", resolvedModeId);
    }

    const { data: rules, error: rulesErr } = await rulesQuery
      .order("priority_rank", { ascending: true })
      .limit(20);

    if (rulesErr) {
      log.call("runtime_context_group_rules_error", traceId, rulesErr.message);
    } else if (!rules || rules.length === 0) {
      log.call("runtime_context_group_rules_none_found", traceId,
        `0 rows for accountId=${resolvedAccountId}`);
    } else {
      let incompleteCount = 0;
      callerGroupRules = rules.map((r) => {
        if (!r.caller_groups || !r.caller_groups.name) {
          incompleteCount++;
          log.call("runtime_context_group_rules_incomplete_row", traceId,
            `rule priority_rank=${r.priority_rank} has missing/null caller_groups join`);
        }
        const gName = r.caller_groups?.name || "unknown group";

        // Map behavior to directive
        const behaviorDirective = {
          take_message: "take a message and end the call",
          transfer: "transfer the call to the user",
          ask_user: "consult the user in real-time before deciding (use consult_user tool)",
          book_appointment: "offer to book an appointment",
          block: "politely decline and end the call",
        }[r.behavior] || `behavior=${r.behavior}`;

        return `Group "${gName}": ${behaviorDirective}`;
      }).join("\n");
      log.call("runtime_context_group_rules_resolved", traceId,
        `count=${rules.length}, incomplete=${incompleteCount}`);
    }

    // 5. Resolve caller context if phone number is known
    if (!callerNumber || callerNumber === "unknown") {
      log.call("runtime_context_caller_context_missing_input", traceId,
        `callerNumber=${callerNumber || "undefined"} — skipping contact lookup`);
    } else {
      const isE164 = /^\+\d{7,15}$/.test(callerNumber);
      log.call("runtime_context_caller_context_lookup_started", traceId,
        `callerNumber=${callerNumber}, e164=${isE164}, accountId=${resolvedAccountId}`);

      const { data: contact, error: contactErr } = await supabaseAdmin
        .from("contacts")
        .select("id, display_name, first_name, last_name, is_blocked, is_favorite, company_name, notes, custom_instructions")
        .eq("account_id", resolvedAccountId)
        .or(`primary_phone_e164.eq.${callerNumber},secondary_phone_e164.eq.${callerNumber}`)
        .maybeSingle();

      if (contactErr) {
        log.call("runtime_context_caller_context_error", traceId, contactErr.message);
      } else if (!contact) {
        callerContext = `Unknown caller — phone: ${callerNumber}`;
        log.call("runtime_context_caller_context_not_found", traceId,
          `no contact matched callerNumber=${callerNumber} in accountId=${resolvedAccountId}`);
      } else {
        const name = contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
        const parts = [`Known contact: ${name}`, `Phone: ${callerNumber}`];
        if (contact.company_name) parts.push(`Company: ${contact.company_name}`);
        if (contact.is_favorite) parts.push("★ Favorite");
        if (contact.is_blocked) parts.push("⛔ Blocked");
        if (contact.notes) parts.push(`Notes: ${contact.notes}`);
        if (contact.custom_instructions) parts.push(`Custom instructions for this contact: ${contact.custom_instructions}`);

        // Resolve caller's group membership
        const { data: memberships } = await supabaseAdmin
          .from("contact_group_memberships")
          .select("caller_group_id, caller_groups(name, priority_rank, custom_instructions)")
          .eq("contact_id", contact.id)
          .eq("account_id", resolvedAccountId);

        if (memberships && memberships.length > 0) {
          const groupNames = memberships
            .filter(m => m.caller_groups?.name)
            .map(m => m.caller_groups.name);
          if (groupNames.length > 0) {
            parts.push(`Groups: ${groupNames.join(", ")}`);
          }

          // Collect group-level custom instructions
          const groupInstructions = memberships
            .filter(m => m.caller_groups?.custom_instructions)
            .map(m => `[${m.caller_groups.name}] ${m.caller_groups.custom_instructions}`);
          if (groupInstructions.length > 0) {
            parts.push(`Group instructions: ${groupInstructions.join(" | ")}`);
          }

          // Resolve priority from highest-ranked group
          const sorted = memberships
            .filter(m => m.caller_groups?.priority_rank != null)
            .sort((a, b) => b.caller_groups.priority_rank - a.caller_groups.priority_rank);
          if (sorted.length > 0) {
            const rank = sorted[0].caller_groups.priority_rank;
            let priority = "normal";
            if (rank >= 90) priority = "urgent";
            else if (rank >= 70) priority = "high";
            else if (rank >= 30) priority = "normal";
            else priority = "low";
            parts.push(`Priority: ${priority}`);
          }
        } else {
          parts.push("Groups: none (treat as Inconnus)");
        }

        callerContext = parts.join(" | ");
        log.call("runtime_context_caller_context_resolved", traceId,
          `contactId=${contact.id}, name=${name}`);
      }
    }
  } catch (e) {
    log.error("runtime_context_build_error", traceId, e.message);
  }

  const instructionText = assistantControlMode === "full_autonomy"
    ? `Instruction:
You are in FULL AUTONOMY mode. You have complete freedom to decide how to handle this call. Use get_caller_profile to identify the caller and adapt your approach. All tools are available — use your best judgment. Custom instructions (contact-level and group-level) listed above MUST still be respected. Caller group rules are provided for reference only — you may follow or override them as you see fit.`
    : `Instruction:
Apply this context using the assistant control mode. For appointments, active mode booking permission takes precedence: if the active mode says booking is allowed, you may check availability and book; otherwise follow the caller-group booking rule. For everything else, follow the caller-group policies unless the runtime context explicitly says otherwise.`;

  const contextBlock = `RUNTIME CONTEXT
User name: ${userName}
User preferences:
${userPreferences}
Active mode:
${activeMode}
Assistant control mode:
${assistantControlMode}
Active mode capabilities:
${activeModeCapabilities}
Caller group rules:
${callerGroupRules}
Smart scenarios:
${smartScenarios}
Known caller context:
${callerContext}
Current timezone:
${currentTimezone}

${instructionText}`;

  log.call("runtime_context_built", traceId, `user=${userName}, mode=${activeMode}, controlMode=${assistantControlMode}, tz=${currentTimezone}, fallback=${usingFallback}`);
  return contextBlock;
}

module.exports = { buildRuntimeContext };
