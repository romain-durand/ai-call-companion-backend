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
  MODEL: process.env.GEMINI_MODEL || "models/gemini-3.1-flash-live-preview",
};
