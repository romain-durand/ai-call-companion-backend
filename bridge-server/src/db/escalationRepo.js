const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Create an escalation event for the current call.
 * MVP: creates an escalation_events row + a critical notification.
 * Returns the escalation event id or null.
 */
async function createEscalation(callCtx, args) {
  const accountId = callCtx.accountId;
  if (!accountId || !callCtx.callSessionId) {
    log.error("escalation_failed", callCtx.traceId, "missing accountId or callSessionId");
    return null;
  }

  try {
    // 1. Resolve first owner/admin as escalation target
    const { data: members, error: mErr } = await supabaseAdmin
      .from("account_members")
      .select("profile_id, role")
      .eq("account_id", accountId)
      .in("role", ["owner", "admin"])
      .order("role", { ascending: true })
      .limit(1);

    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      log.error("escalation_failed", callCtx.traceId, "no admin/owner found");
      return null;
    }

    const targetProfileId = members[0].profile_id;
    const urgencyLevel = args.urgency_level || "high";

    // 2. Create escalation_events row
    const { data: esc, error: eErr } = await supabaseAdmin
      .from("escalation_events")
      .insert({
        account_id: accountId,
        call_session_id: callCtx.callSessionId,
        target_profile_id: targetProfileId,
        trigger_reason: args.reason || "Escalation demandée par l'assistant",
        urgency_level: urgencyLevel,
        method: "push",
        status: "attempting",
        attempted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (eErr) throw eErr;

    log.call("escalation_created", callCtx.traceId,
      `id=${esc.id} target=${targetProfileId} urgency=${urgencyLevel}`);

    // 3. Create critical notification for the target
    const callerLabel = args.caller_name || callCtx.callerNameRaw || "Un appelant";
    const body = args.reason
      ? `⚠️ ${callerLabel}: ${args.reason}`
      : `⚠️ ${callerLabel} — escalade en cours`;

    await supabaseAdmin
      .from("notifications")
      .insert({
        account_id: accountId,
        profile_id: targetProfileId,
        call_session_id: callCtx.callSessionId,
        channel: "push",
        priority: "critical",
        title: "Escalade urgente",
        body,
        status: "pending",
      });

    // 4. Update call_session escalation status
    await supabaseAdmin
      .from("call_sessions")
      .update({
        escalation_status: "pending",
        escalated_to_user: true,
        urgency_level: urgencyLevel,
      })
      .eq("id", callCtx.callSessionId);

    return esc.id;
  } catch (e) {
    log.error("escalation_failed", callCtx.traceId, e.message);
    return null;
  }
}

module.exports = { createEscalation };
