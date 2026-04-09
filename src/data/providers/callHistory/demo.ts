import { recentCalls, callerGroups, type Call } from "@/data/mockData";

const groupEmoji = Object.fromEntries(callerGroups.map((g) => [g.id, g.emoji]));

const statusMap: Record<string, string> = {
  answered: "completed",
  missed: "missed",
  blocked: "rejected",
  voicemail: "voicemail",
};

export interface CallHistoryItem {
  id: string;
  callerName: string;
  callerNumber: string;
  groupEmoji: string;
  status: string;
  statusLabel: string;
  summary: string;
  urgent: boolean;
  actionsCount: number;
  timeLabel: string;
  durationLabel: string;
  reasoning?: string;
  actions: { type: string; description: string }[];
  transcript?: string;
}

function formatTime(date: Date) {
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number) {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const statusLabels: Record<string, string> = {
  answered: "Traité",
  missed: "Manqué",
  blocked: "Bloqué",
  voicemail: "Message",
};

export function getDemoCallHistory(): CallHistoryItem[] {
  return recentCalls.map((call) => ({
    id: call.id,
    callerName: call.callerName,
    callerNumber: call.callerNumber,
    groupEmoji: groupEmoji[call.group] || "❓",
    status: call.status,
    statusLabel: statusLabels[call.status] || call.status,
    summary: call.summary,
    urgent: call.urgent,
    actionsCount: call.actions.length,
    timeLabel: formatTime(call.timestamp),
    durationLabel: formatDuration(call.duration),
    reasoning: call.reasoning,
    actions: call.actions.map((a) => ({ type: a.type, description: a.description })),
    transcript: call.transcript,
  }));
}
