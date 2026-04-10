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

const outcomeLabels: Record<string, string> = {
  completed: "Traité",
  missed: "Manqué",
  rejected: "Bloqué",
  failed: "Échoué",
  voicemail: "Message",
  escalated: "Escaladé",
  transferred: "Transféré",
};

const outcomeToStatus: Record<string, string> = {
  completed: "answered",
  missed: "missed",
  rejected: "blocked",
  failed: "missed",
  voicemail: "voicemail",
  escalated: "answered",
  transferred: "answered",
};

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

export async function getLiveCallHistory(accountIds: string[]): Promise<CallHistoryItem[]> {
  const { data: sessions } = await supabase
    .from("call_sessions")
    .select(
      "id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, summary_long, summary_llm, urgency_level, started_at, duration_seconds, caller_group_id, detected_intent"
    )
    .in("account_id", accountIds)
    .order("started_at", { ascending: false })
    .limit(50);

  if (!sessions || sessions.length === 0) return [];

  // Resolve contact names
  const contactNames = await resolveContactNames(sessions, accountIds);

  // Fetch all messages for these sessions in one query
  const sessionIds = sessions.map((s) => s.id);
  const { data: messages } = await supabase
    .from("call_messages")
    .select("call_session_id, speaker, content_text, seq_no")
    .in("call_session_id", sessionIds)
    .order("seq_no", { ascending: true });

  // Group messages by session
  const messagesBySession: Record<string, typeof messages> = {};
  for (const msg of messages || []) {
    if (!messagesBySession[msg.call_session_id]) {
      messagesBySession[msg.call_session_id] = [];
    }
    messagesBySession[msg.call_session_id]!.push(msg);
  }

  return sessions.map((s) => {
    const contact = contactNames.get(s.caller_phone_e164 || "");
    return {
      id: s.id,
      callerName: contact?.displayName || s.caller_name_raw || s.caller_phone_e164 || "Inconnu",
      callerNumber: s.caller_phone_e164 || "",
    groupEmoji: "📞",
    status: outcomeToStatus[s.final_outcome] || s.final_outcome,
    statusLabel: outcomeLabels[s.final_outcome] || s.final_outcome,
    summary: s.summary_llm || s.summary_short || s.detected_intent || "Aucun résumé disponible",
    urgent: s.urgency_level === "high" || s.urgency_level === "critical",
    actionsCount: 0,
    timeLabel: formatTime(s.started_at),
    durationLabel: formatDuration(s.duration_seconds),
    reasoning: s.summary_long || undefined,
    actions: [],
    transcript: messagesBySession[s.id]
      ? formatTranscript(messagesBySession[s.id]!)
      : undefined,
  }));
}
