const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");
const { sendPushNotification } = require("../notifications/fcmService");
const { getTokensForProfile } = require("./deviceTokensRepo");

/**
 * Insert a consult question (direction=to_user) and poll for the user's reply.
 * Returns { status, reply?, error? } where status is answered, timeout, or error.
 */
async function consultUser(callCtx, question, traceId, timeoutMs = 30000) {
  if (!callCtx.callSessionId || !callCtx.accountId) {
    log.error("consult_user_missing_ctx", traceId, "no callSessionId or accountId");
    return { status: "error", reply: null, error: "Missing call session context." };
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
    .select("id, created_at")
    .single();

  if (insertErr) {
    log.error("consult_user_insert_failed", traceId, insertErr.message);
    return { status: "error", reply: null, error: "Failed to create consultation question." };
  }

  const questionId = msg.id;
  const questionCreatedAt = msg.created_at || new Date().toISOString();
  log.tool("consult_user_question_sent", traceId, `id=${questionId} "${question.slice(0, 60)}"`);

  // Send push notification to account owner (fire-and-forget)
  sendConsultUserNotification(callCtx.accountId, callCtx.callerName, traceId).catch((err) => {
    log.error("consult_user_notification_failed", traceId, err.message);
  });

  // 2. Poll for reply (direction=to_assistant) created AFTER this question
  const pollInterval = 2000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(pollInterval);

    // Keep Twilio stream alive by sending silence
    if (callCtx._sendSilence) callCtx._sendSilence();

    const { data: reply, error: replyErr } = await supabaseAdmin
      .from("live_chat_messages")
      .select("content")
      .eq("call_session_id", callCtx.callSessionId)
      .eq("direction", "to_assistant")
      .gt("created_at", questionCreatedAt)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (replyErr) {
      log.error("consult_user_poll_failed", traceId, replyErr.message);
      return { status: "error", reply: null, error: "Failed to read user reply." };
    }

    if (reply && typeof reply.content === "string") {
      // Mark question as answered
      const { error: answerErr } = await supabaseAdmin
        .from("live_chat_messages")
        .update({ status: "answered", answered_at: new Date().toISOString() })
        .eq("id", questionId);

      if (answerErr) {
        log.error("consult_user_mark_answered_failed", traceId, answerErr.message);
      }

      log.tool("consult_user_reply_received", traceId, `"${reply.content.slice(0, 60)}"`);
      return { status: "answered", reply: reply.content };
    }
  }

  // 3. Timeout — mark as expired
  const { error: expireErr } = await supabaseAdmin
    .from("live_chat_messages")
    .update({ status: "expired" })
    .eq("id", questionId);

  if (expireErr) {
    log.error("consult_user_mark_expired_failed", traceId, expireErr.message);
  }

  log.tool("consult_user_timeout", traceId, `id=${questionId}`);
  return { status: "timeout", reply: null };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function sendConsultUserNotification(accountId, callerName, traceId) {
  log.info("consult_notification_start", traceId, `accountId=${accountId}, caller=${callerName}`);

  // Get account owner's profile_id from account_members (role='owner')
  const { data: members, error: membersErr } = await supabaseAdmin
    .from("account_members")
    .select("profile_id")
    .eq("account_id", accountId)
    .eq("role", "owner")
    .limit(1);

  if (membersErr) {
    log.error("consult_notification_lookup_failed", traceId, `${membersErr.code}: ${membersErr.message}`);
    return;
  }

  if (!members || members.length === 0) {
    log.error("consult_notification_no_owner", traceId, `No owner found in account_members for account ${accountId}`);
    return;
  }

  const profileId = members[0].profile_id;
  log.info("consult_notification_owner_found", traceId, `profileId=${profileId}`);

  // Get all device tokens for the owner
  try {
    const tokens = await getTokensForProfile(profileId);
    log.info("consult_notification_tokens_fetched", traceId, `Found ${tokens.length} token(s)`);

    if (tokens.length === 0) {
      log.info("consult_notification_no_tokens", traceId, `No tokens registered for profile ${profileId}`);
      return;
    }

    // Send notification to all devices
    const callerDisplay = callerName && callerName.trim() ? ` from ${callerName}` : "";
    const title = "Incoming Call";
    const body = `Your AI assistant needs your input${callerDisplay}`;

    log.info("consult_notification_sending", traceId, `title="${title}", body="${body}"`);

    await Promise.all(
      tokens.map(({ token }) =>
        sendPushNotification({
          token,
          title,
          body,
          data: { type: "consult_user" },
          profileId,
        })
      )
    );

    log.info("consult_notification_sent", traceId, `Sent to ${tokens.length} device(s)`);
  } catch (err) {
    log.error("consult_notification_error", traceId, err.message);
    throw err;
  }
}

module.exports = { consultUser, sendConsultUserNotification };
