const WebSocket = require("ws");
const { GEMINI_API_KEY } = require("../config/env");
const { buildOutboundSetupPayload } = require("./outboundGeminiConfig");
const { base64ToInt16, downsample24to8, encodeToMulaw } = require("../audio/codec");
const { handleOutboundToolCall } = require("./outboundToolRouter");
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
    const setupPayload = buildOutboundSetupPayload();
    ws.send(JSON.stringify(setupPayload));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("outbound_setup_complete", traceId);

        // Inject mission context
        const contextBlock = buildOutboundContext(callCtx);
        ws.send(JSON.stringify({
          realtimeInput: { text: contextBlock },
        }));
        log.gemini("outbound_context_injected", traceId, contextBlock);

        // Trigger the outbound greeting
        const kickoff = "L'appel vient d'être connecté. La personne vient de décrocher. Présente-toi immédiatement et explique la raison de ton appel.";
        ws.send(JSON.stringify({
          realtimeInput: { text: kickoff },
        }));

        // Audio gate
        setTimeout(() => {
          callCtx.geminiReady = true;
          log.gemini("outbound_mic_gate_ended", traceId);
        }, 3000);

        return;
      }

      // Audio response
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            const pcm24k = base64ToInt16(part.inlineData.data);
            const pcm8k = downsample24to8(pcm24k);
            const mulawBase64 = encodeToMulaw(pcm8k);
            onAudio(mulawBase64);
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
