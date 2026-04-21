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
    newCtx.geminiReady = callCtx.geminiReady;
    newCtx.lastAssistantActivityAt = callCtx.lastAssistantActivityAt || 0;
    callCtx = newCtx;
  };

  ws.on("open", () => {
    const openAt = Date.now();
    log.gemini("outbound_gemini_ws_open", traceId, `at=${openAt}`);
    const contextBlock = buildOutboundContext(callCtx);
    const setupPayload = buildOutboundSetupPayload(contextBlock, {
      allowConsultUser: !!callCtx.allowConsultUser,
    });
    ws.send(JSON.stringify(setupPayload));
    log.gemini("outbound_setup_payload_sent", traceId, `context_length=${JSON.stringify(setupPayload).length}`);
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        const setupCompleteAt = Date.now();
        callCtx._setupCompleteAt = setupCompleteAt;
        log.gemini("outbound_setup_complete", traceId, `setupCompleteAt=${setupCompleteAt}`);

        callCtx.geminiReady = true;
        callCtx.lastAssistantActivityAt = 0;

        // Primer: warm Gemini's audio pipeline without producing audio yet.
        try {
          ws.send(JSON.stringify({
            realtimeInput: {
              text: "Système : la connexion est prête. Tiens-toi prêt à saluer brièvement l'appelé dès qu'il décroche. N'émets aucun son tant que tu n'as pas reçu le signal de décrochage.",
            },
          }));
          log.gemini("outbound_primer_sent", traceId);
        } catch (e) {
          log.error("outbound_primer_error", traceId, e.message);
        }

        log.gemini("outbound_waiting_for_callee", traceId, `geminiReady=true`);
        return;
      }

      // Audio response
      if (msg.serverContent?.modelTurn?.parts) {
        let audioChunkCount = 0;
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            if (audioChunkCount === 0) {
              const audioAt = Date.now();
              log.gemini("outbound_audio_from_gemini_first", traceId, `at=${audioAt}`);
            }
            callCtx.lastAssistantActivityAt = Date.now();
            if (_onAudio) {
              const pcm24k = base64ToInt16(part.inlineData.data);
              const pcm8k = downsample24to8(pcm24k);
              const mulawBase64 = encodeToMulaw(pcm8k);
              _onAudio(mulawBase64);
            }
            audioChunkCount++;
          }
        }
        if (audioChunkCount > 0) {
          log.gemini("outbound_audio_parts_sent", traceId, `chunk_count=${audioChunkCount}`);
        }
      }

      // Transcriptions
      if (msg.serverContent?.inputTranscription?.text) {
        const text = msg.serverContent.inputTranscription.text;
        const transcribedAt = Date.now();
        log.transcript("🎤", "caller", traceId, text);
        log.gemini("outbound_caller_transcription_received", traceId, `at=${transcribedAt}`);
        if (callCtx._onCallerSpeechDetected) {
          try { callCtx._onCallerSpeechDetected(); } catch (_) {}
        }
        if (callCtx._txBuffer) {
          callCtx._txBuffer.push("caller", text);
        }
      }
      if (msg.serverContent?.outputTranscription?.text) {
        const text = msg.serverContent.outputTranscription.text;
        const assistantAt = Date.now();
        callCtx.lastAssistantActivityAt = assistantAt;
        log.transcript("🤖", "assistant", traceId, text);
        log.gemini("outbound_assistant_transcription_received", traceId, `at=${assistantAt}`);
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

  if (callCtx.contextFlexible) {
    parts.push("");
    parts.push("FLEXIBLE CONTEXT (you know this but do NOT volunteer it — only use if the situation requires it):");
    parts.push(callCtx.contextFlexible);
  }

  if (callCtx.contextSecret) {
    parts.push("");
    parts.push("CONFIDENTIAL CONTEXT (you know this but must NEVER reveal it to the other party under any circumstance):");
    parts.push(callCtx.contextSecret);
  }

  parts.push("", "Instruction: Accomplish the mission objective. Be natural and polite.");

  return parts.join("\n");
}

module.exports = { connectOutboundGemini };
