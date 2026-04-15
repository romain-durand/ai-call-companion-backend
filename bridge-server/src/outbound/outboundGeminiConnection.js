const WebSocket = require("ws");
const { GEMINI_API_KEY } = require("../config/env");
const { buildOutboundSetupPayload } = require("./outboundGeminiConfig");
const { base64ToInt16, downsample24to8, encodeToMulaw } = require("../audio/codec");
const { handleOutboundToolCall } = require("./outboundToolRouter");
const log = require("../observability/logger");

/**
 * Create a Gemini Live WebSocket connection for an outbound call.
 * onAudio can be null initially — use ws.setAudioCallback(fn) to attach later.
 */
function connectOutboundGemini(callCtx, onAudio) {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const ws = new WebSocket(wsUrl);
  const { traceId } = callCtx;

  // Mutable audio callback — can be set/changed after connection
  let _onAudio = onAudio || null;

  /**
   * Attach or replace the audio callback after connection.
   */
  ws.setAudioCallback = function (fn) {
    _onAudio = fn;
  };

  /**
   * Replace the callCtx reference used by this connection.
   * Preserves geminiReady and other connection-level state.
   */
  ws.setCallCtx = function (newCtx) {
    // Copy connection-level state to the new context
    newCtx.geminiReady = callCtx.geminiReady;
    newCtx.awaitingOutboundFirstTurn = callCtx.awaitingOutboundFirstTurn;
    newCtx.outboundFirstTurnTriggered = callCtx.outboundFirstTurnTriggered;
    newCtx.pendingCallerTurnText = callCtx.pendingCallerTurnText || "";
    newCtx.lastAssistantActivityAt = callCtx.lastAssistantActivityAt || 0;
    callCtx = newCtx;
  };

  ws.on("open", () => {
    log.gemini("outbound_connected", traceId);
    const contextBlock = buildOutboundContext(callCtx);
    const setupPayload = buildOutboundSetupPayload(contextBlock);
    ws.send(JSON.stringify(setupPayload));
    log.gemini("outbound_context_injected", traceId, contextBlock);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("outbound_setup_complete", traceId);

        callCtx.geminiReady = true;
        callCtx.lastAssistantActivityAt = 0;
        log.gemini("outbound_waiting_for_callee", traceId, "Gemini will respond naturally to audio");

        return;
      }

      // Audio response
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            callCtx.lastAssistantActivityAt = Date.now();
            if (_onAudio) {
              const pcm24k = base64ToInt16(part.inlineData.data);
              const pcm8k = downsample24to8(pcm24k);
              const mulawBase64 = encodeToMulaw(pcm8k);
              _onAudio(mulawBase64);
            }
          }
        }
      }

      // Transcriptions
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        log.transcript("🎤", "caller", traceId, text);
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("caller", text);
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        callCtx.lastAssistantActivityAt = Date.now();
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("assistant", text);
        }
      }

      // Tool calls
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
    callCtx.geminiReady = false;
    log.gemini("outbound_disconnected", traceId, `${code} ${reason}`);
  });

  ws.on("error", (err) => {
    log.error("outbound_gemini_ws_error", traceId, err.message);
  });

  return ws;
}


/**
 * Build the outbound mission context block.
 */
function buildOutboundContext(callCtx) {
  const parts = [
    "OUTBOUND MISSION CONTEXT",
    `User name: ${callCtx.userName || "Unknown"}`,
    `Mission objective: ${callCtx.missionObjective || "Not specified"}`,
    `Target name: ${callCtx.missionTargetName || "Unknown"}`,
    `Target phone: ${callCtx.missionTargetPhone || "Unknown"}`,
  ];

  if (callCtx.missionConstraints && Object.keys(callCtx.missionConstraints).length > 0) {
    parts.push(`Constraints: ${JSON.stringify(callCtx.missionConstraints)}`);
  }

  parts.push("", "Instruction: Accomplish the mission objective. Be natural and polite.");

  return parts.join("\n");
}

module.exports = { connectOutboundGemini };
