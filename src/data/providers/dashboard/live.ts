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

const missionStatusLabels: Record<string, string> = {
  completed: "Terminée",
  failed: "Échouée",
  cancelled: "Annulée",
  queued: "En attente",
  draft: "Brouillon",
  in_progress: "En cours",
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
  // Fetch both call sessions and outbound missions in parallel
  const [sessionsRes, missionsRes] = await Promise.all([
    supabase
      .from("call_sessions")
      .select("id, caller_name_raw, caller_phone_e164, final_outcome, summary_short, summary_llm, urgency_level, started_at, caller_group_id, contact_id")
      .in("account_id", accountIds)
      .order("started_at", { ascending: false })
      .limit(8),
    supabase
      .from("outbound_missions")
      .select("id, target_name, target_phone_e164, objective, status, result_status, result_summary, started_at, completed_at, created_at, hangup_by")
      .in("account_id", accountIds)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const missions = missionsRes.data || [];

  // Exclude call_sessions that are linked to an outbound mission to avoid duplicates
  const missionSessionIds = new Set(missions.map((m) => m.call_session_id).filter(Boolean));
  const sessions = (sessionsRes.data || []).filter((s) => !missionSessionIds.has(s.id));

  const contactNames = await resolveContactNames(sessions, accountIds);

  const callItems: RecentCallItem[] = sessions.map((s) => {
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
      _sortDate: s.started_at,
    };
  });

  const missionItems: RecentCallItem[] = missions.map((m) => {
    // Determine display status
    let displayStatus = m.status;
    if (m.status === "in_progress") {
      if (m.completed_at) {
        displayStatus = m.result_status === "failure" || m.result_status === "no_answer" ? "failed" : "completed";
      } else {
        const startedAt = m.started_at ? new Date(m.started_at).getTime() : 0;
        if (startedAt && Date.now() - startedAt > 5 * 60 * 1000) {
          displayStatus = "failed";
        }
      }
    }

    const statusLabel = missionStatusLabels[displayStatus] || displayStatus;
    const statusKey = displayStatus === "completed" ? "completed" : displayStatus === "failed" || displayStatus === "cancelled" ? "failed" : "missed";

    return {
      id: `mission-${m.id}`,
      callerName: m.target_name || m.target_phone_e164 || "Inconnu",
      callerPhone: m.target_phone_e164 || undefined,
      groupEmoji: "🚀",
      status: statusKey,
      statusLabel,
      summary: m.result_summary || m.objective || "",
      urgent: false,
      actionsCount: 0,
      timeLabel: formatTime(m.started_at || m.created_at),
      eventType: "Mission sortante",
      _sortDate: m.started_at || m.created_at,
    };
  });

  // Merge and sort by date descending, take 8
  const merged = [...callItems, ...missionItems]
    .sort((a, b) => new Date((b as any)._sortDate).getTime() - new Date((a as any)._sortDate).getTime())
    .slice(0, 8);

  // Remove internal _sortDate
  return merged.map(({ _sortDate, ...rest }: any) => rest);
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

  const callbacks = callbacksRes.data || [];
  const escalations = escalationsRes.data || [];

  const priorityMap: Record<string, string> = {
    urgent: "high",
    high: "high",
    normal: "normal",
    low: "low",
  };

  const items: PriorityItem[] = [
    ...callbacks.map((cb) => ({
      id: cb.id,
      type: "callback" as const,
      callerLabel: cb.caller_name || cb.caller_phone_e164 || "Inconnu",
      callerPhone: cb.caller_phone_e164 || undefined,
      summary: cb.reason || "Demande de rappel",
      priority: priorityMap[cb.priority] || "normal",
      timeLabel: formatTime(cb.created_at),
      icon: "🔁",
      createdAt: cb.created_at,
    })),
    ...escalations.map((esc) => ({
      id: esc.id,
      type: "escalation" as const,
      callerLabel: "Escalade",
      summary: esc.trigger_reason,
      priority: esc.urgency_level === "critical" || esc.urgency_level === "high" ? "high" : "normal",
      timeLabel: formatTime(esc.created_at),
      icon: "⚠️",
      createdAt: esc.created_at,
    })),
  ];

  items.sort((a, b) => {
    const pOrder: Record<string, number> = { high: 0, normal: 1, low: 2 };
    return (pOrder[a.priority] ?? 1) - (pOrder[b.priority] ?? 1);
  });

  return items;
}

export async function getLivePerformanceStats(accountIds: string[]): Promise<PerformanceStats> {
  const weekAgo = new Date(Date.now() - 7 * 86400000);

  const { data } = await supabase
    .from("call_sessions")
    .select("id, escalated_to_user, duration_seconds, final_outcome")
    .in("account_id", accountIds)
    .gte("started_at", weekAgo.toISOString());

  const all = data || [];
  if (all.length === 0) return { resolvedWithoutEscalation: 0, escalationRate: 0, callbackRate: 0, averageDuration: 0, totalCalls: 0 };

  const escalated = all.filter((s) => s.escalated_to_user).length;
  const callbacks = all.filter((s) => s.final_outcome === "voicemail").length;

  return {
    resolvedWithoutEscalation: Math.round(((all.length - escalated) / all.length) * 100),
    escalationRate: Math.round((escalated / all.length) * 100),
    callbackRate: Math.round((callbacks / all.length) * 100),
    averageDuration: Math.round(all.reduce((sum, s) => sum + (s.duration_seconds || 0), 0) / all.length),
    totalCalls: all.length,
  };
}
