const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { createCallbackRequest } = require("../db/callbackRequestsRepo");
const { getCallerProfile } = require("../db/callerProfileRepo");
const { createDirectNotification } = require("../db/notifyUserRepo");
const { createEscalation } = require("../db/escalationRepo");

/**
 * Route a Gemini tool call to the appropriate handler.
 * Returns the response object to send back to Gemini.
 * Every handler returns { success, message, ...extras }.
 */
async function handleToolCall(call, traceId, callCtx) {
  log.tool("tool_call", traceId, `${call.name} ${JSON.stringify(call.args)}`);

  // DB: start invocation record
  const invocationId = callCtx
    ? await startToolInvocation(callCtx, call.name, call.args)
    : null;

  try {
    let resultPayload;

    switch (call.name) {
      case "get_caller_profile":
        resultPayload = await handleGetCallerProfile(call.args, callCtx, traceId);
        break;
      case "create_callback":
        resultPayload = await handleCreateCallback(call.args, callCtx, traceId);
        break;
      case "notify_user":
        resultPayload = await handleNotifyUser(call.args, callCtx, traceId);
        break;
      case "escalate_call":
        resultPayload = await handleEscalateCall(call.args, callCtx, traceId);
        break;
      default:
        log.tool("tool_unknown", traceId, call.name);
        resultPayload = { success: false, message: `Unknown tool: ${call.name}` };
        break;
    }

    const response = {
      id: call.id,
      name: call.name,
      response: { result: resultPayload },
    };

    // DB: mark success or failure based on tool result
    if (resultPayload.success === false) {
      failToolInvocation(invocationId, "TOOL_LOGIC_ERROR", resultPayload.message, traceId);
    } else {
      completeToolInvocation(invocationId, response.response, traceId);
    }

    return response;
  } catch (e) {
    log.error("tool_call_error", traceId, e.message);
    failToolInvocation(invocationId, "TOOL_ERROR", e.message, traceId);

    return {
      id: call.id,
      name: call.name,
      response: { result: { success: false, message: e.message } },
    };
  }
}

// ─── get_caller_profile ──────────────────────────────────────

async function handleGetCallerProfile(args, callCtx, traceId) {
  const phone = args.phone_number || callCtx.callerNumber;
  return await getCallerProfile(callCtx.accountId, phone, traceId);
}

// ─── create_callback ─────────────────────────────────────────

async function handleCreateCallback(args, callCtx, traceId) {
  const cbId = await createCallbackRequest(callCtx, args);
  if (cbId) {
    return {
      success: true,
      callback_request_id: cbId,
      message: "Callback request recorded.",
    };
  }
  return {
    success: false,
    callback_request_id: null,
    message: "Failed to record callback request.",
  };
}

// ─── notify_user ─────────────────────────────────────────────

async function handleNotifyUser(args, callCtx, traceId) {
  return await createDirectNotification(callCtx, args);
}

// ─── escalate_call ───────────────────────────────────────────

async function handleEscalateCall(args, callCtx, traceId) {
  return await createEscalation(callCtx, args);
}

module.exports = { handleToolCall };
