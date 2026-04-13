const WebSocket = require("ws");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { connectGemini } = require("../gemini/geminiConnection");
const { createCallContext } = require("../calls/callContext");
const callStore = require("../calls/callStateStore");
const { createInboundCallSession, finalizeCallSession } = require("../db/callSessionsRepo");
const { generateAndSaveSummary } = require("../db/callSummaryRepo");
const { createTranscriptBuffer } = require("../db/transcriptBuffer");
const { base64ToInt16, int16ToBase64 } = require("../audio/codec");
const log = require("../observability/logger");

/**
 * Handle a browser-originated WebSocket call on /web-call.
 *
 * Protocol:
 *   Browser → Server:  { type: "start", profileId: "...", callerPhone: "+33..." }
 *   Browser → Server:  { type: "audio", data: "<base64 PCM 16kHz>" }
 *   Server → Browser:  { type: "audio", data: "<base64 PCM 24kHz>" }
 *   Server → Browser:  { type: "ended", reason: "..." }
 */
function handleWebCallConnection(ws) {
  const callCtx = createCallContext();
  callCtx._txBuffer = createTranscriptBuffer(callCtx);
  callStore.set(callCtx.traceId, callCtx);
  log.call("web_call_new_connection", callCtx.traceId);

  let geminiWs = null;
  let started = false;

  // ── Finalization (at most once) ──
  async function finalizeOnce() {
    if (callCtx.finalized) return;
    callCtx.finalized = true;

    if (callCtx._txBuffer) await callCtx._txBuffer.flushAll();
    await finalizeCallSession(callCtx);
    generateAndSaveSummary(callCtx.callSessionId, callCtx.traceId).catch(() => {});
    callStore.remove(callCtx.traceId);
  }

  // ── Send Gemini audio back to browser (PCM 24kHz base64) ──
  function sendAudioToBrowser(pcmBase64_24k) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "audio", data: pcmBase64_24k }));
    }
  }

  // ── Silence sender (needed by consult_user flow) ──
  callCtx._sendSilence = () => {
    // Browser doesn't need silence keepalive; no-op
  };

  // ── Hangup ──
  callCtx._hangup = (reason = "end_call") => {
    log.call("web_call_hangup_requested", callCtx.traceId, reason);
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "ended", reason }));
      ws.close(1000, reason);
    }
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1000, reason);
    }
  };

  ws.on("message", async (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === "start" && !started) {
        started = true;
        const { profileId, callerPhone } = msg;
        log.call("web_call_start", callCtx.traceId, `profileId=${profileId}, callerPhone=${callerPhone || "anonymous"}`);

        callCtx.callerNumber = callerPhone || "unknown";
        callCtx.startedAt = new Date().toISOString();
        callCtx.profileId = profileId || null;

        // ── Resolve account from profileId ──
        if (profileId) {
          try {
            const { data: membership } = await supabaseAdmin
              .from("account_members")
              .select("account_id")
              .eq("profile_id", profileId)
              .eq("is_default_account", true)
              .limit(1)
              .maybeSingle();

            if (membership) {
              callCtx.accountId = membership.account_id;
            } else {
              const { data: anyMem } = await supabaseAdmin
                .from("account_members")
                .select("account_id")
                .eq("profile_id", profileId)
                .limit(1)
                .maybeSingle();
              if (anyMem) callCtx.accountId = anyMem.account_id;
            }

            if (callCtx.accountId) {
              // Resolve active mode
              const { data: mode } = await supabaseAdmin
                .from("assistant_modes")
                .select("id")
                .eq("account_id", callCtx.accountId)
                .eq("is_active", true)
                .limit(1)
                .maybeSingle();
              if (mode) callCtx.activeModeId = mode.id;

              // Resolve phone_number
              const { data: pnList } = await supabaseAdmin
                .from("phone_numbers")
                .select("id")
                .eq("account_id", callCtx.accountId)
                .eq("status", "active")
                .limit(1);
              if (pnList && pnList.length > 0) callCtx.phoneNumberId = pnList[0].id;
            }
          } catch (e) {
            log.error("web_call_resolve_error", callCtx.traceId, e.message);
          }
        }

        log.call("web_call_resolved", callCtx.traceId,
          `accountId=${callCtx.accountId || "MISSING"}, activeModeId=${callCtx.activeModeId || "MISSING"}`);

        // Create call session (provider = "web")
        callCtx.providerCallId = `web-${callCtx.traceId}`;
        const origProvider = "web";
        // Temporarily override for the insert
        const sessionId = await createWebCallSession(callCtx, origProvider);
        if (sessionId) callCtx.callSessionId = sessionId;

        // Connect Gemini — use a custom onAudio that sends raw PCM base64 (no mulaw conversion)
        geminiWs = connectGeminiForWeb(callCtx, sendAudioToBrowser);
        return;
      }

      if (msg.type === "audio" && started) {
        if (!callCtx.geminiReady || !geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

        // Browser sends PCM 16kHz base64 — forward directly to Gemini
        geminiWs.send(JSON.stringify({
          realtimeInput: {
            audio: {
              data: msg.data,
              mimeType: "audio/pcm;rate=16000",
            },
          },
        }));
        return;
      }
    } catch (e) {
      log.error("web_call_message_error", callCtx.traceId, e.message);
    }
  });

  ws.on("close", () => {
    log.call("web_call_disconnected", callCtx.traceId);
    finalizeOnce();
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) geminiWs.close(1000, "Browser disconnected");
  });

  ws.on("error", (err) => {
    log.error("web_call_ws_error", callCtx.traceId, err.message);
  });
}

