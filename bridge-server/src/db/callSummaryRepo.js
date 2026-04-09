const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");
const { generateDeterministicSummary } = require("../services/generateDeterministicSummary");

/**
 * Load related data, generate a deterministic summary, and update call_sessions.
 * Never throws — failures are logged and swallowed.
 */
async function generateAndSaveSummary(callSessionId, traceId) {
  if (!callSessionId) return;

  log.call("call_summary_generation_started", traceId, callSessionId);

  try {
    // Load all related data in parallel
    const [sessionRes, callbacksRes, notificationsRes, toolsRes, messagesRes] =
      await Promise.all([
        supabaseAdmin
          .from("call_sessions")
          .select("caller_name_raw, caller_phone_e164")
          .eq("id", callSessionId)
          .single(),
        supabaseAdmin
          .from("callback_requests")
          .select("caller_name, preferred_time_note, priority, created_at")
          .eq("call_session_id", callSessionId)
          .order("created_at", { ascending: true })
          .limit(5),
        supabaseAdmin
          .from("notifications")
          .select("priority, title, created_at")
          .eq("call_session_id", callSessionId)
          .order("created_at", { ascending: true })
          .limit(5),
        supabaseAdmin
          .from("tool_invocations")
          .select("tool_name, status, created_at")
          .eq("call_session_id", callSessionId)
          .order("created_at", { ascending: true })
          .limit(20),
        supabaseAdmin
          .from("call_messages")
          .select("speaker, content_text, seq_no")
          .eq("call_session_id", callSessionId)
          .order("seq_no", { ascending: true })
          .limit(50),
      ]);

    const session = sessionRes.data;
    const callbacks = callbacksRes.data || [];
    const notifications = notificationsRes.data || [];
    const toolInvocations = toolsRes.data || [];
    const messages = messagesRes.data || [];

    const { summary_short, summary_long, rule } = generateDeterministicSummary({
      session,
      callbacks,
      notifications,
      toolInvocations,
      messages,
    });

    // Write to DB
    const { error } = await supabaseAdmin
      .from("call_sessions")
      .update({ summary_short, summary_long })
      .eq("id", callSessionId);

    if (error) throw error;

    log.call("call_summary_generated", traceId,
      `rule=${rule} session=${callSessionId} short="${summary_short.slice(0, 60)}…"`);
  } catch (e) {
    log.error("call_summary_failed", traceId, `${callSessionId}: ${e.message}`);
  }
}

module.exports = { generateAndSaveSummary };
