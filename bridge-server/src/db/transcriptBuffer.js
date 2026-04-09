const log = require("../observability/logger");
const { appendCallMessage } = require("./callMessagesRepo");

/**
 * In-memory transcript buffer for a single call.
 * Maintains ONE active speaker buffer at a time.
 * Flushes on speaker change, tool boundary, or call end.
 */
function createTranscriptBuffer(callCtx) {
  const buf = {
    currentSpeaker: null,
    chunks: [],
    lastFlushedSpeaker: null,
    lastFlushedText: null,
    _flushPromise: null,
  };

  /**
   * Flush the current buffer to DB. Returns a promise.
   * Serialized: waits for any in-flight flush before starting.
   */
  async function flush() {
    if (!buf.currentSpeaker || buf.chunks.length === 0) return;

    // Capture and clear atomically
    const speaker = buf.currentSpeaker;
    const text = buf.chunks.join(" ").replace(/\s+/g, " ").trim();
    buf.chunks = [];
    buf.currentSpeaker = null;

    if (!text) return;

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
   * Add a transcription chunk. Flushes on speaker change.
   */
  function push(speaker, text) {
    if (!text || !text.trim()) return;

    log.call("transcript_buffer_push", callCtx.traceId, `${speaker}: "${text.trim().slice(0, 40)}…"`);

    // Speaker changed → flush previous speaker first
    if (buf.currentSpeaker && buf.currentSpeaker !== speaker) {
      // Serialize: chain onto previous flush
      buf._flushPromise = (buf._flushPromise || Promise.resolve()).then(() => flush());
    }

    buf.currentSpeaker = speaker;
    buf.chunks.push(text.trim());
  }

  /**
   * Flush everything remaining (call end / tool boundary).
   */
  async function flushAll() {
    // Wait for any pending flush first
    if (buf._flushPromise) await buf._flushPromise;
    await flush();
  }

  return { push, flush, flushAll };
}

module.exports = { createTranscriptBuffer };
