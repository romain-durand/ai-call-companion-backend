const { N8N_WEBHOOK_URL } = require("../config/env");
const log = require("../observability/logger");

// Generic backend tool client — currently targets n8n webhook
async function notifyBackend(toolName, args, message, traceId) {
  try {
    const params = new URLSearchParams();
    if (toolName) params.set("tool", toolName);
    if (message) params.set("message", message);
    if (args) {
      for (const [k, v] of Object.entries(args)) {
        params.set(k, v);
      }
    }
    const url = `${N8N_WEBHOOK_URL}?${params.toString()}`;
    log.tool("notify_backend", traceId, url);
    const resp = await fetch(url);
    log.tool("backend_response", traceId, resp.status);
  } catch (e) {
    log.error("backend_notification_failed", traceId, e.message);
  }
}

module.exports = { notifyBackend };
