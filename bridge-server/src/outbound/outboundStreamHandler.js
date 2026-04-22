const WebSocket = require("ws");
const { decodeMulaw, upsample8to16, int16ToBase64, SILENCE_200MS } = require("../audio/codec");
const { connectOutboundGemini } = require("./outboundGeminiConnection");
const { createCallContext } = require("../calls/callContext");
const callStore = require("../calls/callStateStore");
const { createTranscriptBuffer } = require("../db/transcriptBuffer");
const { finalizeCallSession } = require("../db/callSessionsRepo");
const { generateAndSaveSummary } = require("../db/callSummaryRepo");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const log = require("../observability/logger");

/**
 * Finalize the outbound mission row if it hasn't been finalized by report_result.
 * Determines hangup_by based on who initiated the disconnect.
 */
async function finalizeOutboundMission(callCtx) {
  if (!callCtx.missionId) return;

  try {
    // Check current state — skip if already completed/failed by report_result
    const { data: mission } = await supabaseAdmin
      .from("outbound_missions")
      .select("status, completed_at")
      .eq("id", callCtx.missionId)
      .single();

    if (!mission || mission.completed_at) return; // Already finalized

    const hangupBy = callCtx._hangupRequested ? "assistant" : "callee";

    const { error } = await supabaseAdmin
      .from("outbound_missions")
      .update({
        status: "failed",
        result_status: "failure",
        completed_at: new Date().toISOString(),
        hangup_by: hangupBy,
        result_summary: mission.status === "in_progress" && !callCtx._hangupRequested
          ? "L'interlocuteur a raccroché avant la fin de la mission."
          : null,
      })
      .eq("id", callCtx.missionId)
      .is("completed_at", null); // Optimistic lock

    if (error) throw error;
    log.call("outbound_mission_finalized_fallback", callCtx.traceId, `mission=${callCtx.missionId} hangup_by=${hangupBy}`);
  } catch (e) {
    log.error("outbound_mission_finalize_error", callCtx.traceId, e.message);
  }
}

/**
 * Handle a Twilio Media Stream WebSocket for an outbound call.
 * Attempts to reuse a pre-connected Gemini WS if available.
 */
