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
        callCtx.awaitingOutboundFirstTurn = true;
        callCtx.outboundFirstTurnTriggered = false;
        callCtx.pendingCallerTurnText = "";
        callCtx.lastAssistantActivityAt = 0;
        log.gemini("outbound_waiting_for_callee", traceId, "awaiting first caller utterance");

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
        if (callCtx.awaitingOutboundFirstTurn && hasMeaningfulCallerSpeech(text)) {
          scheduleOutboundFirstReply(ws, callCtx, traceId, text);
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
    clearFirstCallerTurnTimer(callCtx);
    callCtx.geminiReady = false;
    callCtx.awaitingOutboundFirstTurn = false;
    log.gemini("outbound_disconnected", traceId, `${code} ${reason}`);
  });

  ws.on("error", (err) => {
    log.error("outbound_gemini_ws_error", traceId, err.message);
  });

  return ws;
}

function hasMeaningfulCallerSpeech(text) {
  if (typeof text !== "string") return false;
  const normalized = text.replace(/\s+/g, " ").trim();
  return normalized.length >= 2 && /[\p{L}\p{N}]/u.test(normalized);
}

function clearFirstCallerTurnTimer(callCtx) {
  if (callCtx._firstCallerTurnTimer) {
    clearTimeout(callCtx._firstCallerTurnTimer);
    callCtx._firstCallerTurnTimer = null;
  }
}

function scheduleOutboundFirstReply(ws, callCtx, traceId, callerText) {
  if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
    return;
  }

  callCtx.pendingCallerTurnText = callerText.replace(/\s+/g, " ").trim();
  clearFirstCallerTurnTimer(callCtx);

  callCtx._firstCallerTurnTimer = setTimeout(() => {
    callCtx._firstCallerTurnTimer = null;

    if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
      return;
    }

    if (ws.readyState !== WebSocket.OPEN) {
      return;
    }

    callCtx.awaitingOutboundFirstTurn = false;
    callCtx.outboundFirstTurnTriggered = true;
    callCtx.firstCallerTurnObservedAt = new Date().toISOString();

    const kickoff = buildOutboundFirstReplyPrompt(callCtx.pendingCallerTurnText);
    ws.send(JSON.stringify({
      clientContent: {
        turns: [{ role: "user", parts: [{ text: kickoff }] }],
        turnComplete: true,
      },
    }));
    log.gemini("outbound_first_turn_detected", traceId, callCtx.pendingCallerTurnText);
    log.gemini("outbound_first_reply_triggered", traceId, kickoff);
  }, 600);
}

function buildOutboundFirstReplyPrompt(callerText) {
  const parts = [
    "La personne appelée vient de parler.",
    callerText ? `Dernière prise de parole entendue: \"${callerText.slice(0, 160)}\".` : null,
    "Attends la fin naturelle de sa phrase, puis réponds maintenant.",
    "Présente-toi brièvement, précise pour qui tu appelles, puis explique la raison de l'appel.",
  ];

  return parts.filter(Boolean).join(" ");
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
