const { notifyBackend } = require("./toolClient");
const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");

/**
 * Route a Gemini tool call to the appropriate handler.
 * Returns the response object to send back to Gemini.
 */
async function handleToolCall(call, traceId, callCtx) {
  log.tool("tool_call", traceId, `${call.name} ${JSON.stringify(call.args)}`);

  // DB: start invocation record
  const invocationId = callCtx
    ? await startToolInvocation(callCtx, call.name, call.args)
    : null;

  try {
    await notifyBackend(call.name, call.args, call.args?.city || JSON.stringify(call.args), traceId);

    const response = {
      id: call.id,
      name: call.name,
      response: { result: { message: "Message transmis à Romain." } },
    };

    // DB: mark success
    completeToolInvocation(invocationId, response.response, traceId);

    return response;
  } catch (e) {
    log.error("tool_call_error", traceId, e.message);
    failToolInvocation(invocationId, "TOOL_ERROR", e.message, traceId);

    return {
      id: call.id,
      name: call.name,
      response: { result: { error: e.message } },
    };
  }
}

module.exports = { handleToolCall };
