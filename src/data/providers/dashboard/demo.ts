import type { DashboardStats, RecentCallItem, PriorityItem, PerformanceStats } from "../types";
import { dashboardStats, recentCalls, callerGroups } from "@/data/mockData";

const groupEmoji: Record<string, string> = {};
callerGroups.forEach((g) => { groupEmoji[g.id] = g.emoji; });

const statusLabels: Record<string, string> = {
  answered: "Traité",
  missed: "Manqué",
  blocked: "Bloqué",
  voicemail: "Message",
};

function formatTime(date: Date) {
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR");
}

export function getDemoStats(): DashboardStats {
  return { ...dashboardStats, callbacksCreated: 2 };
}

export function getDemoRecentCalls(): RecentCallItem[] {
  return recentCalls.slice(0, 10).map((call) => ({
    id: call.id,
    callerName: call.callerName,
    groupEmoji: groupEmoji[call.group] || "📞",
    status: call.status,
    statusLabel: statusLabels[call.status] || call.status,
    summary: call.summary,
    urgent: call.urgent,
    actionsCount: call.actions.length,
    timeLabel: formatTime(call.timestamp),
    eventType: call.actions[0]?.type === "callback" ? "Rappel demandé"
      : call.actions[0]?.type === "escalation" ? "Escalade"
      : call.actions[0]?.type === "appointment" ? "RDV pris"
      : call.status === "blocked" ? "Bloqué"
      : "Appel traité",
  }));
}

export function getDemoPriorityItems(): PriorityItem[] {
  return [
    {
      id: "demo-cb-1",
      type: "callback",
      callerLabel: "Dr. Martin",
      summary: "Résultats d'analyse à discuter",
      priority: "high",
      timeLabel: "il y a 12 min",
      icon: "🔁",
    },
    {
      id: "demo-cb-2",
      type: "callback",
      callerLabel: "Sophie Lefèvre",
      summary: "Question sur le devis envoyé",
      priority: "normal",
      timeLabel: "il y a 45 min",
      icon: "🔁",
    },
    {
      id: "demo-esc-1",
      type: "escalation",
      callerLabel: "Escalade",
      summary: "Appel urgent non résolu — client mécontent",
      priority: "high",
      timeLabel: "il y a 8 min",
      icon: "⚠️",
    },
  ];
}

export function getDemoPerformanceStats(): PerformanceStats {
  return {
    resolvedWithoutEscalation: 87,
    escalationRate: 8,
    callbackRate: 15,
    averageDuration: 42,
    totalCalls: 24,
  };
}
