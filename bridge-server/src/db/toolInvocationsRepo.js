const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Start a tool invocation row. Returns the invocation id or null.
 */
async function startToolInvocation(ctx, toolName, requestJson) {
  if (!ctx.callSessionId || !ctx.accountId) return null;

  const row = {
    account_id: ctx.accountId,
    call_session_id: ctx.callSessionId,
    tool_name: toolName,
    request_json: requestJson || null,
    status: "pending",
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("tool_invocations")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    log.tool("tool_invocation_started", ctx.traceId, `${data.id} ${toolName}`);
    return data.id;
  } catch (e) {
    log.error("db_write_failed", ctx.traceId, `tool_invocations start: ${e.message}`);
    return null;
  }
}

/**
 * Mark a tool invocation as successful.
 */
async function completeToolInvocation(invocationId, responseJson, traceId) {
  if (!invocationId) return;
  try {
    const { error } = await supabaseAdmin
      .from("tool_invocations")
      .update({
        status: "success",
        response_json: responseJson || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", invocationId);
    if (error) throw error;
    log.tool("tool_invocation_completed", traceId, invocationId);
  } catch (e) {
    log.error("db_write_failed", traceId, `tool_invocations complete: ${e.message}`);
  }
}

/**
 * Mark a tool invocation as failed.
 */
async function failToolInvocation(invocationId, errorCode, errorMessage, traceId) {
  if (!invocationId) return;
  try {
    const { error } = await supabaseAdmin
      .from("tool_invocations")
      .update({
        status: "error",
        error_code: errorCode || "unknown",
        error_message: errorMessage || null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", invocationId);
    if (error) throw error;
    log.tool("tool_invocation_failed", traceId, `${invocationId} ${errorCode}`);
  } catch (e) {
    log.error("db_write_failed", traceId, `tool_invocations fail: ${e.message}`);
  }
}

module.exports = { startToolInvocation, completeToolInvocation, failToolInvocation };
