import { supabase } from "@/integrations/supabase/client";
import type { DashboardStats, RecentCallItem } from "../types";

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return d.toLocaleDateString("fr-FR");
}

const outcomeLabels: Record<string, string> = {
  completed: "Traité",
  missed: "Manqué",
  rejected: "Rejeté",
  failed: "Échoué",
  voicemail: "Message",
  escalated: "Escaladé",
  transferred: "Transféré",
};

export async function getLiveStats(accountIds: string[]): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const { data: sessions } = await supabase
    .from("call_sessions")
    .select("id, started_at, final_outcome, duration_seconds, escalated_to_user")
    .in("account_id", accountIds)
    .gte("started_at", weekAgo.toISOString())
    .order("started_at", { ascending: false });

  const all = sessions || [];
  const todaySessions = all.filter((s) => new Date(s.started_at) >= today);

  return {
    callsToday: todaySessions.length,
    callsThisWeek: all.length,
    appointmentsBooked: 0, // TODO: count from appointments table
    escalations: all.filter((s) => s.escalated_to_user).length,
    blocked: all.filter((s) => s.final_outcome === "rejected").length,
    averageDuration: all.length > 0
      ? Math.round(all.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / all.length)
      : 0,
    messagesLeft: all.filter((s) => s.final_outcome === "voicemail").length,
    satisfactionRate: 0,
  };
}

export async function getLiveRecentCalls(accountIds: string[]): Promise<RecentCallItem[]> {
  const { data } = await supabase
    .from("call_sessions")
    .select("id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, urgency_level, started_at, caller_group_id")
    .in("account_id", accountIds)
    .order("started_at", { ascending: false })
    .limit(5);

  return (data || []).map((s) => ({
    id: s.id,
    callerName: s.caller_name_raw || s.caller_phone_e164 || "Inconnu",
    groupEmoji: "📞",
    status: s.final_outcome,
    statusLabel: outcomeLabels[s.final_outcome] || s.final_outcome,
    summary: s.summary_short || "",
    urgent: s.urgency_level === "high" || s.urgency_level === "critical",
    actionsCount: 0,
    timeLabel: formatTime(s.started_at),
  }));
}
