try { require("dotenv").config(); } catch (_) {}

const normalize = (value) => {
  if (typeof value !== "string") return value;

  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }

  return trimmed;
};

const optional = (name, fallback = undefined) => {
  const raw = process.env[name];
  if (raw === undefined || raw === null) {
    return fallback;
  }

  const val = normalize(raw);
  return val === "" ? fallback : val;
};

const required = (name) => {
  const val = optional(name);
  if (!val) {
    console.error(`❌ ${name} is required. Set it in .env or environment.`);
    process.exit(1);
  }
  return val;
};

module.exports = {
  PORT: optional("PORT", 8081),
  GEMINI_API_KEY: required("GEMINI_API_KEY"),
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  N8N_WEBHOOK_URL: optional("N8N_WEBHOOK_URL", "https://n8n.ted.paris/webhook/466abacc-ec73-401a-9052-71a04ea95eda"),
  N8N_SMS_WEBHOOK_URL: optional("N8N_SMS_WEBHOOK_URL", ""),
  MODEL: optional("GEMINI_MODEL", "models/gemini-3.1-flash-live-preview"),
  TWILIO_ACCOUNT_SID: optional("TWILIO_ACCOUNT_SID"),
  TWILIO_AUTH_TOKEN: optional("TWILIO_AUTH_TOKEN"),
  TWILIO_API_KEY_SID: optional("TWILIO_API_KEY_SID"),
  TWILIO_API_KEY_SECRET: optional("TWILIO_API_KEY_SECRET"),
  TWILIO_BRIDGE_WS_URL: optional("TWILIO_BRIDGE_WS_URL", "wss://bridgeserver.ted.paris"),

  // Temporary fallback for inbound calls not yet associated to an account
  DEFAULT_RUNTIME_ACCOUNT_ID: optional("DEFAULT_RUNTIME_ACCOUNT_ID", "122c09a9-8ad3-42bb-a7de-6d97342813a5"),
  DEFAULT_RUNTIME_PROFILE_ID: optional("DEFAULT_RUNTIME_PROFILE_ID", "b7ddff90-ac2f-44e8-ab4f-05fca04d8822"),
};
