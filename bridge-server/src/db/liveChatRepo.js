const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Insert a consult question (direction=to_user) and poll for the user's reply.
 * Returns the reply text or null on timeout.
 */
async function consultUser(callCtx, question, traceId, timeoutMs = 30000) {
  if (!callCtx.callSessionId || !callCtx.accountId) {
    log.error("consult_user_missing_ctx", traceId, "no callSessionId or accountId");
    return null;
  }

  // 1. Insert question
  const { data: msg, error: insertErr } = await supabaseAdmin
    .from("live_chat_messages")
    .insert({
      call_session_id: callCtx.callSessionId,
      account_id: callCtx.accountId,
      direction: "to_user",
      content: question,
      status: "pending",
    })
    .select("id")
    .single();

  if (insertErr) {
    log.error("consult_user_insert_failed", traceId, insertErr.message);
    return null;
  }

  const questionId = msg.id;
  const questionCreatedAt = new Date().toISOString();
  log.tool("consult_user_question_sent", traceId, `id=${questionId} "${question.slice(0, 60)}"`);

  // 2. Poll for reply (direction=to_assistant) created AFTER this question
  const pollInterval = 2000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    // Keep Twilio stream alive by sending silence
    if (callCtx._sendSilence) callCtx._sendSilence();

    const { data: reply } = await supabaseAdmin
      .from("live_chat_messages")
      .select("content")
      .eq("call_session_id", callCtx.callSessionId)
      .eq("direction", "to_assistant")
      .gt("created_at", questionCreatedAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reply) {
      // Mark question as answered
      await supabaseAdmin
        .from("live_chat_messages")
        .update({ status: "answered", answered_at: new Date().toISOString() })
        .eq("id", questionId);

      log.tool("consult_user_reply_received", traceId, `"${reply.content.slice(0, 60)}"`);
      return reply.content;
    }
  }

  // 3. Timeout — mark as expired
  await supabaseAdmin
    .from("live_chat_messages")
    .update({ status: "expired" })
    .eq("id", questionId);

  log.tool("consult_user_timeout", traceId, `id=${questionId}`);
  return null;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { consultUser };
