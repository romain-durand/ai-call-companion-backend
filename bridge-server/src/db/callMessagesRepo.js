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

  ctx.messageSeqNo = (ctx.messageSeqNo || 0) + 1;
  const seq = ctx.messageSeqNo;

  const row = {
    account_id: ctx.accountId,
    call_session_id: ctx.callSessionId,
    speaker,
    seq_no: seq,
    content_text: contentText.trim(),
    content_json: extraData || null,
  };

  try {
    const { error } = await supabaseAdmin.from("call_messages").insert(row);
    if (error) throw error;
    log.call("msg_written", ctx.traceId, `#${seq} ${speaker}: "${contentText.trim().slice(0, 50)}"`);
  } catch (e) {
    log.error("msg_write_failed", ctx.traceId, `#${seq} ${speaker}: ${e.message}`);
  }
}

module.exports = { appendCallMessage };
