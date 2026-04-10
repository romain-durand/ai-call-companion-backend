const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");

/**
 * Build the runtime context block injected at the start of each call session.
 * All fields are always present — missing data gets a sensible default.
 */
async function buildRuntimeContext(callCtx) {
  const { traceId, accountId, activeModeId, callerNumber } = callCtx;

  let userName = "Unknown";
  let userPreferences = "No specific preferences configured.";
  let activeMode = "standard";
  let callerGroupRules = "No specific caller group rules configured.";
  let smartScenarios = "No smart scenarios active.";
  let escalationRules = "Default: escalate only for high-priority or urgent callers.";
  let callerContext = "No prior caller context available.";
  let currentTimezone = "Europe/Paris";

  try {
    // 1. Resolve user name from profile via account_members (owner/admin)
    if (accountId) {
      const { data: member } = await supabaseAdmin
        .from("account_members")
        .select("profile_id, profiles(display_name, first_name, last_name)")
        .eq("account_id", accountId)
        .in("role", ["owner", "admin"])
        .limit(1)
        .maybeSingle();

      if (member?.profiles) {
        const p = member.profiles;
        userName = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
      }

      // 2. Resolve timezone from account
      const { data: account } = await supabaseAdmin
        .from("accounts")
        .select("timezone")
        .eq("id", accountId)
        .maybeSingle();

      if (account?.timezone) {
        currentTimezone = account.timezone;
      }
    }

    // 3. Resolve active mode
    if (activeModeId && accountId) {
      const { data: mode } = await supabaseAdmin
        .from("assistant_modes")
        .select("name, description, urgency_sensitivity")
        .eq("id", activeModeId)
        .eq("account_id", accountId)
        .maybeSingle();

      if (mode) {
        activeMode = `${mode.name}${mode.description ? " — " + mode.description : ""} (urgency sensitivity: ${mode.urgency_sensitivity})`;
      }
    }

    // 4. Resolve caller group rules
    if (accountId) {
      const { data: rules } = await supabaseAdmin
        .from("call_handling_rules")
        .select(`
          priority_rank,
          behavior,
          escalation_allowed,
          force_escalation,
          callback_allowed,
          booking_allowed,
          caller_groups(name, slug, priority_rank)
        `)
        .eq("account_id", accountId)
        .order("priority_rank", { ascending: true })
        .limit(20);

      if (rules && rules.length > 0) {
        callerGroupRules = rules.map((r) => {
          const gName = r.caller_groups?.name || "unknown group";
          const parts = [`Group "${gName}": behavior=${r.behavior}`];
          if (r.force_escalation) parts.push("FORCE_ESCALATE");
          if (r.escalation_allowed) parts.push("escalation_allowed");
          if (r.callback_allowed) parts.push("callback_allowed");
          if (r.booking_allowed) parts.push("booking_allowed");
          return parts.join(", ");
        }).join("\n");
      }
    }

    // 5. Resolve caller context if phone number is known
    if (callerNumber && callerNumber !== "unknown" && accountId) {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("display_name, first_name, last_name, is_blocked, is_favorite, company_name, notes")
        .eq("account_id", accountId)
        .or(`primary_phone_e164.eq.${callerNumber},secondary_phone_e164.eq.${callerNumber}`)
        .maybeSingle();

      if (contact) {
        const name = contact.display_name || [contact.first_name, contact.last_name].filter(Boolean).join(" ") || "Unknown";
        const parts = [`Known contact: ${name}`];
        if (contact.company_name) parts.push(`Company: ${contact.company_name}`);
        if (contact.is_favorite) parts.push("★ Favorite");
        if (contact.is_blocked) parts.push("⛔ Blocked");
        if (contact.notes) parts.push(`Notes: ${contact.notes}`);
        callerContext = parts.join(" | ");
      }
    }
  } catch (e) {
    log.error("runtime_context_build_error", traceId, e.message);
    // Continue with defaults — context is best-effort
  }

  const contextBlock = `RUNTIME CONTEXT
User name: ${userName}
User preferences:
${userPreferences}
Active mode:
${activeMode}
Caller group rules:
${callerGroupRules}
Smart scenarios:
${smartScenarios}
Escalation rules:
${escalationRules}
Known caller context:
${callerContext}
Current timezone:
${currentTimezone}

Instruction:
Apply this context strictly, but remain natural, brief, and efficient on the phone.`;

  log.call("runtime_context_built", traceId, `user=${userName}, mode=${activeMode}, tz=${currentTimezone}`);
  return contextBlock;
}

module.exports = { buildRuntimeContext };
