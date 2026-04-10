const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { createCallbackRequest } = require("../db/callbackRequestsRepo");
const { getCallerProfile } = require("../db/callerProfileRepo");
const { createDirectNotification } = require("../db/notifyUserRepo");
const { createEscalation } = require("../db/escalationRepo");

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
        resultPayload = { success: false, message: `Outil inconnu: ${call.name}` };
        break;
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
      response: { result: { success: false, error: e.message } },
    };
  }
}

// ─── get_caller_profile ──────────────────────────────────────

async function handleGetCallerProfile(args, callCtx, traceId) {
  const phone = args.phone_number || callCtx.callerNumber;
  const profile = await getCallerProfile(callCtx.accountId, phone, traceId);
  return profile;
}

// ─── create_callback ─────────────────────────────────────────

async function handleCreateCallback(args, callCtx, traceId) {
  const cbId = await createCallbackRequest(callCtx, args);
  if (cbId) {
    return {
      success: true,
      callback_request_id: cbId,
      message: "La demande de rappel a été enregistrée.",
    };
  }
  return {
    success: false,
    message: "Impossible d'enregistrer la demande de rappel.",
  };
}

// ─── notify_user ─────────────────────────────────────────────

async function handleNotifyUser(args, callCtx, traceId) {
  const notifId = await createDirectNotification(callCtx, args);
  if (notifId) {
    return {
      success: true,
      notification_id: notifId,
      message: "L'utilisateur a été notifié.",
    };
  }
  return {
    success: false,
    message: "Impossible de notifier l'utilisateur.",
  };
}

// ─── escalate_call ───────────────────────────────────────────

async function handleEscalateCall(args, callCtx, traceId) {
  const escId = await createEscalation(callCtx, args);
  if (escId) {
    return {
      success: true,
      escalation_id: escId,
      escalation_status: "attempted",
      message: "Tentative d'escalade en cours.",
    };
  }
  return {
    success: false,
    escalation_status: "failed",
    message: "Impossible d'escalader l'appel.",
  };
}

module.exports = { handleToolCall };
