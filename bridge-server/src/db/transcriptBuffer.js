const log = require("../observability/logger");
const { appendCallMessage } = require("./callMessagesRepo");

/**
 * In-memory transcript buffer for a single call.
 * Accumulates partial transcription chunks per speaker and flushes
 * a single clean call_message row when:
 *   - the speaker changes
 *   - flushAll() is called (call end / tool boundary)
 *   - a stability timeout fires (optional, not used in MVP)
 *
 * Lives on callCtx._txBuffer — one per call, garbage-collected on disconnect.
 */

function createTranscriptBuffer(callCtx) {
  const buf = {
    currentSpeaker: null,
    chunks: [],
    lastFlushedSpeaker: null,
    lastFlushedText: null,
    flushing: false,
  };

  /**
   * Flush the current buffer to the DB as one call_message row.
   * Returns a promise (non-blocking in practice).
   */
  async function flush() {
    if (!buf.currentSpeaker || buf.chunks.length === 0) return;

    const speaker = buf.currentSpeaker;
    const text = buf.chunks.join(" ").replace(/\s+/g, " ").trim();

    // Reset buffer immediately so new chunks can accumulate
    buf.chunks = [];
    buf.currentSpeaker = null;

    if (!text) return;

    // Dedup: skip if identical to last flushed message
    const dedupKey = `${speaker}:${text}`;
    if (dedupKey === buf.lastFlushedKey) {
      log.call("transcript_dedup_skip", callCtx.traceId, `${speaker}: "${text.slice(0, 40)}…"`);
      return;
    }
    buf.lastFlushedKey = dedupKey;

    log.call("transcript_flush", callCtx.traceId, `${speaker}: "${text.slice(0, 60)}…"`);
    await appendCallMessage(callCtx, speaker, text);
  }

  /**
   * Add a transcription chunk. Flushes automatically on speaker change.
   */
  function push(speaker, text) {
    if (!text || !text.trim()) return;

    // Speaker changed → flush previous speaker's buffer first
    if (buf.currentSpeaker && buf.currentSpeaker !== speaker) {
      flush(); // fire-and-forget, non-blocking
    }

    buf.currentSpeaker = speaker;
    buf.chunks.push(text.trim());
  }

  /**
   * Flush everything remaining (call end / tool boundary).
   */
  async function flushAll() {
    await flush();
  }

  return { push, flush, flushAll };
}

module.exports = { createTranscriptBuffer };
