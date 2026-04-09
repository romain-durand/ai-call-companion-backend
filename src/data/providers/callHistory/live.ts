import { supabase } from "@/integrations/supabase/client";
import type { CallHistoryItem } from "./demo";

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

export async function getLiveCallHistory(accountIds: string[]): Promise<CallHistoryItem[]> {
  const { data } = await supabase
    .from("call_sessions")
    .select(
      "id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, summary_long, urgency_level, started_at, duration_seconds, caller_group_id, detected_intent"
    )
    .in("account_id", accountIds)
    .order("started_at", { ascending: false })
    .limit(50);

  return (data || []).map((s) => ({
    id: s.id,
    callerName: s.caller_name_raw || s.caller_phone_e164 || "Inconnu",
    callerNumber: s.caller_phone_e164 || "",
    groupEmoji: "📞",
    status: outcomeToStatus[s.final_outcome] || s.final_outcome,
    statusLabel: outcomeLabels[s.final_outcome] || s.final_outcome,
    summary: s.summary_short || s.detected_intent || "Aucun résumé disponible",
    urgent: s.urgency_level === "high" || s.urgency_level === "critical",
    actionsCount: 0,
    timeLabel: formatTime(s.started_at),
    durationLabel: formatDuration(s.duration_seconds),
    reasoning: s.summary_long || undefined,
    actions: [],
    transcript: undefined,
  }));
}
