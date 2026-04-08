const { notifyBackend } = require("./toolClient");
const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { createCallbackRequest } = require("../db/callbackRequestsRepo");

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
    let resultPayload;

    if (call.name === "create_callback") {
      resultPayload = await handleCreateCallback(call.args, callCtx, traceId);
    } else {
      // Legacy getWeather / n8n path
      await notifyBackend(call.name, call.args, call.args?.city || JSON.stringify(call.args), traceId);
      resultPayload = { message: "Message transmis à Romain." };
    }

    const response = {
      id: call.id,
      name: call.name,
      response: { result: resultPayload },
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

/**
 * Handle create_callback tool call.
 */
async function handleCreateCallback(args, callCtx, traceId) {
  const cbId = await createCallbackRequest(callCtx, args);
  if (cbId) {
    return {
      success: true,
      callbackRequestId: cbId,
      message: "La demande de rappel a été enregistrée.",
    };
  }
  return {
    success: false,
    message: "Impossible d'enregistrer la demande de rappel.",
  };
}

module.exports = { handleToolCall };
