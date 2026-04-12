const WebSocket = require("ws");
const log = require("../observability/logger");

const OUTBOUND_SPEECH_AVG_THRESHOLD = 700;
const OUTBOUND_SPEECH_PEAK_THRESHOLD = 2600;
const OUTBOUND_POST_SPEECH_SILENCE_MS = 240;
const OUTBOUND_TRANSCRIPT_FALLBACK_MS = 700;
const OUTBOUND_INTRO_SUPPRESSION_TIMEOUT_MS = 5000;

function normalizeCallerText(text) {
  if (typeof text !== "string") return "";
  return text.replace(/\s+/g, " ").trim();
}

function hasMeaningfulCallerSpeech(text) {
  const normalized = normalizeCallerText(text);
  return normalized.length >= 2 && /[\p{L}\p{N}]/u.test(normalized);
}

function analyzePcmLevel(pcm8k) {
  if (!pcm8k || pcm8k.length === 0) {
    return { avgAbs: 0, peakAbs: 0 };
  }

  let sumAbs = 0;
  let peakAbs = 0;

  for (let i = 0; i < pcm8k.length; i += 1) {
    const abs = Math.abs(pcm8k[i]);
    sumAbs += abs;
    if (abs > peakAbs) {
      peakAbs = abs;
    }
  }

  return {
    avgAbs: sumAbs / pcm8k.length,
    peakAbs,
  };
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

function resetOutboundSpeechObservation(callCtx) {
  callCtx._outboundSpeechArmed = false;
  callCtx._outboundSpeechSeen = false;
  callCtx._outboundLastSpeechAt = 0;
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
  }, OUTBOUND_INTRO_SUPPRESSION_TIMEOUT_MS);
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

function triggerOutboundFirstReply(ws, callCtx, traceId, source) {
  if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
    return;
  }

  if (ws.readyState !== WebSocket.OPEN) {
    return;
  }

  clearFirstCallerTurnTimer(callCtx);
  callCtx.awaitingOutboundFirstTurn = false;
  callCtx.outboundFirstTurnTriggered = true;
  callCtx.outboundAudioGateOpen = true;
  callCtx.outboundIntroPending = true;
  armOutboundCallerAudioSuppression(callCtx, traceId);
  if (!callCtx.firstCallerTurnObservedAt) {
    callCtx.firstCallerTurnObservedAt = new Date().toISOString();
  }

  const callerSnippet = callCtx.pendingCallerTurnText
    ? ` et a dit : "${callCtx.pendingCallerTurnText.slice(0, 160)}"`
    : "";
  const signal = `[CALLEE_READY] L'interlocuteur a décroché${callerSnippet}. Présente-toi immédiatement et explique l'objet de l'appel.`;

  ws.send(JSON.stringify({
    realtimeInput: {
      text: signal,
    },
  }));

  log.gemini("outbound_first_turn_detected", traceId, callCtx.pendingCallerTurnText || source);
  log.gemini("outbound_audio_gate_opened", traceId, `${source}: callee ready signal sent`);
  resetOutboundSpeechObservation(callCtx);
}

function scheduleTranscriptFallback(ws, callCtx, traceId) {
  if (callCtx._firstCallerTurnTimer) {
    return;
  }

  callCtx._firstCallerTurnTimer = setTimeout(() => {
    callCtx._firstCallerTurnTimer = null;

    if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
      return;
    }

    const quietForMs = callCtx._outboundLastSpeechAt
      ? Date.now() - callCtx._outboundLastSpeechAt
      : Number.POSITIVE_INFINITY;

    if (callCtx._outboundSpeechSeen && quietForMs < OUTBOUND_POST_SPEECH_SILENCE_MS) {
      scheduleTranscriptFallback(ws, callCtx, traceId);
      return;
    }

    triggerOutboundFirstReply(ws, callCtx, traceId, "transcript_fallback");
  }, OUTBOUND_TRANSCRIPT_FALLBACK_MS);
}

function primeOutboundFirstTurn(callCtx, traceId) {
  clearFirstCallerTurnTimer(callCtx);
  clearOutboundCallerAudioSuppression(callCtx);
  resetOutboundSpeechObservation(callCtx);

  callCtx.awaitingOutboundFirstTurn = true;
  callCtx.outboundFirstTurnTriggered = false;
  callCtx.outboundAudioGateOpen = false;
  callCtx.outboundIntroPending = false;
  callCtx.pendingCallerTurnText = "";
  callCtx.firstCallerTurnObservedAt = null;
  callCtx.lastAssistantActivityAt = 0;

  log.gemini("outbound_waiting_for_callee", traceId, "audio gate CLOSED, awaiting callee speech");
}

function cleanupOutboundFirstTurn(callCtx) {
  clearFirstCallerTurnTimer(callCtx);
  clearOutboundCallerAudioSuppression(callCtx);
  resetOutboundSpeechObservation(callCtx);
  callCtx.outboundIntroPending = false;
  callCtx.awaitingOutboundFirstTurn = false;
}

function observeOutboundCallerTranscription(ws, callCtx, traceId, text) {
  if (!hasMeaningfulCallerSpeech(text)) {
    return;
  }

  callCtx.pendingCallerTurnText = normalizeCallerText(text);

  if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
    return;
  }

  if (!callCtx.firstCallerTurnObservedAt) {
    callCtx.firstCallerTurnObservedAt = new Date().toISOString();
  }

  if (!callCtx._outboundSpeechArmed) {
    callCtx._outboundSpeechArmed = true;
    log.gemini("outbound_callee_detected", traceId, callCtx.pendingCallerTurnText);
  }

  scheduleTranscriptFallback(ws, callCtx, traceId);

  const quietForMs = callCtx._outboundLastSpeechAt
    ? Date.now() - callCtx._outboundLastSpeechAt
    : Number.POSITIVE_INFINITY;

  if (callCtx._outboundSpeechSeen && quietForMs >= OUTBOUND_POST_SPEECH_SILENCE_MS) {
    triggerOutboundFirstReply(ws, callCtx, traceId, "voice_pause");
  }
}

function observeOutboundCallerAudio(ws, callCtx, traceId, pcm8k) {
  if (callCtx.outboundFirstTurnTriggered || !callCtx.awaitingOutboundFirstTurn) {
    return;
  }

  const { avgAbs, peakAbs } = analyzePcmLevel(pcm8k);
  const isSpeechFrame = avgAbs >= OUTBOUND_SPEECH_AVG_THRESHOLD || peakAbs >= OUTBOUND_SPEECH_PEAK_THRESHOLD;
  const now = Date.now();

  if (isSpeechFrame) {
    callCtx._outboundSpeechSeen = true;
    callCtx._outboundLastSpeechAt = now;
    return;
  }

  if (!callCtx._outboundSpeechArmed || !callCtx._outboundSpeechSeen || !callCtx._outboundLastSpeechAt) {
    return;
  }

  if (now - callCtx._outboundLastSpeechAt < OUTBOUND_POST_SPEECH_SILENCE_MS) {
    return;
  }

  triggerOutboundFirstReply(ws, callCtx, traceId, "voice_pause");
}

module.exports = {
  primeOutboundFirstTurn,
  cleanupOutboundFirstTurn,
  observeOutboundCallerTranscription,
  observeOutboundCallerAudio,
  markOutboundAssistantStarted,
};
