const WebSocket = require("ws");
const { GEMINI_API_KEY } = require("../config/env");
const { buildSetupPayload } = require("./geminiConfig");
const { base64ToInt16, downsample24to8, encodeToMulaw } = require("../audio/codec");
const { handleToolCall } = require("../tools/toolRouter");
const { buildRuntimeContext } = require("../context/runtimeContextBuilder");
const log = require("../observability/logger");

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

        // Build and inject runtime context, then trigger greeting
        buildRuntimeContext(callCtx)
          .then((contextBlock) => {
            // Inject runtime context as user-role text (not spoken, influences behavior)
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: contextBlock }],
                  },
                ],
                turnComplete: true,
              },
            }));
            log.gemini("runtime_context_injected", traceId);

            // Now trigger the greeting
            const kickoffText = "L'appel vient de commencer. Présente-toi immédiatement puis attends la réponse de l'appelant.";
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: kickoffText }],
                  },
                ],
                turnComplete: true,
              },
            }));
            log.gemini("initial_greeting_triggered", traceId, kickoffText);

            // Audio gate: block mic for 3s to let greeting play uninterrupted
            log.gemini("mic_gate_started", traceId, "3000ms");
            setTimeout(() => {
              callCtx.geminiReady = true;
              log.gemini("mic_gate_ended", traceId);
            }, 3000);
          })
          .catch((err) => {
            log.error("runtime_context_injection_failed", traceId, err.message);
            // Fallback: proceed without context
            const kickoffText = "L'appel vient de commencer. Présente-toi immédiatement puis attends la réponse de l'appelant.";
            ws.send(JSON.stringify({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: kickoffText }],
                  },
                ],
                turnComplete: true,
              },
            }));
            log.gemini("initial_greeting_triggered", traceId, "fallback (no context)");
            setTimeout(() => {
              callCtx.geminiReady = true;
            }, 3000);
          });

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

      // Transcriptions — push to buffer (not directly to DB)
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        log.transcript("🎤", "caller", traceId, text);
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("caller", text);
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        log.transcript("🤖", "assistant", traceId, text);
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("assistant", text);
        }
      }

      // Tool calls — flush buffer before tool boundary
      if (msg.toolCall?.functionCalls) {
        if (callCtx._txBuffer) callCtx._txBuffer.flush();

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
