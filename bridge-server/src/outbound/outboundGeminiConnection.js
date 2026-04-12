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
    // Pass callCtx so mission context is baked into the system instruction
    const setupPayload = buildOutboundSetupPayload(callCtx);
    ws.send(JSON.stringify(setupPayload));
  });

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.setupComplete) {
        log.gemini("outbound_setup_complete", traceId);

        // No context injection here — it's in the system instruction.
        // No realtimeInput.text that would trigger Gemini to speak.

        callCtx.geminiReady = true;
        callCtx.awaitingOutboundFirstTurn = true;
        callCtx.outboundFirstTurnTriggered = false;
        callCtx.outboundAudioGateOpen = false; // Block audio output until callee speaks
        callCtx.outboundIntroPending = false;
        clearOutboundCallerAudioSuppression(callCtx);
        callCtx.pendingCallerTurnText = "";
        callCtx.lastAssistantActivityAt = 0;
        log.gemini("outbound_waiting_for_callee", traceId, "audio gate CLOSED, awaiting callee speech");

        return;
      }

      // Audio response — only forward to Twilio if audio gate is open
      if (msg.serverContent?.modelTurn?.parts) {
        for (const part of msg.serverContent.modelTurn.parts) {
          if (part.inlineData?.data) {
            callCtx.lastAssistantActivityAt = Date.now();

            if (!callCtx.outboundAudioGateOpen) {
              // Gemini is trying to speak before callee answered — swallow it
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
        if (callCtx.outboundAudioGateOpen) {
          markOutboundAssistantStarted(callCtx, traceId);
        }
        if (callCtx._txBuffer && callCtx.outboundAudioGateOpen) {
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
    clearOutboundCallerAudioSuppression(callCtx);
    callCtx.outboundIntroPending = false;
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

function clearOutboundCallerAudioSuppression(callCtx) {
  if (callCtx._outboundSuppressCallerAudioTimer) {
    clearTimeout(callCtx._outboundSuppressCallerAudioTimer);
    callCtx._outboundSuppressCallerAudioTimer = null;
  }
  callCtx.outboundSuppressCallerAudio = false;
}

function armOutboundCallerAudioSuppression(callCtx, traceId) {
  clearOutboundCallerAudioSuppression(callCtx);
  callCtx.outboundSuppressCallerAudio = true;
  log.gemini("outbound_caller_audio_suppressed", traceId, "waiting for assistant intro");

  callCtx._outboundSuppressCallerAudioTimer = setTimeout(() => {
    callCtx._outboundSuppressCallerAudioTimer = null;
    if (!callCtx.outboundSuppressCallerAudio) {
      return;
    }

    callCtx.outboundSuppressCallerAudio = false;
    callCtx.outboundIntroPending = false;
    log.gemini("outbound_caller_audio_resumed", traceId, "intro wait timeout");
  }, 5000);
}

function markOutboundAssistantStarted(callCtx, traceId) {
  if (!callCtx.outboundIntroPending && !callCtx.outboundSuppressCallerAudio) {
    return;
  }

  clearOutboundCallerAudioSuppression(callCtx);
  if (callCtx.outboundIntroPending) {
    callCtx.outboundIntroPending = false;
    log.gemini("outbound_intro_started", traceId);
  }
}

/**
 * After detecting meaningful callee speech, wait 2.5s then:
 * 1. Open the audio gate
 * 2. Send the [CALLEE_READY] signal so Gemini starts its introduction
 */
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
    callCtx.outboundAudioGateOpen = true; // NOW allow audio through
    callCtx.outboundIntroPending = true;
    armOutboundCallerAudioSuppression(callCtx, traceId);
    callCtx.firstCallerTurnObservedAt = new Date().toISOString();

    // Send the [CALLEE_READY] signal using the same realtime text format as the inbound flow.
    const signal = `[CALLEE_READY] L'interlocuteur a décroché et a dit : "${callCtx.pendingCallerTurnText.slice(0, 160)}". Marque une courte pause naturelle, puis présente-toi calmement et explique l'objet de l'appel.`;
    ws.send(JSON.stringify({
      realtimeInput: {
        text: signal,
      },
    }));

    log.gemini("outbound_first_turn_detected", traceId, callCtx.pendingCallerTurnText);
    log.gemini("outbound_audio_gate_opened", traceId, "callee ready signal sent");
  }, 800);
}

module.exports = { connectOutboundGemini };
