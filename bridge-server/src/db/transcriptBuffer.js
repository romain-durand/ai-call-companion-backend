const log = require("../observability/logger");
const { appendCallMessage } = require("./callMessagesRepo");

/**
 * In-memory transcript buffer for a single call.
 * Maintains ONE active speaker buffer at a time.
 * Flushes on speaker change, tool boundary, or call end.
 *
 * KEY INVARIANT: speaker + chunks are always captured together
 * before any overwrite, so a deferred flush never mixes speakers.
 */
function createTranscriptBuffer(callCtx) {
  const buf = {
    currentSpeaker: null,
    chunks: [],
    lastFlushedSpeaker: null,
    lastFlushedText: null,
    _flushPromise: Promise.resolve(),
  };

  /**
   * Flush a specific snapshot (speaker + text) to DB.
   * Called with already-captured values to avoid race conditions.
   */
  async function flushSnapshot(speaker, text) {
    if (!speaker || !text) return;

    // Dedup: skip if identical to last flush
    if (speaker === buf.lastFlushedSpeaker && text === buf.lastFlushedText) {
      log.call("transcript_dedup_skip", callCtx.traceId, `${speaker}: "${text.slice(0, 40)}…"`);
      return;
    }

    buf.lastFlushedSpeaker = speaker;
    buf.lastFlushedText = text;

    log.call("transcript_flush", callCtx.traceId, `${speaker}: "${text.slice(0, 60)}…"`);
    await appendCallMessage(callCtx, speaker, text);
  }

  /**
   * Capture and clear the current buffer atomically.
   * Returns { speaker, text } or null if nothing to flush.
   */
  function captureAndClear() {
    if (!buf.currentSpeaker || buf.chunks.length === 0) return null;

    const speaker = buf.currentSpeaker;
    const text = buf.chunks.join(" ").replace(/\s+/g, " ").trim();
    buf.chunks = [];
    buf.currentSpeaker = null;

    if (!text) return null;
    return { speaker, text };
  }

  /**
   * Add a transcription chunk. Flushes on speaker change.
   */
  function push(speaker, text) {
    if (!text || !text.trim()) return;

    // (verbose — disabled to reduce log noise)

    // Speaker changed → capture previous buffer NOW, then chain flush
    if (buf.currentSpeaker && buf.currentSpeaker !== speaker) {
      const snapshot = captureAndClear();
      if (snapshot) {
        buf._flushPromise = buf._flushPromise.then(() =>
          flushSnapshot(snapshot.speaker, snapshot.text)
        );
      }
    }

    buf.currentSpeaker = speaker;
    buf.chunks.push(text.trim());
  }

  /**
   * Flush everything remaining (call end / tool boundary).
   */
  async function flushAll() {
    // Capture current buffer
    const snapshot = captureAndClear();
    if (snapshot) {
      buf._flushPromise = buf._flushPromise.then(() =>
        flushSnapshot(snapshot.speaker, snapshot.text)
      );
    }
    // Wait for all pending flushes
    await buf._flushPromise;
  }

  /**
   * Flush current buffer synchronously-chained (for tool boundaries).
   */
  function flush() {
    const snapshot = captureAndClear();
    if (snapshot) {
      buf._flushPromise = buf._flushPromise.then(() =>
        flushSnapshot(snapshot.speaker, snapshot.text)
      );
    }
  }

  return { push, flush, flushAll };
}

module.exports = { createTranscriptBuffer };
