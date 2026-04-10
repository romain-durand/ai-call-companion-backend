const { supabaseAdmin } = require("./supabaseAdmin");
const log = require("../observability/logger");

/**
 * Create notifications for all account admins/owners from a notify_user tool call.
 * Returns a structured result with delivery_status.
 */
async function createDirectNotification(callCtx, args) {
  const accountId = callCtx.accountId;
  if (!accountId) {
    log.error("notify_user_failed", callCtx.traceId, "no accountId");
    return {
      success: false,
      notification_id: null,
      delivery_status: "failed",
      message: "No account context available.",
    };
  }

  try {
    // 1. Resolve recipients
    const { data: members, error: mErr } = await supabaseAdmin
      .from("account_members")
      .select("profile_id")
      .eq("account_id", accountId)
      .in("role", ["owner", "admin"]);

    if (mErr) throw mErr;
    if (!members || members.length === 0) {
      log.error("notify_user_failed", callCtx.traceId, "no admin/owner found");
      return {
        success: false,
        notification_id: null,
        delivery_status: "failed",
        message: "No account admin or owner found to notify.",
      };
    }

    // 2. Build notification content
    const callerLabel = args.caller_name || callCtx.callerNameRaw || "Un appelant";
    const body = args.summary || `Message de ${callerLabel}`;
    const priority = args.priority || "normal";

    // 3. Insert one notification per recipient
    const rows = members.map((m) => ({
      account_id: accountId,
      profile_id: m.profile_id,
      call_session_id: callCtx.callSessionId || null,
      channel: "push",
      priority,
      title: "Notification de l'assistant",
      body,
      status: "pending",
    }));

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert(rows)
      .select("id");

    if (error) throw error;

    const firstId = data[0]?.id || null;
    log.call("notification_created", callCtx.traceId,
      `count=${data.length} first=${firstId} priority=${priority}`);

    // 4. Attempt delivery for each recipient (best-effort)
    let finalDeliveryStatus = "stored";

    for (const notif of data) {
      const deliveryResult = await attemptNotificationDelivery(
        notif.id, accountId, callCtx.traceId
      );
      if (deliveryResult === "sent") finalDeliveryStatus = "sent";
    }

    log.call("notification_delivery_result", callCtx.traceId,
      `delivery_status=${finalDeliveryStatus} count=${data.length}`);

    return {
      success: true,
      notification_id: firstId,
      delivery_status: finalDeliveryStatus,
      message: "User notified.",
    };
  } catch (e) {
    log.error("notify_user_failed", callCtx.traceId, e.message);
    return {
      success: false,
      notification_id: null,
      delivery_status: "failed",
      message: `Notification failed: ${e.message}`,
    };
  }
}

/**
 * Best-effort delivery attempt for a single notification.
 * MVP: notifications are stored with status=pending.
 * When SMS/push infra is fully wired, this will attempt actual delivery.
 * Returns "stored" | "sent" | "failed".
 */
async function attemptNotificationDelivery(notificationId, accountId, traceId) {
  try {
    // MVP: mark as stored (pending). Real delivery channels (SMS, push)
    // will be wired here as they become available.
    log.info("notification_delivery_attempt", traceId,
      `notif=${notificationId} channel=push status=stored (MVP)`);
    return "stored";
  } catch (e) {
    log.error("notification_delivery_failed", traceId,
      `notif=${notificationId} error=${e.message}`);
    return "failed";
  }
}

module.exports = { createDirectNotification };
