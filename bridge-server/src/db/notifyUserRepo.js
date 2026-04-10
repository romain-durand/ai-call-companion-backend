const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Create a notification for all account admins/owners from a direct notify_user tool call.
 * Returns the first notification id or null.
 */
async function createDirectNotification(callCtx, args) {
  const accountId = callCtx.accountId;
  if (!accountId) {
    log.error("notify_user_failed", callCtx.traceId, "no accountId");
    return null;
  }

  try {
    // 1. Resolve recipients
    const { data: members, error: mErr } = await supabaseAdmin
      .from("account_members")
      .select("profile_id")
      .eq("account_id", accountId)
      .in("role", ["owner", "admin"]);

    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      log.error("notify_user_failed", callCtx.traceId, "no admin/owner found");
      return null;
    }

    // 2. Build notification content
    const callerLabel = args.caller_name || callCtx.callerNameRaw || "Un appelant";
    const body = args.summary || `Message de ${callerLabel}`;
    const priority = args.priority || "normal";

    // 3. Insert one notification per recipient
    const rows = members.map((m) => ({
      account_id: accountId,
      profile_id: m.profile_id,
      call_session_id: callCtx.callSessionId || null,
      channel: "push",
      priority,
      title: "Notification de l'assistant",
      body,
      status: "pending",
    }));

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(rows)
      .select("id");

    if (error) throw error;

    const firstId = data[0]?.id || null;
    log.call("notify_user_created", callCtx.traceId,
      `count=${data.length} first=${firstId}`);
    return firstId;
  } catch (e) {
    log.error("notify_user_failed", callCtx.traceId, e.message);
    return null;
  }
}

module.exports = { createDirectNotification };
