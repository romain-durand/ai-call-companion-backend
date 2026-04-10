import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

serve(async (req) => {
  const BRIDGE_WS_URL = Deno.env.get("TWILIO_BRIDGE_WS_URL");
  if (!BRIDGE_WS_URL) {
    console.error("TWILIO_BRIDGE_WS_URL not configured");
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">Désolé, le service est temporairement indisponible.</Say><Hangup/></Response>`,
      { headers: { "Content-Type": "application/xml" } },
    );
  }

  // Parse Twilio POST form data
  let callerNumber = "unknown";
  let calledNumber = "unknown";
  let callSid = "";
  try {
    if (req.method === "POST") {
      const formData = await req.formData();
      callerNumber = formData.get("From")?.toString() || "unknown";
      calledNumber = formData.get("To")?.toString() || "unknown";
      callSid = formData.get("CallSid")?.toString() || "";
    }
  } catch (e) {
    console.error("Error parsing form data:", e);
  }

  console.log(`Incoming call — From: ${callerNumber}, To: ${calledNumber}, CallSid: ${callSid}`);

  // Resolve accountId, phoneNumberId and activeModeId from the called number
  let accountId = "";
  let phoneNumberId = "";
  let activeModeId = "";
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data, error } = await supabase
      .from("phone_numbers")
      .select("id, account_id")
      .eq("e164_number", calledNumber)
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("DB lookup error:", error.message);
    } else if (data) {
      accountId = data.account_id;
      phoneNumberId = data.id;
      console.log(`Resolved — accountId: ${accountId}, phoneNumberId: ${phoneNumberId}`);

      // Resolve active mode for this account
      const { data: mode, error: modeErr } = await supabase
        .from("assistant_modes")
        .select("id")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (modeErr) {
        console.error("Mode lookup error:", modeErr.message);
      } else if (mode) {
        activeModeId = mode.id;
        console.log(`Resolved activeModeId: ${activeModeId}`);
      } else {
        console.warn("No active assistant_mode found for account");
      }
    } else {
      console.warn(`No phone_number found for ${calledNumber} — bridge will skip DB writes`);
    }
  } catch (e) {
    console.error("Failed to resolve phone number:", e);
  }

  const traceId = crypto.randomUUID();

  // Build TwiML with custom parameters
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${BRIDGE_WS_URL}">
      <Parameter name="callerNumber" value="${callerNumber}" />
      <Parameter name="providerCallId" value="${callSid}" />
      <Parameter name="accountId" value="${accountId}" />
      <Parameter name="phoneNumberId" value="${phoneNumberId}" />
      <Parameter name="traceId" value="${traceId}" />
    </Stream>
  </Connect>
</Response>`;

  console.log(`TwiML ready — traceId: ${traceId}, customParams: accountId=${accountId || "MISSING"}, phoneNumberId=${phoneNumberId || "MISSING"}`);

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
});
