const log = require("../observability/logger");

const TIMEOUT_MS = 10_000;

/**
 * Send an SMS via n8n webhook.
 * Returns { ok, status, body } on any HTTP response, throws on network/timeout.
 */
async function sendSms(webhookUrl, payload, traceId) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    log.info("n8n_sms_request", traceId, `POST ${webhookUrl}`);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const text = await res.text();

    log.info("n8n_sms_response", traceId, `status=${res.status} body=${text.slice(0, 200)}`);

    return { ok: res.ok, status: res.status, body: text };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { sendSms };
