const WebSocket = require("ws");
const { GEMINI_API_KEY } = require("../config/env");
const { buildSetupPayload } = require("./geminiConfig");
const { base64ToInt16, downsample24to8, encodeToMulaw } = require("../audio/codec");
const { handleToolCall } = require("../tools/toolRouter");
const log = require("../observability/logger");
const { appendCallMessage } = require("../db/callMessagesRepo");

/**
 * Create and manage a Gemini Live WebSocket connection for one call.
 */
function connectGemini(callCtx, onAudio) {
  const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${GEMINI_API_KEY}`;
  const ws = new WebSocket(wsUrl);
  const { traceId } = callCtx;

  ws.on("open", () => {
    log.gemini("connected", traceId);
    ws.send(JSON.stringify(buildSetupPayload()));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("setup_complete", traceId);

        const kickoffText = "L'appel vient de commencer. Présente-toi immédiatement puis attends la réponse de l'appelant.";
        const kickoffPayload = {
          realtimeInput: {
            text: kickoffText,
          },
        };
        ws.send(JSON.stringify(kickoffPayload));
        log.gemini("initial_greeting_triggered", traceId, kickoffText);
        console.log("Kickoff payload sent:", JSON.stringify(kickoffPayload));

        log.gemini("mic_gate_started", traceId, "3000ms");
        setTimeout(() => {
          callCtx.geminiReady = true;
          log.gemini("mic_gate_ended", traceId);
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
            log.gemini("assistant_audio_sent", traceId);
          }
        }
      }

      // Transcriptions — persist to DB
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        log.transcript("🎤", "caller", traceId, text);
        appendCallMessage(callCtx, "caller", text);
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        log.transcript("🤖", "assistant", traceId, text);
        appendCallMessage(callCtx, "assistant", text);
      }

      // Tool calls
      if (msg.toolCall?.functionCalls) {
        Promise.all(
          msg.toolCall.functionCalls.map((call) => handleToolCall(call, traceId, callCtx))
        ).then((responses) => {
          ws.send(JSON.stringify({
            toolResponse: { functionResponses: responses },
          }));
        });
      }
    } catch (e) {
      log.error("gemini_message_error", traceId, e.message);
    }
  });

  ws.on("close", (code, reason) => {
    callCtx.geminiReady = false;
    log.gemini("disconnected", traceId, `${code} ${reason}`);
  });

  ws.on("error", (err) => {
    log.error("gemini_ws_error", traceId, err.message);
  });

  return ws;
}

module.exports = { connectGemini };