/**
 * Connect to Gemini for a web call.
 * Same as the standard connectGemini but audio callback receives raw PCM 24kHz base64
 * (no mulaw conversion needed).
 */
function connectGeminiForWeb(callCtx, onAudioBase64) {
  const { GEMINI_API_KEY } = require("../config/env");
  const { buildSetupPayload } = require("../gemini/geminiConfig");
  const { handleToolCall } = require("../tools/toolRouter");
  const {
    createConsultUserFlowState,
    isConsultAnnouncementPending,
    observeConsultAnnouncement,
  } = require("../tools/consultUserFlow");
  const { buildRuntimeContext } = require("../context/runtimeContextBuilder");

  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const ws = new WebSocket(wsUrl);
  const { traceId } = callCtx;

  ws.on("open", () => {
    log.gemini("web_connected", traceId);
    ws.send(JSON.stringify(buildSetupPayload()));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("web_setup_complete", traceId);

        buildRuntimeContext(callCtx)
          .then((contextBlock) => {
            ws.send(JSON.stringify({ realtimeInput: { text: contextBlock } }));
            log.gemini("web_runtime_context_injected", traceId);

            const kickoff = "L'appel vient de commencer. Présente-toi immédiatement puis attends la réponse de l'appelant.";
            ws.send(JSON.stringify({ realtimeInput: { text: kickoff } }));

            log.gemini("web_mic_gate_started", traceId, "3000ms");
            setTimeout(() => {
              callCtx.geminiReady = true;
              log.gemini("web_mic_gate_ended", traceId);
            }, 3000);
          })
          .catch((err) => {
            log.error("web_runtime_context_failed", traceId, err.message);
            const kickoff = "L'appel vient de commencer. Présente-toi immédiatement puis attends la réponse de l'appelant.";
            ws.send(JSON.stringify({ realtimeInput: { text: kickoff } }));
            setTimeout(() => { callCtx.geminiReady = true; }, 3000);
          });
        return;
      }

      // Audio from Gemini → send PCM 24kHz base64 directly to browser
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const consultFlow = callCtx.consultUserFlow || (callCtx.consultUserFlow = createConsultUserFlowState());
            if (isConsultAnnouncementPending(consultFlow)) {
              observeConsultAnnouncement(consultFlow);
            }
            // Send raw PCM 24kHz base64 to browser (no mulaw conversion)
            onAudioBase64(part.inlineData.data);
          }
        }
      }

      // Transcriptions
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        log.transcript("🎤", "caller", traceId, text);
        if (callCtx._txBuffer) callCtx._txBuffer.push("caller", text);
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        const consultFlow = callCtx.consultUserFlow || (callCtx.consultUserFlow = createConsultUserFlowState());
        if (isConsultAnnouncementPending(consultFlow)) {
          observeConsultAnnouncement(consultFlow, text);
        }
        if (callCtx._txBuffer) callCtx._txBuffer.push("assistant", text);
      }

      // Tool calls
      if (msg.toolCall?.functionCalls) {
        if (callCtx._txBuffer) callCtx._txBuffer.flush();
        Promise.all(
          msg.toolCall.functionCalls.map((call) => handleToolCall(call, traceId, callCtx))
        ).then((responses) => {
          ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
        });
      }
    } catch (e) {
      log.error("web_gemini_message_error", traceId, e.message);
    }
  });

  ws.on("close", (code, reason) => {
    callCtx.geminiReady = false;
    log.gemini("web_disconnected", traceId, `${code} ${reason}`);
  });

  ws.on("error", (err) => {
    log.error("web_gemini_ws_error", traceId, err.message);
  });

  return ws;
}

/**
 * Create a call_session with provider="web".
 */
async function createWebCallSession(ctx, provider) {
  if (!ctx.accountId) {
    log.error("web_call_session_skipped", ctx.traceId, "no accountId");
    return null;
  }

  const row = {
    account_id: ctx.accountId,
    provider,
    provider_call_id: ctx.providerCallId || null,
    direction: "inbound",
    started_at: ctx.startedAt || new Date().toISOString(),
    caller_phone_e164: ctx.callerNumber !== "unknown" ? ctx.callerNumber : null,
    caller_name_raw: null,
    phone_number_id: ctx.phoneNumberId || null,
    profile_id: ctx.profileId || null,
    active_mode_id: ctx.activeModeId || null,
  };

  try {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .insert(row)
      .select("id")
      .single();
    if (error) throw error;
    log.call("web_call_session_created", ctx.traceId, data.id);
    return data.id;
  } catch (e) {
    log.error("web_call_session_insert_failed", ctx.traceId, e.message);
    return null;
  }
}

module.exports = { handleWebCallConnection };
