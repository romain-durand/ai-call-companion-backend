const WebSocket = require("ws");
const { supabaseAdmin } = require("../db/supabaseAdmin");
const { createCallContext } = require("../calls/callContext");
const { createTranscriptBuffer } = require("../db/transcriptBuffer");
const { finalizeCallSession } = require("../db/callSessionsRepo");
const { connectOutboundGemini } = require("./outboundGeminiConnection");
const { decodeMulaw, upsample8to16, int16ToBase64, SILENCE_200MS } = require("../audio/codec");
const log = require("../observability/logger");
const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_API_KEY_SID,
  TWILIO_API_KEY_SECRET,
  TWILIO_BRIDGE_WS_URL,
} = require("../config/env");

/**
 * Execute a single outbound mission:
 * 1. Resolve account context (user name, profile)
 * 2. Create a call_sessions row (direction=outbound)
 * 3. Initiate the Twilio call via REST API
 * 4. The Twilio stream callback connects back to the bridge server
 *    and the outbound Gemini connection handles the conversation
 */
async function executeOutboundMission(mission) {
  const traceId = `ob-${mission.id.slice(0, 8)}`;
  log.server("outbound_mission_executing", `${traceId} target=${mission.target_phone_e164}`);

  // 1. Resolve user name
  let userName = "Unknown";
  try {
    const { data: member } = await supabaseAdmin
      .from("account_members")
      .select("profiles!account_members_profile_id_fkey(display_name, first_name, last_name)")
      .eq("account_id", mission.account_id)
      .in("role", ["owner", "admin"])
      .limit(1)
      .maybeSingle();

    if (member?.profiles) {
      const p = member.profiles;
      userName = p.display_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "Unknown";
    }
  } catch (e) {
    log.error("outbound_resolve_user_error", traceId, e.message);
  }

  // 2. Resolve phone number for caller ID (from_number)
  let fromNumber = null;
  try {
    // Prefer the default outbound number, fallback to any active number
    let { data: phone } = await supabaseAdmin
      .from("phone_numbers")
      .select("e164_number, id")
      .eq("account_id", mission.account_id)
      .eq("status", "active")
      .eq("is_default_outbound", true)
      .limit(1)
      .maybeSingle();

    if (!phone) {
      ({ data: phone } = await supabaseAdmin
        .from("phone_numbers")
        .select("e164_number, id")
        .eq("account_id", mission.account_id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle());
    }

    if (phone) {
      fromNumber = phone.e164_number;
    }
  } catch (e) {
    log.error("outbound_resolve_phone_error", traceId, e.message);
  }

  if (!fromNumber) {
    throw new Error("No active phone number found for this account");
  }

  // 3. Create call session
  let callSessionId = null;
  try {
    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .insert({
        account_id: mission.account_id,
        provider: "twilio",
        direction: "outbound",
        started_at: new Date().toISOString(),
        caller_phone_e164: mission.target_phone_e164,
        caller_name_raw: mission.target_name || null,
      })
      .select("id")
      .single();

    if (error) throw error;
    callSessionId = data.id;

    // Link mission to session
    await supabaseAdmin
      .from("outbound_missions")
      .update({ call_session_id: callSessionId, started_at: new Date().toISOString() })
      .eq("id", mission.id);

    log.server("outbound_session_created", `${traceId} sessionId=${callSessionId}`);
  } catch (e) {
    log.error("outbound_session_create_error", traceId, e.message);
    throw e;
  }

  // 4. Initiate Twilio call
  // The TwiML instructs Twilio to stream audio back to our bridge server
  const bridgeWsUrl = TWILIO_BRIDGE_WS_URL || "wss://bridgeserver.ted.paris";
  const twiml = `<Response><Connect><Stream url="${bridgeWsUrl}/outbound-stream"><Parameter name="missionId" value="${mission.id}"/><Parameter name="accountId" value="${mission.account_id}"/><Parameter name="callSessionId" value="${callSessionId}"/><Parameter name="userName" value="${userName}"/><Parameter name="objective" value="${encodeURIComponent(mission.objective)}"/><Parameter name="targetName" value="${mission.target_name || ""}"/><Parameter name="constraintsJson" value="${encodeURIComponent(JSON.stringify(mission.constraints_json || {}))}"/></Stream></Connect></Response>`;

  try {
    // Use Twilio REST API to initiate the call
    const twilioAccountSid = TWILIO_ACCOUNT_SID;
    const twilioAuthToken = TWILIO_AUTH_TOKEN;
    const twilioApiKeySid = TWILIO_API_KEY_SID;
    const twilioApiKeySecret = TWILIO_API_KEY_SECRET;

    if (!twilioAccountSid) {
      throw new Error("TWILIO_ACCOUNT_SID is required for outbound calls");
    }

    if (!/^AC[a-zA-Z0-9]{32}$/.test(twilioAccountSid)) {
      throw new Error("TWILIO_ACCOUNT_SID must start with AC and match a valid Twilio Account SID");
    }

    let authUsername = twilioAccountSid;
    let authPassword = twilioAuthToken;
    let authMode = "auth_token";

    if (twilioApiKeySid || twilioApiKeySecret) {
      if (!twilioApiKeySid || !twilioApiKeySecret) {
        throw new Error("TWILIO_API_KEY_SID and TWILIO_API_KEY_SECRET must both be set to use API key authentication");
      }

      if (!/^SK[a-zA-Z0-9]{32}$/.test(twilioApiKeySid)) {
        throw new Error("TWILIO_API_KEY_SID must start with SK and match a valid Twilio API Key SID");
      }

      authUsername = twilioApiKeySid;
      authPassword = twilioApiKeySecret;
      authMode = "api_key";
    } else if (!twilioAuthToken) {
      throw new Error("TWILIO_AUTH_TOKEN is required for outbound calls when API key auth is not configured");
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`;
    const authHeader = "Basic " + Buffer.from(`${authUsername}:${authPassword}`).toString("base64");

    const body = new URLSearchParams({
      To: mission.target_phone_e164,
      From: fromNumber,
      Twiml: twiml,
    });

    const response = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        Authorization: authHeader,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      const diagnostic = response.status === 401
        ? ` mode=${authMode} accountSidPrefix=${twilioAccountSid.slice(0, 2)} accountSidLength=${twilioAccountSid.length} secretLength=${authPassword?.length || 0}`
        : "";
      throw new Error(`Twilio API error [${response.status}]: ${JSON.stringify(result)}${diagnostic}`);
    }

    // Update call session with provider_call_id
    if (result.sid) {
      await supabaseAdmin
        .from("call_sessions")
        .update({ provider_call_id: result.sid })
        .eq("id", callSessionId);
    }

    log.server("outbound_call_initiated", `${traceId} twilioSid=${result.sid}`);
  } catch (e) {
    log.error("outbound_twilio_call_error", traceId, e.message);
    // Mark mission as failed
    await supabaseAdmin
      .from("outbound_missions")
      .update({
        status: "failed",
        result_status: "failure",
        result_summary: `Impossible de passer l'appel: ${e.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", mission.id);
    throw e;
  }
}

module.exports = { executeOutboundMission };
