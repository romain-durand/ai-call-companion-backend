const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

const EMPTY_PROFILE = {
  success: true,
  known_contact: false,
  contact_id: null,
  caller_name: null,
  caller_group: null,
  priority: "normal",
  is_blocked: false,
  is_favorite: false,
};

/**
 * Look up a caller's profile by phone number within an account.
 * Always returns a structured profile with success=true.
 */
async function getCallerProfile(accountId, phoneE164, traceId) {
  if (!accountId || !phoneE164) {
    log.tool("caller_profile_unknown", traceId, "skip — missing accountId or phone");
    return { ...EMPTY_PROFILE, message: "No phone number provided." };
  }

  try {
    const { data: contact, error: cErr } = await supabaseAdmin
      .from("contacts")
      .select("id, display_name, is_blocked, is_favorite")
      .eq("account_id", accountId)
      .or(`primary_phone_e164.eq.${phoneE164},secondary_phone_e164.eq.${phoneE164}`)
      .limit(1)
      .maybeSingle();

    if (cErr) throw cErr;

    if (!contact) {
      log.tool("caller_profile_unknown", traceId, `phone=${phoneE164}`);
      return { ...EMPTY_PROFILE, message: "Caller not found in contacts." };
    }

    // Resolve group memberships
    const { data: memberships, error: mErr } = await supabaseAdmin
      .from("contact_group_memberships")
      .select("caller_group_id")
      .eq("contact_id", contact.id)
      .eq("account_id", accountId);

    if (mErr) throw mErr;

    let callerGroup = null;
    let priority = "normal";

    if (memberships && memberships.length > 0) {
      const groupIds = memberships.map((m) => m.caller_group_id);
      const { data: groups, error: gErr } = await supabaseAdmin
        .from("caller_groups")
        .select("name, priority_rank")
        .in("id", groupIds)
        .order("priority_rank", { ascending: false })
        .limit(1);

      if (!gErr && groups && groups.length > 0) {
        callerGroup = groups[0].name;
        const rank = groups[0].priority_rank;
        if (rank >= 90) priority = "urgent";
        else if (rank >= 70) priority = "high";
        else if (rank >= 30) priority = "normal";
        else priority = "low";
      }
    }

    log.tool("caller_profile_found", traceId,
      `contact=${contact.id} name="${contact.display_name}" group="${callerGroup}" priority=${priority}`);

    return {
      success: true,
      known_contact: true,
      contact_id: contact.id,
      caller_name: contact.display_name,
      caller_group: callerGroup,
      priority,
      is_blocked: contact.is_blocked,
      is_favorite: contact.is_favorite,
      message: "Caller profile resolved.",
    };
  } catch (e) {
    log.error("caller_profile_lookup_failed", traceId, e.message);
    return { ...EMPTY_PROFILE, message: `Lookup failed: ${e.message}` };
  }
}

module.exports = { getCallerProfile };
