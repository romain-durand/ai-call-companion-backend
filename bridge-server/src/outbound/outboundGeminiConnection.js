const WebSocket = require("ws");
const { GEMINI_API_KEY } = require("../config/env");
const { buildOutboundSetupPayload } = require("./outboundGeminiConfig");
const { base64ToInt16, downsample24to8, encodeToMulaw } = require("../audio/codec");
const { handleOutboundToolCall } = require("./outboundToolRouter");
const {
  primeOutboundFirstTurn,
  cleanupOutboundFirstTurn,
  observeOutboundCallerTranscription,
  markOutboundAssistantStarted,
} = require("./outboundFirstTurnGate");
const log = require("../observability/logger");

/**
 * Create a Gemini Live WebSocket connection for an outbound call.
 */
function connectOutboundGemini(callCtx, onAudio) {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const ws = new WebSocket(wsUrl);
  const { traceId } = callCtx;

  ws.on("open", () => {
    log.gemini("outbound_connected", traceId);
    const setupPayload = buildOutboundSetupPayload(callCtx);
    ws.send(JSON.stringify(setupPayload));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("outbound_setup_complete", traceId);
        callCtx.geminiReady = true;
        primeOutboundFirstTurn(callCtx, traceId);
        return;
      }

      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            callCtx.lastAssistantActivityAt = Date.now();

            if (!callCtx.outboundAudioGateOpen) {
              continue;
            }

            markOutboundAssistantStarted(callCtx, traceId);

            const pcm24k = base64ToInt16(part.inlineData.data);
            const pcm8k = downsample24to8(pcm24k);
            const mulawBase64 = encodeToMulaw(pcm8k);
            onAudio(mulawBase64);
          }
        }
      }

      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        log.transcript("🎤", "caller", traceId, text);
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("caller", text);
        }
        observeOutboundCallerTranscription(ws, callCtx, traceId, text);
      }

      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        callCtx.lastAssistantActivityAt = Date.now();
        if (callCtx.outboundAudioGateOpen) {
          markOutboundAssistantStarted(callCtx, traceId);
        }
        if (callCtx._txBuffer && callCtx.outboundAudioGateOpen) {
          callCtx._txBuffer.push("assistant", text);
        }
      }

      if (msg.toolCall?.functionCalls) {
        if (callCtx._txBuffer) callCtx._txBuffer.flush();

        Promise.all(
          msg.toolCall.functionCalls.map((call) => handleOutboundToolCall(call, traceId, callCtx))
        ).then((responses) => {
          ws.send(JSON.stringify({
            toolResponse: { functionResponses: responses },
          }));
        });
      }
    } catch (e) {
      log.error("outbound_gemini_message_error", traceId, e.message);
    }
  });

  ws.on("close", (code, reason) => {
    cleanupOutboundFirstTurn(callCtx);
    callCtx.geminiReady = false;
    log.gemini("outbound_disconnected", traceId, `${code} ${reason}`);
  });

  ws.on("error", (err) => {
    log.error("outbound_gemini_ws_error", traceId, err.message);
  });

  return ws;
}

module.exports = { connectOutboundGemini };
