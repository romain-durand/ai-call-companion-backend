const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Append a call message row.
 * speaker: 'caller' | 'assistant' | 'tool' | 'system'
 * Non-blocking: errors are logged but never thrown.
 */
async function appendCallMessage(ctx, speaker, contentText, extraData) {
  if (!ctx.callSessionId || !ctx.accountId) return;
  if (!contentText || contentText.trim().length === 0) return;

  // Simple dedup: skip if identical to last message from same speaker
  const key = `${speaker}:${contentText.trim()}`;
  if (ctx._lastMsgKey === key) return;
  ctx._lastMsgKey = key;

  ctx.messageSeqNo = (ctx.messageSeqNo || 0) + 1;

  const row = {
    account_id: ctx.accountId,
    call_session_id: ctx.callSessionId,
    speaker,
    seq_no: ctx.messageSeqNo,
    content_text: contentText.trim(),
    content_json: extraData || null,
  };

  try {
    const { error } = await supabaseAdmin.from("call_messages").insert(row);
    if (error) throw error;
    log.call("call_message_written", ctx.traceId, `#${ctx.messageSeqNo} ${speaker}`);
  } catch (e) {
    log.error("db_write_failed", ctx.traceId, `call_messages: ${e.message}`);
  }
}

module.exports = { appendCallMessage };
