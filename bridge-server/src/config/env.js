try { require("dotenv").config(); } catch (_) {}

const required = (name) => {
  const val = process.env[name];
  if (!val) {
    console.error(`❌ ${name} is required. Set it in .env or environment.`);
    process.exit(1);
  }
  return val;
};

module.exports = {
  PORT: process.env.PORT || 8081,
  GEMINI_API_KEY: required("GEMINI_API_KEY"),
  SUPABASE_URL: required("SUPABASE_URL"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),
  N8N_WEBHOOK_URL: process.env.N8N_WEBHOOK_URL || "https://n8n.ted.paris/webhook/466abacc-ec73-401a-9052-71a04ea95eda",
  N8N_SMS_WEBHOOK_URL: process.env.N8N_SMS_WEBHOOK_URL || "",
  MODEL: process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview",

  // Temporary fallback for inbound calls not yet associated to an account
  DEFAULT_RUNTIME_ACCOUNT_ID: process.env.DEFAULT_RUNTIME_ACCOUNT_ID || "122c09a9-8ad3-42bb-a7de-6d97342813a5",
  DEFAULT_RUNTIME_PROFILE_ID: process.env.DEFAULT_RUNTIME_PROFILE_ID || "b7ddff90-ac2f-44e8-ab4f-05fca04d8822",
};
