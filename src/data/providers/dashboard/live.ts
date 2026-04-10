import { supabase } from "@/integrations/supabase/client";
import type { DashboardStats, RecentCallItem, PriorityItem, PerformanceStats } from "../types";
import { resolveContactNames, type ContactInfo } from "../contactResolver";

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

const eventTypeMap: Record<string, { label: string; icon: string }> = {
  completed: { label: "Appel traité", icon: "📞" },
  missed: { label: "Appel manqué", icon: "📞" },
  voicemail: { label: "Message vocal", icon: "📞" },
  escalated: { label: "Escalade", icon: "⚠️" },
  transferred: { label: "Transfert", icon: "📞" },
  rejected: { label: "Bloqué", icon: "🚫" },
  failed: { label: "Échoué", icon: "📞" },
};

export async function getLiveStats(accountIds: string[]): Promise<DashboardStats> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(today.getTime() - 7 * 86400000);

  const [sessionsRes, callbacksRes, appointmentsRes] = await Promise.all([
    supabase
      .from("call_sessions")
      .select("id, started_at, final_outcome, duration_seconds, escalated_to_user")
      .in("account_id", accountIds)
      .gte("started_at", weekAgo.toISOString())
      .order("started_at", { ascending: false }),
    supabase
      .from("callback_requests")
      .select("id")
      .in("account_id", accountIds)
      .gte("created_at", weekAgo.toISOString()),
    supabase
      .from("appointments")
      .select("id")
      .in("account_id", accountIds)
      .gte("created_at", weekAgo.toISOString()),
  ]);

  const all = sessionsRes.data || [];
  const todaySessions = all.filter((s) => new Date(s.started_at) >= today);

  return {
    callsToday: todaySessions.length,
    callsThisWeek: all.length,
    appointmentsBooked: appointmentsRes.data?.length || 0,
    escalations: all.filter((s) => s.escalated_to_user).length,
    blocked: all.filter((s) => s.final_outcome === "rejected").length,
    averageDuration: all.length > 0
      ? Math.round(all.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / all.length)
      : 0,
    messagesLeft: all.filter((s) => s.final_outcome === "voicemail").length,
    satisfactionRate: 0,
    callbacksCreated: callbacksRes.data?.length || 0,
  };
}

export async function getLiveRecentCalls(accountIds: string[]): Promise<RecentCallItem[]> {
  const { data } = await supabase
    .from("call_sessions")
    .select("id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, summary_llm, urgency_level, started_at, caller_group_id, contact_id")
    .in("account_id", accountIds)
    .order("started_at", { ascending: false })
    .limit(10);

  const sessions = data || [];
  const contactNames = await resolveContactNames(sessions, accountIds);

  return sessions.map((s) => {
    const evt = eventTypeMap[s.final_outcome] || { label: s.final_outcome, icon: "📞" };
    const contact = contactNames.get(s.caller_phone_e164 || "");
    return {
      id: s.id,
      callerName: contact?.displayName || s.caller_name_raw || s.caller_phone_e164 || "Inconnu",
      callerPhone: contact ? s.caller_phone_e164 || undefined : undefined,
      groupEmoji: evt.icon,
      status: s.final_outcome,
      statusLabel: outcomeLabels[s.final_outcome] || s.final_outcome,
      summary: s.summary_llm || s.summary_short || "",
      urgent: s.urgency_level === "high" || s.urgency_level === "critical",
      actionsCount: 0,
      timeLabel: formatTime(s.started_at),
      eventType: evt.label,
    };
  });
}

export async function getLivePriorityItems(accountIds: string[]): Promise<PriorityItem[]> {
  const [callbacksRes, escalationsRes] = await Promise.all([
    supabase
      .from("callback_requests")
      .select("id, caller_name, caller_phone_e164, reason, priority, status, created_at")
      .in("account_id", accountIds)
      .in("status", ["pending", "scheduled"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("escalation_events")
      .select("id, trigger_reason, urgency_level, status, created_at, call_session_id")
      .in("account_id", accountIds)
      .in("status", ["pending", "attempting"])
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const items: PriorityItem[] = [];

  // Resolve contact names for callbacks
  const cbPhones = (callbacksRes.data || []).map((cb) => ({ caller_phone_e164: cb.caller_phone_e164 }));
  const cbContactNames = await resolveContactNames(cbPhones, accountIds);

  for (const cb of callbacksRes.data || []) {
    const contact = cbContactNames.get(cb.caller_phone_e164 || "");
    items.push({
      id: cb.id,
      type: "callback",
      callerLabel: contact?.displayName || cb.caller_name || cb.caller_phone_e164 || "Inconnu",
      callerPhone: contact ? cb.caller_phone_e164 || undefined : undefined,
      summary: cb.reason || "Demande de rappel",
      priority: cb.priority === "urgent" ? "high" : cb.priority,
      timeLabel: formatTime(cb.created_at),
      icon: "🔁",
    });
  }

  for (const esc of escalationsRes.data || []) {
    const priority = esc.urgency_level === "critical" || esc.urgency_level === "high" ? "high" : "normal";
    items.push({
      id: esc.id,
      type: "escalation",
      callerLabel: "Escalade",
      summary: esc.trigger_reason,
      priority,
      timeLabel: formatTime(esc.created_at),
      icon: "⚠️",
    });
  }

  // Sort: high priority first, then by time
  const priorityOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
  items.sort((a, b) => (priorityOrder[a.priority] ?? 1) - (priorityOrder[b.priority] ?? 1));

  return items;
}

export async function getLivePerformanceStats(accountIds: string[]): Promise<PerformanceStats> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const { data: sessions } = await supabase
    .from("call_sessions")
    .select("id, final_outcome, escalated_to_user, duration_seconds")
    .in("account_id", accountIds)
    .gte("started_at", weekAgo.toISOString());

  const all = sessions || [];
  const total = all.length;

  if (total === 0) {
    return { resolvedWithoutEscalation: 0, escalationRate: 0, callbackRate: 0, averageDuration: 0, totalCalls: 0 };
  }

  const escalated = all.filter((s) => s.escalated_to_user).length;
  const resolved = all.filter((s) => !s.escalated_to_user && s.final_outcome === "completed").length;
  const avgDur = Math.round(all.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / total);

  // Get callbacks count for the same period
  const { data: cbs } = await supabase
    .from("callback_requests")
    .select("id")
    .in("account_id", accountIds)
    .gte("created_at", weekAgo.toISOString());

  return {
    resolvedWithoutEscalation: total > 0 ? Math.round((resolved / total) * 100) : 0,
    escalationRate: total > 0 ? Math.round((escalated / total) * 100) : 0,
    callbackRate: total > 0 ? Math.round(((cbs?.length || 0) / total) * 100) : 0,
    averageDuration: avgDur,
    totalCalls: total,
  };
}
