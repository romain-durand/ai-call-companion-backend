const WebSocket = require("ws");
const { decodeMulaw, upsample8to16, int16ToBase64, SILENCE_200MS } = require("../audio/codec");
const { connectOutboundGemini } = require("./outboundGeminiConnection");
const { createCallContext } = require("../calls/callContext");
const callStore = require("../calls/callStateStore");
const { createTranscriptBuffer } = require("../db/transcriptBuffer");
const { finalizeCallSession } = require("../db/callSessionsRepo");
const { generateAndSaveSummary } = require("../db/callSummaryRepo");
const log = require("../observability/logger");

/**
 * Handle a Twilio Media Stream WebSocket for an outbound call.
 * Similar to handleTwilioConnection but uses outbound Gemini config.
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

    if (callCtx._txBuffer) {
      await callCtx._txBuffer.flushAll();
    }
    await finalizeCallSession(callCtx);
    if (callCtx.callSessionId) {
      generateAndSaveSummary(callCtx.callSessionId, callCtx.traceId).catch(() => {});
    }
    callStore.remove(callCtx.traceId);
  }

  function sendAudioToTwilio(mulawBase64) {
    if (twilioWs.readyState === WebSocket.OPEN && callCtx.streamSid) {
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
    const waitForSpeechEnd = () => {
      if (callCtx._hangupRequested) return;

      const lastAssistantActivityAt = callCtx.lastAssistantActivityAt || 0;
      const quietForMs = lastAssistantActivityAt > 0
        ? Date.now() - lastAssistantActivityAt
        : Number.POSITIVE_INFINITY;
      const maxWaitReached = Date.now() - requestedAt >= 9000;

      if (quietForMs >= 2200 || maxWaitReached) {
        if (maxWaitReached && quietForMs < 2200) {
          log.call("outbound_hangup_forced_after_timeout", callCtx.traceId, reason);
        }
        callCtx._hangup(reason);
        return;
      }

      callCtx._hangupWatcher = setTimeout(waitForSpeechEnd, 350);
    };

    log.call("outbound_hangup_deferred", callCtx.traceId, reason);
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

          // Extract outbound mission parameters
          const params = msg.start.customParameters || {};
          callCtx.missionId = params.missionId || null;
          callCtx.accountId = params.accountId || null;
          callCtx.callSessionId = params.callSessionId || null;
          callCtx.userName = params.userName || "Unknown";
          callCtx.missionObjective = params.objective ? decodeURIComponent(params.objective) : "";
          callCtx.missionTargetName = params.targetName || null;
          callCtx.missionTargetPhone = params.targetPhone || null;

          try {
            callCtx.missionConstraints = params.constraintsJson
              ? JSON.parse(decodeURIComponent(params.constraintsJson))
              : {};
          } catch (_) {
            callCtx.missionConstraints = {};
          }

          log.call("outbound_call_started", callCtx.traceId,
            `mission=${callCtx.missionId} objective="${callCtx.missionObjective?.slice(0, 60)}"`);

          // Connect to Gemini with outbound config
          geminiWs = connectOutboundGemini(callCtx, sendAudioToTwilio);
          break;
        }

        case "media":
          if (!callCtx.geminiReady || !geminiWs || geminiWs.readyState !== WebSocket.OPEN) return;

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
