const WebSocket = require("ws");
const { decodeMulaw, upsample8to16, int16ToBase64 } = require("../audio/codec");
const { connectGemini } = require("../gemini/geminiConnection");
const { createCallContext } = require("../calls/callContext");
const callStore = require("../calls/callStateStore");
const log = require("../observability/logger");
const { createInboundCallSession, finalizeCallSession } = require("../db/callSessionsRepo");
const { generateAndSaveSummary } = require("../db/callSummaryRepo");
const { createTranscriptBuffer } = require("../db/transcriptBuffer");

/**
 * Handle a new Twilio Media Stream WebSocket connection.
 */
function handleTwilioConnection(twilioWs) {
  const callCtx = createCallContext();
  callCtx._txBuffer = createTranscriptBuffer(callCtx);
  callStore.set(callCtx.traceId, callCtx);
  log.call("new_connection", callCtx.traceId);

  let geminiWs = null;

  // Single finalization helper — guaranteed to run at most once
  async function finalizeOnce() {
    if (callCtx.finalized) {
      log.call("call_session_finalize_skipped", callCtx.traceId, "already finalized");
      return;
    }
    callCtx.finalized = true; // set BEFORE async work to prevent races

    if (callCtx._txBuffer) {
      await callCtx._txBuffer.flushAll();
    }
    await finalizeCallSession(callCtx);
    callStore.remove(callCtx.traceId);
  }

  // Callback: send audio from Gemini back to Twilio
  function sendAudioToTwilio(mulawBase64) {
    if (twilioWs.readyState === WebSocket.OPEN && callCtx.streamSid) {
      twilioWs.send(JSON.stringify({
        event: "media",
        streamSid: callCtx.streamSid,
        media: { payload: mulawBase64 },
      }));
    }
  }

  twilioWs.on("message", (message) => {
    try {
      const msg = JSON.parse(message.toString());

      switch (msg.event) {
        case "connected":
          log.call("stream_connected", callCtx.traceId);
          break;

        case "start": {
          callCtx.streamSid = msg.start.streamSid;
          callCtx.callerNumber = msg.start.customParameters?.callerNumber || "unknown";
          callCtx.providerCallId = msg.start.customParameters?.providerCallId || msg.start.customParameters?.CallSid || msg.start.callSid || null;
          callCtx.accountId = msg.start.customParameters?.accountId || null;
          callCtx.phoneNumberId = msg.start.customParameters?.phoneNumberId || null;
          callCtx.profileId = msg.start.customParameters?.profileId || null;
          callCtx.activeModeId = msg.start.customParameters?.activeModeId || null;
          callCtx.startedAt = new Date().toISOString();

          log.call("call_started", callCtx.traceId, `StreamSid: ${callCtx.streamSid}, Caller: ${callCtx.callerNumber}`);

          createInboundCallSession(callCtx).then((sessionId) => {
            if (sessionId) callCtx.callSessionId = sessionId;
          });

          geminiWs = connectGemini(callCtx, sendAudioToTwilio);
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
          log.call("call_ended_stop", callCtx.traceId);
          finalizeOnce();
          if (geminiWs) geminiWs.close(1000, "Call ended");
          break;

        default:
          break;
      }
    } catch (e) {
      log.error("twilio_message_error", callCtx.traceId, e.message);
    }
  });

  twilioWs.on("close", () => {
    log.call("stream_disconnected", callCtx.traceId);
    finalizeOnce();
    if (geminiWs) geminiWs.close(1000, "Twilio disconnected");
  });

  twilioWs.on("error", (err) => {
    log.error("twilio_ws_error", callCtx.traceId, err.message);
  });
}

module.exports = { handleTwilioConnection };
