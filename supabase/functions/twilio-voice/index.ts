import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// This edge function handles incoming Twilio voice calls.
// It returns TwiML that:
// 1. Says a brief hold message
// 2. Opens a Media Stream WebSocket to your bridge server

serve(async (req) => {
  // Twilio sends POST with form-encoded data
  const BRIDGE_WS_URL = Deno.env.get("TWILIO_BRIDGE_WS_URL");
  if (!BRIDGE_WS_URL) {
    console.error("TWILIO_BRIDGE_WS_URL not configured");
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="fr-FR">Désolé, le service est temporairement indisponible.</Say>
  <Hangup/>
</Response>`;
    return new Response(twiml, {
      headers: { "Content-Type": "application/xml" },
    });
  }

  // Get caller info from Twilio's POST data
  let callerNumber = "unknown";
  try {
    if (req.method === "POST") {
      const formData = await req.formData();
      callerNumber = formData.get("From")?.toString() || "unknown";
      console.log("Incoming call from:", callerNumber);
    }
  } catch (e) {
    console.error("Error parsing form data:", e);
  }

  // Return TwiML that connects to the WebSocket bridge
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${BRIDGE_WS_URL}">
      <Parameter name="callerNumber" value="${callerNumber}" />
    </Stream>
  </Connect>
</Response>`;

  console.log("Returning TwiML with Stream URL:", BRIDGE_WS_URL);

  return new Response(twiml, {
    headers: { "Content-Type": "application/xml" },
  });
});
