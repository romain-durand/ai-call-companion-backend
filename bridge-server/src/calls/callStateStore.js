// In-memory store for active call contexts, keyed by traceId
const activeCalls = new Map();
const log = require("../observability/logger");

// Cleanup stale calls after 1 hour of inactivity
const CLEANUP_TIMEOUT_MS = 60 * 60 * 1000;
const CLEANUP_CHECK_INTERVAL_MS = 5 * 60 * 1000; // Check every 5 minutes

let cleanupIntervalId = null;

function startCleanupTimer() {
  if (cleanupIntervalId) return; // Already running

  cleanupIntervalId = setInterval(() => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [traceId, context] of activeCalls.entries()) {
      const inactiveMs = now - context.lastActivityTime;

      if (inactiveMs > CLEANUP_TIMEOUT_MS) {
        const durationMin = Math.round((now - context.createdAt) / 1000 / 60);
        log.call("stale_call_cleanup", traceId,
          `Removed stale call (${durationMin}min, inactive ${Math.round(inactiveMs / 1000 / 60)}min)`);

        activeCalls.delete(traceId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      log.call("cleanup_summary", "system",
        `Cleaned up ${cleanedCount} stale calls, ${activeCalls.size} active remaining`);
    }
  }, CLEANUP_CHECK_INTERVAL_MS);

  log.call("cleanup_initialized", "system",
    `Call state cleanup started (${CLEANUP_TIMEOUT_MS / 1000 / 60}min timeout, check every ${CLEANUP_CHECK_INTERVAL_MS / 1000 / 60}min)`);
}

module.exports = {
  set(traceId, ctx) {
    activeCalls.set(traceId, ctx);
    startCleanupTimer(); // Ensure timer is running
  },
  get(traceId) {
    const ctx = activeCalls.get(traceId);
    if (ctx) {
      ctx.lastActivityTime = Date.now(); // Touch on access
    }
    return ctx;
  },
  touch(traceId) {
    const ctx = activeCalls.get(traceId);
    if (ctx) {
      ctx.lastActivityTime = Date.now();
    }
  },
  remove(traceId) { activeCalls.delete(traceId); },
  size() { return activeCalls.size; },
  all() { return activeCalls; },
  getStats() {
    const now = Date.now();
    const stats = {
      activeCallCount: activeCalls.size,
      calls: [],
    };

    for (const [traceId, context] of activeCalls.entries()) {
      stats.calls.push({
        traceId,
        durationMin: Math.round((now - context.createdAt) / 1000 / 60),
        inactiveMin: Math.round((now - context.lastActivityTime) / 1000 / 60),
        callerNumber: context.callerNumber,
        finalized: context.finalized,
      });
    }

    return stats;
  },
  stopCleanupTimer() {
    if (cleanupIntervalId) {
      clearInterval(cleanupIntervalId);
      cleanupIntervalId = null;
    }
  },
};
