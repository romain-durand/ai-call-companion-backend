import { supabase } from "@/integrations/supabase/client";
import type { CallHistoryItem } from "./demo";
import { resolveContactNames } from "../contactResolver";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number | null) {
  if (!seconds || seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const speakerLabels: Record<string, string> = {
  caller: "Appelant",
  assistant: "Aria",
  system: "Système",
  tool: "Outil",
};

function formatTranscript(messages: { speaker: string; content_text: string | null; seq_no: number }[]): string {
  return messages
    .filter((m) => m.content_text && m.speaker !== "tool" && m.speaker !== "system")
    .sort((a, b) => a.seq_no - b.seq_no)
    .map((m) => `${speakerLabels[m.speaker] || m.speaker}: ${m.content_text}`)
    .join("\n\n");
}

interface SessionEnrichment {
  hasCallback: boolean;
  hasEscalation: boolean;
  hasAppointment: boolean;
  hasNotification: boolean;
}

function deriveAction(
  outcome: string,
  escalatedToUser: boolean,
  enrichment: SessionEnrichment
): { actionType: string; actionLabel: string; actionIcon: string } {
  if (outcome === "rejected") return { actionType: "blocked", actionLabel: "Bloqué", actionIcon: "🚫" };
  if (enrichment.hasEscalation || escalatedToUser) return { actionType: "escalated", actionLabel: "Escaladé", actionIcon: "⚠️" };
  if (enrichment.hasCallback) return { actionType: "callback_requested", actionLabel: "Rappel demandé", actionIcon: "🔁" };
  if (enrichment.hasAppointment) return { actionType: "booking_proposed", actionLabel: "RDV proposé", actionIcon: "📅" };
  if (outcome === "voicemail") return { actionType: "message_taken", actionLabel: "Message pris", actionIcon: "📝" };
  if (outcome === "missed" || outcome === "failed") return { actionType: "refused", actionLabel: "Manqué", actionIcon: "📞" };
  return { actionType: "message_taken", actionLabel: "Message pris", actionIcon: "📝" };
}

function deriveImpact(
  outcome: string,
  escalatedToUser: boolean,
  enrichment: SessionEnrichment
): string {
  if (outcome === "rejected") return "Aucune action requise";
  if (enrichment.hasEscalation || escalatedToUser) return "Escalade en direct";
  if (enrichment.hasNotification) return "Notification envoyée";
  if (enrichment.hasCallback) return "Notification envoyée";
  if (outcome === "voicemail") return "Message enregistré";
  return "Aucune action requise";
}

function derivePriority(urgencyLevel: string): string {
  if (urgencyLevel === "critical" || urgencyLevel === "high") return "high";
  if (urgencyLevel === "medium") return "normal";
  return "low";
}

export async function getLiveCallHistory(accountIds: string[]): Promise<CallHistoryItem[]> {
  const { data: sessions } = await supabase
    .from("call_sessions")
    .select(
      "id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, summary_long, summary_llm, urgency_level, started_at, duration_seconds, caller_group_id, detected_intent, escalated_to_user, contact_id"
    )
    .in("account_id", accountIds)
    .order("started_at", { ascending: false })
    .limit(50);

  if (!sessions || sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  // Parallel data fetching
  // Collect unique phones to resolve contact group memberships
  const uniquePhones = [...new Set(sessions.map((s) => s.caller_phone_e164).filter(Boolean))] as string[];

  const [contactNames, messagesRes, callbacksRes, escalationsRes, appointmentsRes, notificationsRes, groupsRes, contactsWithGroupsRes] = await Promise.all([
    resolveContactNames(sessions, accountIds),
    supabase
      .from("call_messages")
      .select("call_session_id, speaker, content_text, seq_no")
      .in("call_session_id", sessionIds)
      .order("seq_no", { ascending: true }),
    supabase
      .from("callback_requests")
      .select("call_session_id")
      .in("call_session_id", sessionIds),
    supabase
      .from("escalation_events")
      .select("call_session_id")
      .in("call_session_id", sessionIds),
    supabase
      .from("appointments")
      .select("call_session_id")
      .in("call_session_id", sessionIds),
    supabase
      .from("notifications")
      .select("call_session_id")
      .in("call_session_id", sessionIds),
    supabase
      .from("caller_groups")
      .select("id, name, slug, icon")
      .in("account_id", accountIds),
    // Resolve group memberships via contacts' phone numbers
    uniquePhones.length > 0
      ? supabase
          .from("contacts")
          .select("primary_phone_e164, contact_group_memberships(caller_group_id)")
          .in("account_id", accountIds)
          .in("primary_phone_e164", uniquePhones)
      : Promise.resolve({ data: [] as any[] }),
  ]);

  // Build phone → first group id mapping
  const phoneToGroupId = new Map<string, string>();
  for (const c of contactsWithGroupsRes.data || []) {
    if (!c.primary_phone_e164) continue;
    const memberships = c.contact_group_memberships as { caller_group_id: string }[] | null;
    if (memberships && memberships.length > 0) {
      phoneToGroupId.set(c.primary_phone_e164, memberships[0].caller_group_id);
    }
  }

  // Index by session
  const messagesBySession: Record<string, typeof messagesRes.data> = {};
  for (const msg of messagesRes.data || []) {
    if (!messagesBySession[msg.call_session_id]) messagesBySession[msg.call_session_id] = [];
    messagesBySession[msg.call_session_id]!.push(msg);
  }

  const callbackSessions = new Set((callbacksRes.data || []).map((r) => r.call_session_id).filter(Boolean));
  const escalationSessions = new Set((escalationsRes.data || []).map((r) => r.call_session_id).filter(Boolean));
  const appointmentSessions = new Set((appointmentsRes.data || []).map((r) => r.call_session_id).filter(Boolean));
  const notificationSessions = new Set((notificationsRes.data || []).map((r) => r.call_session_id).filter(Boolean));

  const groupsById: Record<string, { name: string; slug: string; icon: string | null }> = {};
  for (const g of groupsRes.data || []) {
    groupsById[g.id] = { name: g.name, slug: g.slug, icon: g.icon };
  }

  return sessions.map((s) => {
    const contact = contactNames.get(s.caller_phone_e164 || "");
    const group = s.caller_group_id ? groupsById[s.caller_group_id] : undefined;

    const enrichment: SessionEnrichment = {
      hasCallback: callbackSessions.has(s.id),
      hasEscalation: escalationSessions.has(s.id),
      hasAppointment: appointmentSessions.has(s.id),
      hasNotification: notificationSessions.has(s.id),
    };

    const action = deriveAction(s.final_outcome, s.escalated_to_user, enrichment);
    const impact = deriveImpact(s.final_outcome, s.escalated_to_user, enrichment);
    const priority = derivePriority(s.urgency_level);

    // Identity mismatch: if contact name differs from transcript name
    const transcriptName = s.caller_name_raw || undefined;
    const resolvedContactName = contact?.displayName || undefined;
    const displayName = resolvedContactName || transcriptName || s.caller_phone_e164 || "Inconnu";

    // Show contactName only when there's a mismatch
    const showContactMismatch = transcriptName && resolvedContactName && transcriptName !== resolvedContactName;

    return {
      id: s.id,
      callerName: showContactMismatch ? transcriptName! : displayName,
      callerNameRaw: transcriptName,
      contactName: showContactMismatch ? resolvedContactName : undefined,
      callerNumber: s.caller_phone_e164 || "",
      groupSlug: group?.slug,
      groupName: group?.name,
      groupIcon: group?.icon || undefined,
      ...action,
      priority,
      summary: s.summary_llm || s.summary_short || s.detected_intent || "Aucun résumé disponible",
      urgent: s.urgency_level === "high" || s.urgency_level === "critical",
      impactLabel: impact,
      timeLabel: formatTime(s.started_at),
      durationLabel: formatDuration(s.duration_seconds),
      reasoning: s.summary_long || undefined,
      actions: [],
      transcript: messagesBySession[s.id]
        ? formatTranscript(messagesBySession[s.id]!)
        : undefined,
    };
  });
}
