const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { createCallbackRequest } = require("../db/callbackRequestsRepo");
const { getCallerProfile } = require("../db/callerProfileRepo");
const { createDirectNotification } = require("../db/notifyUserRepo");
const { createEscalation } = require("../db/escalationRepo");
const { supabaseAdmin } = require("../db/supabaseAdmin");

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
      case "generate_call_summary":
        resultPayload = await handleGenerateCallSummary(call.args, callCtx, traceId);
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
  // Backend guardrail: check caller-group policy before allowing callback (fail-closed)
  const policyResult = await isCallbackAllowedByPolicy(callCtx, traceId);
  if (policyResult === "blocked") {
    log.tool("callback_blocked_by_policy", traceId,
      `accountId=${callCtx.accountId}, callerGroupId=${callCtx.callerGroupId || "unknown"}`);
    return {
      success: false,
      callback_request_id: null,
      message: "Callback not allowed for this caller group. Take a message instead.",
    };
  }
  if (policyResult === "unverifiable") {
    log.tool("callback_blocked_policy_verification_failed", traceId,
      `accountId=${callCtx.accountId}, callerNumber=${callCtx.callerNumber || "unknown"}`);
    return {
      success: false,
      callback_request_id: null,
      message: "Callback could not be created because callback policy could not be verified. Take a message instead.",
    };
  }

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

// ─── Policy check: is callback allowed for the caller's group? ───

async function isCallbackAllowedByPolicy(callCtx, traceId) {
  if (!callCtx.accountId) {
    log.tool("callback_policy_no_account", traceId, "no accountId — fail-closed");
    return "unverifiable";
  }

  try {
    // Resolve the caller's group ID from callCtx or from contact lookup
    let callerGroupId = callCtx.callerGroupId || null;

    // If no group ID on context, try to resolve from contact's group membership
    if (!callerGroupId && callCtx.callerNumber && callCtx.callerNumber !== "unknown") {
      const { data: contact } = await supabaseAdmin
        .from("contacts")
        .select("id")
        .eq("account_id", callCtx.accountId)
        .or(`primary_phone_e164.eq.${callCtx.callerNumber},secondary_phone_e164.eq.${callCtx.callerNumber}`)
        .maybeSingle();

      if (contact) {
        const { data: membership } = await supabaseAdmin
          .from("contact_group_memberships")
          .select("caller_group_id")
          .eq("contact_id", contact.id)
          .eq("account_id", callCtx.accountId)
          .limit(1)
          .maybeSingle();

        if (membership) {
          callerGroupId = membership.caller_group_id;
        }
      }
    }

    // If still no group, try to find the "unknown" / default group
    if (!callerGroupId) {
      const { data: unknownGroup } = await supabaseAdmin
        .from("caller_groups")
        .select("id")
        .eq("account_id", callCtx.accountId)
        .eq("slug", "unknown")
        .maybeSingle();

      if (unknownGroup) {
        callerGroupId = unknownGroup.id;
      }
    }

    if (!callerGroupId) {
      log.tool("callback_policy_no_group", traceId, "no caller group resolved — fail-closed");
      return "unverifiable";
    }

    // Look up the call_handling_rule for this group
    const { data: rule } = await supabaseAdmin
      .from("call_handling_rules")
      .select("callback_allowed")
      .eq("account_id", callCtx.accountId)
      .eq("caller_group_id", callerGroupId)
      .limit(1)
      .maybeSingle();

    if (!rule) {
      log.tool("callback_policy_no_rule", traceId, `no rule for groupId=${callerGroupId} — fail-closed`);
      return "unverifiable";
    }

    log.tool("callback_policy_checked", traceId,
      `groupId=${callerGroupId}, callback_allowed=${rule.callback_allowed}`);
    return rule.callback_allowed === true ? "allowed" : "blocked";
  } catch (e) {
    log.error("callback_policy_check_error", traceId, e.message);
    return "unverifiable"; // fail-closed
  }
}

// ─── notify_user ─────────────────────────────────────────────

async function handleNotifyUser(args, callCtx, traceId) {
  return await createDirectNotification(callCtx, args);
}

// ─── escalate_call ───────────────────────────────────────────

async function handleEscalateCall(args, callCtx, traceId) {
  return await createEscalation(callCtx, args);
}

// ─── generate_call_summary ───────────────────────────────────

async function handleGenerateCallSummary(args, callCtx, traceId) {
  const summary = args.summary;
  if (!summary || !callCtx.callSessionId) {
    log.tool("call_summary_llm_skipped", traceId, "missing summary or callSessionId");
    return { success: false, message: "Missing summary text or call session." };
  }

  try {
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({ summary_llm: summary })
      .eq("id", callCtx.callSessionId);

    if (error) throw error;

    log.tool("call_summary_llm_saved", traceId,
      `session=${callCtx.callSessionId} summary="${summary.slice(0, 80)}…"`);
    return { success: true, message: "Call summary saved." };
  } catch (e) {
    log.error("call_summary_llm_error", traceId, e.message);
    return { success: false, message: "Failed to save call summary." };
  }
}

module.exports = { handleToolCall };
