const log = require("../observability/logger");
const { startToolInvocation, completeToolInvocation, failToolInvocation } = require("../db/toolInvocationsRepo");
const { createCallbackRequest } = require("../db/callbackRequestsRepo");
const { getCallerProfile } = require("../db/callerProfileRepo");
const { createDirectNotification } = require("../db/notifyUserRepo");

const { consultUser } = require("../db/liveChatRepo");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { createTransferRequest, waitForTransferResponse, completeTransferRequest } = require("../db/transferRequestsRepo");
const { checkAvailability, bookAppointment } = require("../calendar/googleCalendarClient");
const {
  createConsultUserFlowState,
  queueConsultAnnouncement,
  updatePendingConsultQuestion,
  isConsultAnnouncementPending,
  hasObservedConsultAnnouncement,
  observeConsultAnnouncement,
  matchesWaitAnnouncement,
  resetConsultUserFlow,
} = require("./consultUserFlow");
const v = require("./validateArgs");

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
      case "generate_call_summary":
        resultPayload = await handleGenerateCallSummary(call.args, callCtx, traceId);
        break;
      case "consult_user":
        resultPayload = await handleConsultUser(call.args, callCtx, traceId);
        break;
      case "end_call":
        resultPayload = await handleEndCall(call.args, callCtx, traceId);
        break;
      case "transfer_call":
        resultPayload = await handleTransferCall(call.args, callCtx, traceId);
        break;
      case "check_availability":
        resultPayload = await handleCheckAvailability(call.args, callCtx, traceId);
        break;
      case "book_appointment":
        resultPayload = await handleBookAppointment(call.args, callCtx, traceId);
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
  if (args?.phone_number) {
    const r = v.validatePhone(args.phone_number);
    if (!r.ok) {
      log.tool("validation_error", traceId, `get_caller_profile: ${r.message}`);
      return { success: false, message: r.message };
    }
  }

  const phone = args?.phone_number?.trim() || callCtx.callerNumber;
  return await getCallerProfile(callCtx.accountId, phone, traceId);
}

// ─── create_callback ─────────────────────────────────────────

async function handleCreateCallback(args, callCtx, traceId) {
  // Callback is always allowed — it's part of take_message flow
  // No policy guardrail needed since callback_allowed column was removed

  const r1 = v.validatePriority(args?.priority);
  const r2 = v.validateMaxLen(args?.reason, "reason", v.MAX_REASON);
  const r3 = v.validateMaxLen(args?.preferred_time_note, "preferred_time_note", v.MAX_NOTE);
  for (const r of [r1, r2, r3]) {
    if (!r.ok) {
      log.tool("validation_error", traceId, `create_callback: ${r.message}`);
      return { success: false, message: r.message };
    }
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

// ─── Policy check helpers (behavior-based) ──────────────────

async function resolveCallerGroupBehavior(callCtx, traceId) {
  if (!callCtx.accountId) return null;

  try {
    let callerGroupId = callCtx.callerGroupId || null;

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
        if (membership) callerGroupId = membership.caller_group_id;
      }
    }

    if (!callerGroupId) {
      const { data: defaultGroup } = await supabaseAdmin
        .from("caller_groups")
        .select("id")
        .eq("account_id", callCtx.accountId)
        .in("slug", ["unknown", "default_group"])
        .limit(1)
        .maybeSingle();
      if (defaultGroup) callerGroupId = defaultGroup.id;
    }

    if (!callerGroupId) return null;

    let ruleQuery = supabaseAdmin
      .from("call_handling_rules")
      .select("behavior")
      .eq("account_id", callCtx.accountId)
      .eq("caller_group_id", callerGroupId);

    if (callCtx.activeModeId) {
      ruleQuery = ruleQuery.eq("assistant_mode_id", callCtx.activeModeId);
    }

    const { data: rule } = await ruleQuery.limit(1).maybeSingle();
    return rule?.behavior || null;
  } catch (e) {
    log.error("resolve_caller_group_behavior_error", traceId, e.message);
    return null;
  }
}

// ─── notify_user ─────────────────────────────────────────────

