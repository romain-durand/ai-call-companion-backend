const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Create a transfer request in DB.
 * Returns the request ID or null on failure.
 */
async function createTransferRequest(callCtx, reason) {
  const traceId = callCtx.traceId;
  try {
    const { data, error } = await supabaseAdmin
      .from("transfer_requests")
      .insert({
        account_id: callCtx.accountId,
        call_session_id: callCtx.callSessionId,
        reason: reason || "",
        caller_name: callCtx.callerNameRaw || null,
        caller_phone_e164: callCtx.callerNumber !== "unknown" ? callCtx.callerNumber : null,
        status: "pending",
      })
      .select("id")
      .single();

    if (error) throw error;
    log.tool("transfer_request_created", traceId, `id=${data.id}`);
    return data.id;
  } catch (e) {
    log.error("transfer_request_create_error", traceId, e.message);
    return null;
  }
}

/**
 * Poll for transfer request status change (accepted/declined/timeout).
 * Returns the updated status or "timeout" after maxWaitMs.
 */
async function waitForTransferResponse(requestId, traceId, maxWaitMs = 30000) {
  const pollInterval = 1000;
  const start = Date.now();

  while (Date.now() - start < maxWaitMs) {
    try {
      const { data, error } = await supabaseAdmin
        .from("transfer_requests")
        .select("status")
        .eq("id", requestId)
        .single();

      if (error) throw error;

      if (data.status === "accepted") {
        log.tool("transfer_request_accepted", traceId, `id=${requestId}`);
        return "accepted";
      }
      if (data.status === "declined") {
        log.tool("transfer_request_declined", traceId, `id=${requestId}`);
        return "declined";
      }
      if (data.status === "timeout" || data.status === "completed") {
        return data.status;
      }
    } catch (e) {
      log.error("transfer_poll_error", traceId, e.message);
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  // Timed out — update DB
  try {
    await supabaseAdmin
      .from("transfer_requests")
      .update({ status: "timeout" })
      .eq("id", requestId)
      .eq("status", "pending");
  } catch (_) {}

  log.tool("transfer_request_timeout", traceId, `id=${requestId}`);
  return "timeout";
}

/**
 * Mark a transfer request as completed.
 */
async function completeTransferRequest(requestId, traceId) {
  try {
    await supabaseAdmin
      .from("transfer_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", requestId);
    log.tool("transfer_request_completed", traceId, `id=${requestId}`);
  } catch (e) {
    log.error("transfer_complete_error", traceId, e.message);
  }
}

module.exports = {
  createTransferRequest,
  waitForTransferResponse,
  completeTransferRequest,
};