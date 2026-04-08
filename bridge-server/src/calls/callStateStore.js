// In-memory store for active call contexts, keyed by traceId
const activeCalls = new Map();

module.exports = {
  set(traceId, ctx) { activeCalls.set(traceId, ctx); },
  get(traceId) { return activeCalls.get(traceId); },
  remove(traceId) { activeCalls.delete(traceId); },
  size() { return activeCalls.size; },
  all() { return activeCalls; },
};
