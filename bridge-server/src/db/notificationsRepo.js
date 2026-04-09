const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

const PRIORITY_MAP = {
  low: "low",
  normal: "normal",
  high: "high",
  urgent: "critical",
};

/**
 * Create push notifications for all account admins/owners
 * after a callback request is successfully created.
 */
async function createFromCallback(callbackRow, callCtx) {
  const accountId = callCtx.accountId;
  if (!accountId) {
    log.error("notification_failed", callCtx.traceId, "no accountId");
    return;
  }

  try {
    // 1. Resolve target profiles (owners + admins)
    const { data: members, error: mErr } = await supabaseAdmin
      .from("account_members")
      .select("profile_id")
      .eq("account_id", accountId)
      .in("role", ["owner", "admin"]);

    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      log.error("notification_failed", callCtx.traceId, "no admin/owner found");
      return;
    }

    // 2. Build notification content
    const callerLabel = callbackRow.caller_name || "Un appelant";
    const body = callbackRow.preferred_time_note
      ? `${callerLabel} souhaite être rappelé ${callbackRow.preferred_time_note}`
      : `${callerLabel} souhaite être rappelé`;

    const priority = PRIORITY_MAP[callbackRow.priority] || "normal";

    // 3. Insert one notification per admin/owner
    const rows = members.map((m) => ({
      account_id: accountId,
      profile_id: m.profile_id,
      call_session_id: callbackRow.call_session_id || null,
      channel: "push",
      priority,
      title: "Demande de rappel",
      body,
      status: "pending",
    }));

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(rows)
      .select("id, profile_id");

    if (error) throw error;

    for (const n of data) {
      log.call("notification_created", callCtx.traceId, `id=${n.id} profile=${n.profile_id} cb=${callbackRow.id}`);
    }
  } catch (e) {
    log.error("notification_failed", callCtx.traceId, e.message);
  }
}

module.exports = { createFromCallback };
