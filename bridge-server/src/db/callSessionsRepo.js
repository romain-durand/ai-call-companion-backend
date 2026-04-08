const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Create an inbound call session row, or reuse if provider_call_id already exists.
 * Returns the call_sessions.id or null on failure.
 */
async function createInboundCallSession(ctx) {
  const { traceId } = ctx;

  // If no accountId we cannot write — skip gracefully
  if (!ctx.accountId) {
    log.error("db_write_skipped", traceId, "no accountId — cannot create call_session");
    return null;
  }

  const row = {
    account_id: ctx.accountId,
    provider: "twilio",
    provider_call_id: ctx.providerCallId || null,
    direction: "inbound",
    started_at: ctx.startedAt || new Date().toISOString(),
    caller_phone_e164: ctx.callerNumber !== "unknown" ? ctx.callerNumber : null,
    caller_name_raw: ctx.callerNameRaw || null,
    phone_number_id: ctx.phoneNumberId || null,
    profile_id: ctx.profileId || null,
    active_mode_id: ctx.activeModeId || null,
  };

  try {
    // Idempotency: check if a session already exists for this provider_call_id
    if (ctx.providerCallId) {
      const { data: existing } = await supabaseAdmin
        .from("call_sessions")
        .select("id")
        .eq("provider", "twilio")
        .eq("provider_call_id", ctx.providerCallId)
        .maybeSingle();

      if (existing) {
        log.call("call_session_reused", traceId, existing.id);
        return existing.id;
      }
    }

    const { data, error } = await supabaseAdmin
      .from("call_sessions")
      .insert(row)
      .select("id")
      .single();

    if (error) throw error;

    log.call("call_session_created", traceId, data.id);
    return data.id;
  } catch (e) {
    log.error("db_write_failed", traceId, `call_sessions insert: ${e.message}`);
    return null;
  }
}

/**
 * Finalize a call session: set ended_at, duration, outcome.
 * Idempotent: skips if already finalized.
 */
async function finalizeCallSession(ctx) {
  if (ctx.finalized || !ctx.callSessionId) {
    log.call("call_session_finalize_skipped", ctx.traceId, ctx.callSessionId || "no session");
    return;
  }

  const endedAt = new Date().toISOString();
  let durationSeconds = null;
  if (ctx.startedAt) {
    durationSeconds = Math.round((Date.now() - new Date(ctx.startedAt).getTime()) / 1000);
  }

  try {
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({
        ended_at: endedAt,
        duration_seconds: durationSeconds,
        final_outcome: "completed",
      })
      .eq("id", ctx.callSessionId);

    if (error) throw error;

    ctx.finalized = true;
    log.call("call_session_finalized", ctx.traceId, `${ctx.callSessionId} (${durationSeconds}s)`);
  } catch (e) {
    log.error("db_write_failed", ctx.traceId, `call_sessions finalize: ${e.message}`);
  }
}

module.exports = { createInboundCallSession, finalizeCallSession };
