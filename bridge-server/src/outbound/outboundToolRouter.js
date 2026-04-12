const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { consultUser } = require("../db/liveChatRepo");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const {
  createConsultUserFlowState,
  queueConsultAnnouncement,
  isConsultAnnouncementPending,
  hasObservedConsultAnnouncement,
  observeConsultAnnouncement,
  resetConsultUserFlow,
} = require("../tools/consultUserFlow");

/**
 * Route an outbound Gemini tool call to the appropriate handler.
 */
async function handleOutboundToolCall(call, traceId, callCtx) {
  log.tool("outbound_tool_call", traceId, `${call.name} ${JSON.stringify(call.args)}`);

  const invocationId = callCtx
    ? await startToolInvocation(callCtx, call.name, call.args)
    : null;

  try {
    let resultPayload;

    switch (call.name) {
      case "report_result":
        resultPayload = await handleReportResult(call.args, callCtx, traceId);
        break;
      case "consult_user":
        resultPayload = await handleOutboundConsultUser(call.args, callCtx, traceId);
        break;
      case "end_call":
        resultPayload = await handleEndCall(call.args, callCtx, traceId);
        break;
      default:
        log.tool("outbound_tool_unknown", traceId, call.name);
        resultPayload = { success: false, message: `Unknown tool: ${call.name}` };
        break;
    }

    const response = {
      id: call.id,
      name: call.name,
      response: { result: resultPayload },
    };

    if (resultPayload.success === false) {
      failToolInvocation(invocationId, "TOOL_LOGIC_ERROR", resultPayload.message, traceId);
    } else {
      completeToolInvocation(invocationId, response.response, traceId);
    }

    return response;
  } catch (e) {
    log.error("outbound_tool_call_error", traceId, e.message);
    failToolInvocation(invocationId, "TOOL_ERROR", e.message, traceId);
    return {
      id: call.id,
      name: call.name,
      response: { result: { success: false, message: e.message } },
    };
  }
}

// ─── report_result ───────────────────────────────────────────

async function handleReportResult(args, callCtx, traceId) {
  const { result_status, summary } = args;

  if (!callCtx.missionId) {
    log.tool("report_result_no_mission", traceId, "no missionId on context");
    return { success: false, message: "No mission context available." };
  }

  try {
    const { error } = await supabaseAdmin
      .from("outbound_missions")
      .update({
        result_status,
        result_summary: summary,
        status: result_status === "success" || result_status === "partial" ? "completed" : "failed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", callCtx.missionId);

    if (error) throw error;

    // Also update call session summary
    if (callCtx.callSessionId) {
      await supabaseAdmin
        .from("call_sessions")
        .update({ summary_llm: summary })
        .eq("id", callCtx.callSessionId);
    }

    log.tool("report_result_saved", traceId, `mission=${callCtx.missionId} status=${result_status}`);
    return { success: true, message: "Mission result recorded." };
  } catch (e) {
    log.error("report_result_error", traceId, e.message);
    return { success: false, message: "Failed to save mission result." };
  }
}

// ─── consult_user (simplified for outbound) ──────────────────

async function handleOutboundConsultUser(args, callCtx, traceId) {
  const question = typeof args.question === "string" ? args.question.trim() : "";
  if (!question) {
    return { success: false, message: "Missing question parameter." };
  }

  log.tool("outbound_consult_user_started", traceId, `"${question.slice(0, 80)}"`);
  const consultation = await consultUser(callCtx, question, traceId);

  if (consultation.status === "answered") {
    return {
      success: true,
      consult_status: "answered",
      user_reply: consultation.reply,
      message: `The user replied: "${consultation.reply}". Use this information to continue the call.`,
    };
  }

  return {
    success: true,
    consult_status: "timeout",
    user_reply: null,
    message: "The user did not respond. Continue with the information you have, or end the call politely.",
  };
}

// ─── end_call ────────────────────────────────────────────────

async function handleEndCall(args, callCtx, traceId) {
  const reason = args.reason || "end_call";
  log.tool("outbound_end_call", traceId, reason);

  if (typeof callCtx._requestHangup === "function") {
    callCtx._requestHangup(reason);
  } else {
    setTimeout(() => {
      if (typeof callCtx._hangup === "function") {
        callCtx._hangup(reason);
      }
    }, 1500);
  }

  return { success: true, message: "Call termination scheduled after the closing speech." };
}

module.exports = { handleOutboundToolCall };