async function handleNotifyUser(args, callCtx, traceId) {
  const r1 = v.validatePriority(args?.priority);
  const r2 = v.validateMaxLen(args?.summary, "summary", 1000);
  const r3 = v.validateMaxLen(args?.caller_name, "caller_name", v.MAX_NAME);
  for (const r of [r1, r2, r3]) {
    if (!r.ok) {
      log.tool("validation_error", traceId, `notify_user: ${r.message}`);
      return { success: false, message: r.message };
    }
  }

  return await createDirectNotification(callCtx, args);
}


// ─── generate_call_summary ───────────────────────────────────

async function handleGenerateCallSummary(args, callCtx, traceId) {
  const summary = args?.summary;
  if (typeof summary !== "string" || !summary.trim()) {
    log.tool("validation_error", traceId, "generate_call_summary: summary is required and must be a non-empty string");
    return { success: false, message: "summary is required and must be a non-empty string" };
  }

  if (!callCtx.callSessionId) {
    log.tool("call_summary_llm_skipped", traceId, "missing callSessionId");
    return { success: false, message: "Missing call session." };
  }

  const r = v.validateMaxLen(summary, "summary", v.MAX_SUMMARY);
  if (!r.ok) {
    log.tool("validation_error", traceId, `generate_call_summary: ${r.message}`);
    return { success: false, message: r.message };
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

// ─── consult_user helpers ────────────────────────────────────

// ─── end_call ────────────────────────────────────────────────

async function handleEndCall(args, callCtx, traceId) {
  const r = v.validateMaxLen(args?.reason, "reason", 200);
  if (!r.ok) {
    log.tool("validation_error", traceId, `end_call: ${r.message}`);
    return { success: false, message: r.message };
  }

  const reason = args?.reason || "end_call";
  log.tool("end_call", traceId, reason);

  // Give Gemini a moment to finish speaking before hanging up
  setTimeout(() => {
    if (typeof callCtx._hangup === "function") {
      callCtx._hangup(reason);
    }
  }, 1500);

  return { success: true, message: "Call will be terminated shortly." };
}

// ─── transfer_call ───────────────────────────────────────────

async function handleTransferCall(args, callCtx, traceId) {
  const r = v.validateMaxLen(args?.reason, "reason", v.MAX_REASON);
  if (!r.ok) {
    log.tool("validation_error", traceId, `transfer_call: ${r.message}`);
    return { success: false, message: r.message };
  }

  const reason = args?.reason || "transfer requested";

  if (!callCtx.callSessionId || !callCtx.accountId) {
    return { success: false, message: "Cannot transfer: missing session context." };
  }

  log.tool("transfer_call_started", traceId, reason);

  // 1. Create the transfer request in DB (user will see it via Realtime)
  const requestId = await createTransferRequest(callCtx, reason);
  if (!requestId) {
    return { success: false, message: "Failed to create transfer request." };
  }

  // 2. Initialize transfer state on callCtx
  callCtx._transferState = {
    requestId,
    active: false,
    userWs: null,
    sendToTwilio: null,
    onUserDisconnect: null,
  };

  // 3. Send silence to Twilio to keep the call alive while waiting
  const silenceInterval = setInterval(() => {
    if (typeof callCtx._sendSilence === "function") {
      callCtx._sendSilence();
    }
  }, 200);

  try {
    // 4. Wait for user to accept/decline (up to 30s)
    const status = await waitForTransferResponse(requestId, traceId, 30000);

    clearInterval(silenceInterval);

    if (status === "accepted") {
      log.tool("transfer_call_accepted", traceId, `requestId=${requestId}`);
      callCtx._transferState.active = true;

      return {
        success: true,
        transfer_status: "accepted",
        message: "The user accepted the transfer. The caller is now connected to the user. STOP speaking immediately — do not say anything else. The user and caller are talking directly.",
      };
    }

    // Declined or timeout — clean up
    callCtx._transferState = null;

    if (status === "declined") {
      log.tool("transfer_call_declined", traceId, `requestId=${requestId}`);
      return {
        success: true,
        transfer_status: "declined",
        message: "The user declined the transfer. Inform the caller politely that the user is not available right now and take a message instead.",
      };
    }

    log.tool("transfer_call_timeout", traceId, `requestId=${requestId}`);
    return {
      success: true,
      transfer_status: "timeout",
      message: "The user did not respond in time. Inform the caller politely that the user is not available right now and take a message instead.",
    };
  } catch (e) {
    clearInterval(silenceInterval);
    callCtx._transferState = null;
    log.error("transfer_call_error", traceId, e.message);
    return { success: false, message: "Transfer failed: " + e.message };
  }
}

function waitForAnnouncement(consultFlow, timeoutMs = 3000) {
  return new Promise((resolve) => {
    if (hasObservedConsultAnnouncement(consultFlow)) return resolve(true);
    const start = Date.now();
    const interval = setInterval(() => {
      if (hasObservedConsultAnnouncement(consultFlow)) {
        clearInterval(interval);
        resolve(true);
      } else if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(false);
      }
    }, 200);
  });
}

function observeRecentAssistantWaitAnnouncement(callCtx, consultFlow, traceId, maxAgeMs = 2500) {
  if (hasObservedConsultAnnouncement(consultFlow)) return true;

  const lastTurn = callCtx?._txBuffer?.getLastTurn?.();
  if (!lastTurn || lastTurn.speaker !== "assistant" || !matchesWaitAnnouncement(lastTurn.text)) {
    return false;
  }

  if (typeof lastTurn.capturedAt === "number" && Date.now() - lastTurn.capturedAt > maxAgeMs) {
    return false;
  }

  const observed = observeConsultAnnouncement(consultFlow, lastTurn.text);
  if (observed) {
    log.tool(
      "consult_user_wait_announcement_detected",
      traceId,
      `recent assistant turn "${lastTurn.text.slice(0, 80)}"`
    );
  }

  return observed;
}

// ─── consult_user ────────────────────────────────────────────

async function handleConsultUser(args, callCtx, traceId) {
  const question = typeof args?.question === "string" ? args.question.trim() : "";
  if (!question) {
    log.tool("validation_error", traceId, "consult_user: Missing question parameter");
    return { success: false, message: "Missing question parameter." };
  }

  const r = v.validateMaxLen(question, "question", v.MAX_QUESTION);
  if (!r.ok) {
    log.tool("validation_error", traceId, `consult_user: ${r.message}`);
    return { success: false, message: r.message };
  }

  const consultFlow = callCtx.consultUserFlow || (callCtx.consultUserFlow = createConsultUserFlowState());

  if (!isConsultAnnouncementPending(consultFlow)) {
    queueConsultAnnouncement(consultFlow, question);
    log.tool("consult_user_checking_for_concurrent_announcement", traceId, `"${question.slice(0, 80)}"`);
    observeRecentAssistantWaitAnnouncement(callCtx, consultFlow, traceId);

    // Gemini often speaks the announcement AND calls the tool simultaneously.
    // Wait briefly for the audio/transcript to confirm the announcement.
    const alreadyAnnounced = hasObservedConsultAnnouncement(consultFlow)
      ? true
      : await waitForAnnouncement(consultFlow, 3000);
    if (!alreadyAnnounced) {
      log.tool("consult_user_wait_announcement_required", traceId, `"${question.slice(0, 80)}"`);
      return {
        success: true,
        consult_status: "announce_first",
        timed_out: false,
        user_reply: null,
        message:
          "Before consulting the user, first tell the caller in French to wait a moment. Say exactly one short waiting sentence in its own speech turn, for example: \"Un instant, je vérifie avec Romain, merci de patienter un petit moment.\" This tool call has NOT contacted the user yet. After speaking that sentence, call consult_user again with the same request. Do not answer the caller yet, do not combine the waiting sentence with the answer, and do not mention tools.",
      };
    }
    log.tool("consult_user_concurrent_announcement_detected", traceId);
  }

  // Wait up to 3s for announcement to be detected (audio/transcript may arrive after tool call)
  if (!hasObservedConsultAnnouncement(consultFlow)) {
    updatePendingConsultQuestion(consultFlow, question);
    log.tool("consult_user_waiting_for_announcement", traceId, `"${question.slice(0, 80)}"`);
    observeRecentAssistantWaitAnnouncement(callCtx, consultFlow, traceId);

    const announced = hasObservedConsultAnnouncement(consultFlow)
      ? true
      : await waitForAnnouncement(consultFlow, 3000);
    if (!announced) {
      log.tool("consult_user_wait_announcement_missing", traceId, `"${question.slice(0, 80)}"`);
      return {
        success: true,
        consult_status: "announce_first",
        timed_out: false,
        user_reply: null,
        message:
          "You still have not told the caller to wait. First say one short waiting sentence in French to the caller, in its own speech turn. Only after that should you call consult_user again with the same request. Do not answer the caller yet and do not mention tools.",
      };
    }
    log.tool("consult_user_announcement_confirmed_after_wait", traceId);
  }

  log.tool("consult_user_started", traceId, `"${question.slice(0, 80)}"`);
  resetConsultUserFlow(consultFlow);
  const consultation = await consultUser(callCtx, question, traceId);

  if (consultation.status === "answered") {
    return {
      success: true,
      consult_status: "answered",
      timed_out: false,
      user_reply: consultation.reply,
      message:
        "The user replied to your question. The caller has already been asked to wait, so do NOT repeat any waiting sentence now. Use this information to continue the conversation with the caller.",
    };
  }

  if (consultation.status === "timeout") {
    return {
      success: true,
      consult_status: "timeout",
      timed_out: true,
      user_reply: null,
      message:
        "The user did not respond before the timeout. The caller has already been asked to wait, so do NOT repeat any waiting sentence now. Do not call consult_user again for this same request right now. Politely tell the caller you could not reach the user and take a message instead.",
    };
  }

  return {
    success: false,
    consult_status: "error",
    timed_out: false,
    user_reply: null,
    message: consultation.error || "Failed to consult the user.",
  };
}

// ─── check_availability ──────────────────────────────────────

async function handleCheckAvailability(args, callCtx, traceId) {
  if (!callCtx.accountId) {
    return { success: false, message: "No account context — cannot check availability." };
  }

  // Validate required date parameter
  const date = args?.date;
  if (!date) {
    log.tool("validation_error", traceId, "check_availability: date is required (YYYY-MM-DD)");
    return { success: false, message: "date is required (YYYY-MM-DD)" };
  }

  const r1 = v.validateDate(date);
  if (!r1.ok) {
    log.tool("validation_error", traceId, `check_availability: ${r1.message}`);
    return { success: false, message: r1.message };
  }

  const rangeStart = args?.time_range_start ?? "08:00";
  const rangeEnd = args?.time_range_end ?? "18:00";

  const r2 = v.validateTime(rangeStart, "time_range_start");
  const r3 = v.validateTime(rangeEnd, "time_range_end");
  for (const r of [r2, r3]) {
    if (!r.ok) {
      log.tool("validation_error", traceId, `check_availability: ${r.message}`);
      return { success: false, message: r.message };
    }
  }

  // Verify ordering: end must be after start
  if (rangeStart >= rangeEnd) {
    log.tool("validation_error", traceId, `check_availability: time_range_end (${rangeEnd}) must be after time_range_start (${rangeStart})`);
    return { success: false, message: `time_range_end (${rangeEnd}) must be after time_range_start (${rangeStart})` };
  }

  try {
    // Parse date and time range into ISO timestamps
    const timeMin = new Date(`${date}T${rangeStart}:00+02:00`).toISOString();
    const timeMax = new Date(`${date}T${rangeEnd}:00+02:00`).toISOString();

    const result = await checkAvailability(callCtx.accountId, timeMin, timeMax, traceId);

    // Format for Gemini
    const freeSlots = result.free.map((s) => {
      const start = new Date(s.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
      const end = new Date(s.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" });
      return `${start} – ${end}`;
    });

    return {
      success: true,
      date,
      free_slots: freeSlots,
      busy_count: result.busy.length,
      message: freeSlots.length > 0
        ? `Available slots on ${date}: ${freeSlots.join(", ")}`
        : `No availability found on ${date} between ${rangeStart} and ${rangeEnd}.`,
    };
  } catch (e) {
    log.error("check_availability_error", traceId, e.message);
    return { success: false, message: `Failed to check availability: ${e.message}` };
  }
}

// ─── book_appointment ────────────────────────────────────────

async function handleBookAppointment(args, callCtx, traceId) {
  if (!callCtx.accountId) {
    return { success: false, message: "No account context — cannot book appointment." };
  }

  // Validate required time parameters
  const startTime = args?.start_time;
  const endTime = args?.end_time;

  if (!startTime) {
    log.tool("validation_error", traceId, "book_appointment: start_time is required");
    return { success: false, message: "start_time is required" };
  }
  if (!endTime) {
    log.tool("validation_error", traceId, "book_appointment: end_time is required");
    return { success: false, message: "end_time is required" };
  }

  const r1 = v.validateIsoDatetime(startTime, "start_time");
  const r2 = v.validateIsoDatetime(endTime, "end_time");
  if (!r1.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r1.message}`);
    return { success: false, message: r1.message };
  }
  if (!r2.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r2.message}`);
    return { success: false, message: r2.message };
  }

  const r3 = v.validateOrdering(startTime, endTime);
  const r4 = v.validateBookingDuration(startTime, endTime);
  if (!r3.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r3.message}`);
    return { success: false, message: r3.message };
  }
  if (!r4.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r4.message}`);
    return { success: false, message: r4.message };
  }

  // Validate optional phone number
  if (args?.attendee_phone) {
    const r5 = v.validatePhone(args.attendee_phone);
    if (!r5.ok) {
      log.tool("validation_error", traceId, `book_appointment: ${r5.message}`);
      return { success: false, message: r5.message };
    }
  }

  // Validate string length limits
  const r6 = v.validateMaxLen(args?.title, "title", v.MAX_TITLE);
  const r7 = v.validateMaxLen(args?.attendee_name, "attendee_name", v.MAX_NAME);
  if (!r6.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r6.message}`);
    return { success: false, message: r6.message };
  }
  if (!r7.ok) {
    log.tool("validation_error", traceId, `book_appointment: ${r7.message}`);
    return { success: false, message: r7.message };
  }

  // In full_autonomy mode, skip policy guardrail — the AI decides
  if (callCtx.controlMode !== "full_autonomy") {
    // Backend guardrail: check booking_allowed policy
    const policyOk = await isBookingAllowedByPolicy(callCtx, traceId);
    if (!policyOk) {
      return { success: false, message: "Booking is not allowed for this caller group. Take a message instead." };
    }
  } else {
    log.tool("booking_policy_bypassed_full_autonomy", traceId, `accountId=${callCtx.accountId}`);
  }

  try {
    const result = await bookAppointment(
      callCtx.accountId,
      {
        title: args?.title || "Rendez-vous",
        startTime: startTime,
        endTime: endTime,
        attendeeName: args?.attendee_name || callCtx.callerName || null,
        attendeePhone: args?.attendee_phone || callCtx.callerNumber || null,
        callSessionId: callCtx.callSessionId,
      },
      traceId
    );

    return {
      success: true,
      event_id: result.event_id,
      message: `Appointment booked: "${result.title}" on ${new Date(result.start).toLocaleDateString("fr-FR")} from ${new Date(result.start).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })} to ${new Date(result.end).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })}.`,
    };
  } catch (e) {
    log.error("book_appointment_error", traceId, e.message);
    return { success: false, message: `Failed to book appointment: ${e.message}` };
  }
}

// ─── Policy check: is booking allowed for the caller's group? ───

async function isBookingAllowedByPolicy(callCtx, traceId) {
  if (!callCtx.accountId) return false;

  try {
    // Check mode-level allow_booking flag first
    if (callCtx.activeModeId) {
      const { data: mode } = await supabaseAdmin
        .from("assistant_modes")
        .select("allow_booking")
        .eq("id", callCtx.activeModeId)
        .maybeSingle();

      if (mode?.allow_booking === true) {
        log.tool("booking_policy_checked", traceId,
          `mode=${callCtx.activeModeId} allow_booking=true — allowed by mode`);
        return true;
      }
    }

    // Check behavior-based policy
    const behavior = await resolveCallerGroupBehavior(callCtx, traceId);
    const allowed = behavior === "book_appointment";
    log.tool("booking_policy_checked", traceId,
      `behavior=${behavior}, allowed=${allowed}`);
    return allowed;
  } catch (e) {
    log.error("booking_policy_check_error", traceId, e.message);
    return false;
  }
}

module.exports = { handleToolCall };

