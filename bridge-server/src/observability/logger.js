function fmt(icon, event, traceId, extra) {
  const timestamp = new Date().toISOString();
  const base = traceId ? `[${traceId}] ${icon} ${event}` : `${icon} ${event}`;
  const msg = extra !== undefined ? `${base}: ${extra}` : base;
  return `${timestamp} ${msg}`;
}

const logger = {
  info(event, traceId, extra) { console.log(fmt("ℹ️", event, traceId, extra)); },
  call(event, traceId, extra) { console.log(fmt("📞", event, traceId, extra)); },
  gemini(event, traceId, extra) { console.log(fmt("🤖", event, traceId, extra)); },
  tool(event, traceId, extra) { console.log(fmt("🔧", event, traceId, extra)); },
  transcript(icon, event, traceId, text) { console.log(fmt(icon, event, traceId, text)); },
  error(event, traceId, extra) { console.error(fmt("❌", event, traceId, extra)); },
  server(event, extra) { console.log(fmt("🚀", event, null, extra)); },
};

module.exports = logger;