function handleOutboundStreamConnection(twilioWs) {
  const callCtx = createCallContext();
  callCtx._txBuffer = createTranscriptBuffer(callCtx);
  callCtx.isOutbound = true;
  callStore.set(callCtx.traceId, callCtx);
  log.call("outbound_stream_connection", callCtx.traceId);

  let geminiWs = null;

  async function finalizeOnce() {
    if (callCtx.finalized) return;
    callCtx.finalized = true;

    if (callCtx._hangupWatcher) {
      clearTimeout(callCtx._hangupWatcher);
      callCtx._hangupWatcher = null;
    }
    if (callCtx._firstCallerTurnTimer) {
      clearTimeout(callCtx._firstCallerTurnTimer);
      callCtx._firstCallerTurnTimer = null;
    }
    if (callCtx._proactiveGreetingTimer) {
      clearTimeout(callCtx._proactiveGreetingTimer);
      callCtx._proactiveGreetingTimer = null;
    }

    try {
      if (callCtx._txBuffer) {
        await callCtx._txBuffer.flushAll();
      }
      await finalizeCallSession(callCtx);

      // Always finalize the outbound mission if not already completed
      await finalizeOutboundMission(callCtx);

      if (callCtx.callSessionId) {
        generateAndSaveSummary(callCtx.callSessionId, callCtx.traceId).catch(() => {});
      }
    } catch (err) {
      log.error("outbound_stream_finalization_error", callCtx.traceId, err.message);
    } finally {
      callStore.remove(callCtx.traceId);
    }
  }

  function sendAudioToTwilio(mulawBase64) {
    if (twilioWs.readyState === WebSocket.OPEN && callCtx.streamSid) {
      if (!callCtx._firstAudioEmittedAt) {
        callCtx._firstAudioEmittedAt = Date.now();
        const sinceStart = callCtx._twilioStartAt ? callCtx._firstAudioEmittedAt - callCtx._twilioStartAt : null;
        const sinceTrigger = callCtx._firstTurnTriggeredAt ? callCtx._firstAudioEmittedAt - callCtx._firstTurnTriggeredAt : null;
        log.call("outbound_first_audio_emitted", callCtx.traceId,
          `since_twilio_start_ms=${sinceStart} since_first_turn_trigger_ms=${sinceTrigger}`);
      }
      twilioWs.send(JSON.stringify({
        event: "media",
        streamSid: callCtx.streamSid,
        media: { payload: mulawBase64 },
      }));
    }
  }

  function sendSilenceToTwilio() {
    if (twilioWs.readyState === WebSocket.OPEN && callCtx.streamSid) {
      twilioWs.send(JSON.stringify({
        event: "media",
        streamSid: callCtx.streamSid,
        media: { payload: SILENCE_200MS },
      }));
    }
  }

  callCtx._sendSilence = sendSilenceToTwilio;

  callCtx._hangup = (reason = "end_call") => {
    if (callCtx._hangupRequested) return;
    callCtx._hangupRequested = true;
    if (callCtx._hangupWatcher) {
      clearTimeout(callCtx._hangupWatcher);
      callCtx._hangupWatcher = null;
    }
    log.call("outbound_hangup_requested", callCtx.traceId, reason);
    if (geminiWs && geminiWs.readyState === WebSocket.OPEN) {
      geminiWs.close(1000, reason);
    }
    if (twilioWs.readyState === WebSocket.OPEN) {
      twilioWs.close(1000, reason);
    }
  };

  callCtx._requestHangup = (reason = "end_call") => {
    if (callCtx._hangupRequested) return;

    const requestedAt = Date.now();
    const QUIET_THRESHOLD_MS = 3500; // Increased from 2200 to give more audio buffer time
    const MAX_WAIT_MS = 12000; // Increased from 9000 to allow longer messages

    const waitForSpeechEnd = () => {
      if (callCtx._hangupRequested) return;

      const lastAssistantActivityAt = callCtx.lastAssistantActivityAt || 0;
      const quietForMs = lastAssistantActivityAt > 0
        ? Date.now() - lastAssistantActivityAt
        : Number.POSITIVE_INFINITY;
      const maxWaitReached = Date.now() - requestedAt >= MAX_WAIT_MS;

      if (quietForMs >= QUIET_THRESHOLD_MS || maxWaitReached) {
        if (maxWaitReached && quietForMs < QUIET_THRESHOLD_MS) {
          log.call("outbound_hangup_forced_after_timeout", callCtx.traceId, `${reason} quiet_for_ms=${quietForMs}`);
        } else {
          log.call("outbound_hangup_ready", callCtx.traceId, `${reason} quiet_for_ms=${quietForMs}`);
        }
        callCtx._hangup(reason);
        return;
      }

      callCtx._hangupWatcher = setTimeout(waitForSpeechEnd, 350);
    };

    const sinceStart = callCtx._twilioStartAt ? Date.now() - callCtx._twilioStartAt : null;
    log.call("outbound_hangup_deferred", callCtx.traceId, `${reason} since_start_ms=${sinceStart}`);
    callCtx._hangupWatcher = setTimeout(waitForSpeechEnd, 350);
  };

  twilioWs.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.event) {
        case "connected":
          log.call("outbound_stream_connected", callCtx.traceId);
          break;

        case "start": {
          callCtx.streamSid = msg.start.streamSid;
          callCtx.startedAt = new Date().toISOString();
          callCtx._twilioStartAt = Date.now();
          log.call("outbound_twilio_start_received", callCtx.traceId);

          // Extract outbound mission parameters
          const params = msg.start.customParameters || {};
          callCtx.missionId = params.missionId || null;
          callCtx.accountId = params.accountId || null;
          callCtx.callSessionId = params.callSessionId || null;
          callCtx.userName = params.userName || "Unknown";
          callCtx.missionObjective = params.objective ? decodeURIComponent(params.objective) : "";
          callCtx.missionTargetName = params.targetName || null;
          callCtx.missionTargetPhone = params.targetPhone || null;
          callCtx.contextFlexible = params.contextFlexible ? decodeURIComponent(params.contextFlexible) : "";
          callCtx.contextSecret = params.contextSecret ? decodeURIComponent(params.contextSecret) : "";
          callCtx.allowConsultUser = params.allowConsultUser === "true";

          try {
            callCtx.missionConstraints = params.constraintsJson
              ? JSON.parse(decodeURIComponent(params.constraintsJson))
              : {};
          } catch (_) {
            callCtx.missionConstraints = {};
          }

          log.call("outbound_call_started", callCtx.traceId,
            `mission=${callCtx.missionId} objective="${callCtx.missionObjective?.slice(0, 60)}"`);

          // Try to reuse pre-connected Gemini WS
          const preconnectKey = callCtx.missionId ? `preconnect:${callCtx.missionId}` : null;
          const preconnect = preconnectKey ? callStore.get(preconnectKey) : null;
          const preconnectCheckAt = Date.now();

          if (preconnect && preconnect.ws && preconnect.ws.readyState === WebSocket.OPEN && preconnect.ctx.geminiReady) {
            // Reuse the pre-warmed connection
            geminiWs = preconnect.ws;
            callStore.remove(preconnectKey);

            // Transfer context and attach audio callback
            geminiWs.setCallCtx(callCtx);
            geminiWs.setAudioCallback(sendAudioToTwilio);

            const preconnectAgeMs = preconnectCheckAt - preconnect.createdAt;
            const geminiReadyAt = preconnect.ctx._setupCompleteAt || 0;
            const sinceGeminiReady = geminiReadyAt ? preconnectCheckAt - geminiReadyAt : null;
            log.call("outbound_gemini_preconnect_reused", callCtx.traceId,
              `preconnect_age_ms=${preconnectAgeMs} since_gemini_ready_ms=${sinceGeminiReady}`);
          } else {
            // Fallback: clean up stale preconnect if any
            if (preconnect) {
              callStore.remove(preconnectKey);
              if (preconnect.ws && preconnect.ws.readyState === WebSocket.OPEN) {
                preconnect.ws.close(1000, "fallback_to_new_connection");
              }
              const wsState = preconnect.ws?.readyState || "unknown";
              const geminiReady = preconnect.ctx?.geminiReady || false;
              log.call("outbound_gemini_preconnect_not_ready", callCtx.traceId,
                `ws_state=${wsState} gemini_ready=${geminiReady}`);
            } else {
              log.call("outbound_gemini_preconnect_not_found", callCtx.traceId, `no_preconnect_in_store`);
            }

            // Connect to Gemini normally
            log.call("outbound_gemini_new_connection_starting", callCtx.traceId);
            geminiWs = connectOutboundGemini(callCtx, sendAudioToTwilio);
          }

          // Schedule proactive greeting trigger 400ms after Twilio start.
          // If the callee speaks first (caller transcription), cancel the timer
          // and let the natural flow handle the response.
          const PROACTIVE_GREETING_DELAY_MS = 400;
          callCtx._onCallerSpeechDetected = () => {
            if (callCtx._firstTurnTriggered) return;
            if (callCtx._proactiveGreetingTimer) {
              clearTimeout(callCtx._proactiveGreetingTimer);
              callCtx._proactiveGreetingTimer = null;
              const cancelledAt = Date.now();
              const sinceStart = cancelledAt - callCtx._twilioStartAt;
              log.call("outbound_proactive_greeting_cancelled", callCtx.traceId,
                `since_start_ms=${sinceStart}`);
            }
            callCtx._firstTurnTriggered = true;
          };

          log.call("outbound_proactive_greeting_scheduled", callCtx.traceId, `delay_ms=${PROACTIVE_GREETING_DELAY_MS}`);

          callCtx._proactiveGreetingTimer = setTimeout(() => {
            if (callCtx._firstTurnTriggered) return;
            if (!geminiWs || geminiWs.readyState !== WebSocket.OPEN) {
              log.call("outbound_proactive_greeting_skipped", callCtx.traceId, `ws_not_ready`);
              return;
            }
            callCtx._firstTurnTriggered = true;
            callCtx._firstTurnTriggeredAt = Date.now();
            try {
              geminiWs.send(JSON.stringify({
                realtimeInput: {
                  text: "Système : l'appelé vient de décrocher. Salue-le brièvement (une phrase courte), présente-toi comme l'assistant de l'utilisateur, puis enchaîne sur l'objectif. Si tu l'entends parler en même temps, laisse-le finir.",
                },
              }));
              const sinceStart = callCtx._firstTurnTriggeredAt - callCtx._twilioStartAt;
              log.call("outbound_first_turn_triggered", callCtx.traceId,
                `since_start_ms=${sinceStart}`);
            } catch (e) {
              log.error("outbound_first_turn_trigger_error", callCtx.traceId, e.message);
            }
          }, PROACTIVE_GREETING_DELAY_MS);

          break;
        }

        case "media": {
          if (!callCtx.geminiReady || !geminiWs || geminiWs.readyState !== WebSocket.OPEN) {
            if (!callCtx._firstMediaDroppedLogged) {
              callCtx._firstMediaDroppedLogged = true;
              log.call("outbound_media_dropped_gemini_not_ready", callCtx.traceId,
                `gemini_ready=${callCtx.geminiReady} ws_state=${geminiWs?.readyState || "null"}`);
            }
            return;
          }

          if (!callCtx._firstMediaReceivedAt) {
            callCtx._firstMediaReceivedAt = Date.now();
            const sinceStart = callCtx._firstMediaReceivedAt - callCtx._twilioStartAt;
            log.call("outbound_first_media_received", callCtx.traceId, `since_start_ms=${sinceStart}`);
          }

          const pcm8k = decodeMulaw(msg.media.payload);
          const pcm16k = upsample8to16(pcm8k);
          const pcmBase64 = int16ToBase64(pcm16k);

          geminiWs.send(JSON.stringify({
            realtimeInput: {
              audio: {
                data: pcmBase64,
                mimeType: "audio/pcm;rate=16000",
              },
            },
          }));
          break;
        }

        case "stop":
          log.call("outbound_call_ended_stop", callCtx.traceId);
          finalizeOnce();
          if (geminiWs) geminiWs.close(1000, "Call ended");
          break;

        default:
          break;
      }
    } catch (e) {
      log.error("outbound_twilio_message_error", callCtx.traceId, e.message);
    }
  });

  twilioWs.on("close", () => {
    log.call("outbound_stream_disconnected", callCtx.traceId);
    finalizeOnce();
    if (geminiWs) geminiWs.close(1000, "Twilio disconnected");
  });

  twilioWs.on("error", (err) => {
    log.error("outbound_twilio_ws_error", callCtx.traceId, err.message);
  });
}

module.exports = { handleOutboundStreamConnection };
