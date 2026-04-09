const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");
const { createFromCallback } = require("./notificationsRepo");
const { deliverCallbackNotifications } = require("../services/notificationDeliveryService");

/**
 * Create a callback_requests row from a tool call.
 * Returns the new row id or null on failure.
 */
async function createCallbackRequest(callCtx, args) {
  if (!callCtx.accountId) {
    log.error("callback_request_failed", callCtx.traceId, "no accountId");
    return null;
  }

  const row = {
    account_id: callCtx.accountId,
    call_session_id: callCtx.callSessionId || null,
    contact_id: null,               // MVP: no contact resolution yet
    caller_name: callCtx.callerNameRaw || null,
    caller_phone_e164: callCtx.callerNumber !== "unknown" ? callCtx.callerNumber : null,
    reason: args.reason || null,
    priority: args.priority || "normal",
    preferred_time_note: args.preferred_time_note || null,
    status: "pending",
    created_by: "assistant",
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("callback_requests")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    log.call("callback_request_created", callCtx.traceId, `${data.id} session=${callCtx.callSessionId}`);

    // Fire-and-forget: persist notification rows (legacy push)
    const cbRow = { ...row, id: data.id };
    createFromCallback(cbRow, callCtx).catch(() => {});

    // Fire-and-forget: evaluate preferences and deliver SMS
    deliverCallbackNotifications(cbRow, callCtx).catch(() => {});

    return data.id;
  } catch (e) {
    log.error("callback_request_failed", callCtx.traceId, e.message);
    return null;
  }
}

module.exports = { createCallbackRequest };
