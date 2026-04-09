import { DashboardStats, RecentCallItem } from "../types";
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
  return { ...dashboardStats };
}

export function getDemoRecentCalls(): RecentCallItem[] {
  return recentCalls.slice(0, 5).map((call) => ({
    id: call.id,
    callerName: call.callerName,
    groupEmoji: groupEmoji[call.group] || "❓",
    status: call.status,
    statusLabel: statusLabels[call.status] || call.status,
    summary: call.summary,
    urgent: call.urgent,
    actionsCount: call.actions.length,
    timeLabel: formatTime(call.timestamp),
  }));
}
