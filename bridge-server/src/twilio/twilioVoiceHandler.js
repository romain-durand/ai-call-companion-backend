const { supabaseAdmin } = require("../db/supabaseAdmin");
const { TWILIO_BRIDGE_WS_URL } = require("../config/env");
const { randomUUID } = require("crypto");
const log = require("../observability/logger");

/**
 * Handle POST /twilio-voice — replaces the Supabase Edge Function.
 * Returns TwiML that connects Twilio to the bridge WebSocket.
 */
async function handleTwilioVoice(req, res) {
  // CORS preflight (shouldn't happen for Twilio, but just in case)
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (!TWILIO_BRIDGE_WS_URL) {
    log.error("twilio_voice_handler", null, "TWILIO_BRIDGE_WS_URL not configured");
    res.writeHead(200, { "Content-Type": "application/xml" });
    return res.end(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say language="fr-FR">Désolé, le service est temporairement indisponible.</Say><Hangup/></Response>`
    );
  }

  // Parse Twilio POST form data
  let callerNumber = "unknown";
  let calledNumber = "unknown";
  let forwardedFrom = "";
  let calledVia = "";
  let callSid = "";

  try {
    const body = await parseFormBody(req);
    callerNumber = body.From || "unknown";
    calledNumber = body.To || "unknown";
    forwardedFrom = body.ForwardedFrom || "";
    calledVia = body.CalledVia || "";
    callSid = body.CallSid || "";
  } catch (e) {
    log.error("twilio_voice_parse", null, e.message);
  }

  // The number to route on: prefer ForwardedFrom/CalledVia (call-forwarding scenario),
  // fall back to To (direct call to a dedicated Twilio number).
  const routingNumber = forwardedFrom || calledVia || "";

  log.server("twilio_voice_incoming", `From: ${callerNumber}, To: ${calledNumber}, ForwardedFrom: ${forwardedFrom}, CalledVia: ${calledVia}, CallSid: ${callSid}`);

  // Resolve accountId, activeModeId
  let accountId = "";
  let phoneNumberId = "";
  let activeModeId = "";

  try {
    let matchedProfileId = null;

    if (routingNumber) {
      // Suffix-based matching against profiles.phone_e164
      matchedProfileId = await resolveProfileByDigitSuffix(routingNumber);
    }

    if (matchedProfileId) {
      // Find the account this profile belongs to
      const { data: membership, error: memErr } = await supabaseAdmin
        .from("account_members")
        .select("account_id")
        .eq("profile_id", matchedProfileId)
        .eq("is_default_account", true)
        .limit(1)
        .maybeSingle();

      if (memErr) {
        log.error("twilio_voice_membership", null, memErr.message);
      } else if (membership) {
        accountId = membership.account_id;
      } else {
        // Fallback: any account for this profile
        const { data: anyMem, error: anyErr } = await supabaseAdmin
          .from("account_members")
          .select("account_id")
          .eq("profile_id", matchedProfileId)
          .limit(1)
          .maybeSingle();
        if (!anyErr && anyMem) accountId = anyMem.account_id;
      }

      log.server("twilio_voice_resolved", `profileId: ${matchedProfileId}, accountId: ${accountId}`);
    } else {
      log.server("twilio_voice_no_profile", `No profile matched for routing=${routingNumber || calledNumber}`);
    }

    if (accountId) {
      // Resolve active mode
      const { data: mode, error: modeErr } = await supabaseAdmin
        .from("assistant_modes")
        .select("id")
        .eq("account_id", accountId)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();

      if (modeErr) {
        log.error("twilio_voice_mode", null, modeErr.message);
      } else if (mode) {
        activeModeId = mode.id;
        log.server("twilio_voice_mode_resolved", `activeModeId: ${activeModeId}`);
      } else {
        log.server("twilio_voice_mode_missing", "No active assistant_mode for account");
      }

      // Resolve phone_number for this account (optional, for metadata)
      const { data: pn } = await supabaseAdmin
        .from("phone_numbers")
        .select("id")
        .eq("account_id", accountId)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();
      if (pn) phoneNumberId = pn.id;
    }
  } catch (e) {
    log.error("twilio_voice_resolve", null, e.message);
  }

  const traceId = randomUUID();

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${TWILIO_BRIDGE_WS_URL}">
      <Parameter name="callerNumber" value="${callerNumber}" />
      <Parameter name="providerCallId" value="${callSid}" />
      <Parameter name="accountId" value="${accountId}" />
      <Parameter name="phoneNumberId" value="${phoneNumberId}" />
      <Parameter name="activeModeId" value="${activeModeId}" />
      <Parameter name="traceId" value="${traceId}" />
    </Stream>
  </Connect>
</Response>`;

  log.server("twilio_voice_twiml", `traceId: ${traceId}, accountId=${accountId || "MISSING"}, phoneNumberId=${phoneNumberId || "MISSING"}`);

  res.writeHead(200, { "Content-Type": "application/xml" });
  res.end(twiml);
}

/**
 * Extract only digits from a phone number string.
 */
function extractDigits(phone) {
  return phone.replace(/\D/g, "");
}

/**
 * Resolve a phone_number row by right-to-left digit suffix matching.
 * Requires at least 8 matching trailing digits.
 * Loads all active phone_numbers and compares suffixes in JS
 * (the table is small — one row per user).
 */
async function resolveProfileByDigitSuffix(routingNumber) {
  const routingDigits = extractDigits(routingNumber);
  if (routingDigits.length < 8) {
    log.server("twilio_voice_suffix_skip", `routingNumber too short: ${routingNumber}`);
    return null;
  }

  const routingSuffix = routingDigits.slice(-Math.max(8, routingDigits.length));

  const { data: profiles, error } = await supabaseAdmin
    .from("profiles")
    .select("id, phone_e164")
    .not("phone_e164", "is", null);

  if (error) {
    log.error("twilio_voice_suffix_db", null, error.message);
    return null;
  }

  if (!profiles || profiles.length === 0) return null;

  let bestMatch = null;
  let bestLen = 0;

  for (const profile of profiles) {
    const numDigits = extractDigits(profile.phone_e164);
    let matchLen = 0;
    const maxCompare = Math.min(routingSuffix.length, numDigits.length);
    for (let i = 1; i <= maxCompare; i++) {
      if (routingSuffix[routingSuffix.length - i] === numDigits[numDigits.length - i]) {
        matchLen++;
      } else {
        break;
      }
    }
    if (matchLen >= 8 && matchLen > bestLen) {
      bestLen = matchLen;
      bestMatch = profile;
    }
  }

  if (bestMatch) {
    log.server("twilio_voice_suffix_matched", `routing=${routingNumber} matched=${bestMatch.phone_e164} profileId=${bestMatch.id} digits=${bestLen}`);
    return bestMatch.id;
  }

  log.server("twilio_voice_suffix_nomatch", `No profile suffix match for ${routingNumber}`);
  return null;
}

/**
 * Parse URL-encoded form body from an http.IncomingMessage.
 */
function parseFormBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString();
        const params = new URLSearchParams(raw);
        const obj = {};
        for (const [key, value] of params) {
          obj[key] = value;
        }
        resolve(obj);
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

module.exports = { handleTwilioVoice };
