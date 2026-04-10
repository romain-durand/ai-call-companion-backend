import { recentCalls, callerGroups, type Call } from "@/data/mockData";

const groupEmoji = Object.fromEntries(callerGroups.map((g) => [g.id, g.emoji]));

export interface CallHistoryItem {
  id: string;
  // Identity
  callerName: string;
  callerNameRaw?: string;       // name from transcript
  contactName?: string;          // name from contacts DB
  callerNumber: string;
  groupSlug?: string;
  groupName?: string;
  groupIcon?: string;
  // Action
  actionType: string;            // message_taken | callback_requested | booking_proposed | escalated | blocked | refused | call_handled
  actionLabel: string;
  actionIcon: string;
  priority: string;              // low | normal | high
  // Summary
  summary: string;
  urgent: boolean;
  // Impact
  impactLabel: string;           // e.g. "Notification envoyée", "Aucune action requise"
  // Meta
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

function deriveAction(call: Call): { actionType: string; actionLabel: string; actionIcon: string } {
  if (call.status === "blocked") return { actionType: "blocked", actionLabel: "Bloqué", actionIcon: "🚫" };
  if (call.status === "voicemail") return { actionType: "message_taken", actionLabel: "Message pris", actionIcon: "📝" };
  const hasCallback = call.actions.some((a) => a.type === "callback");
  if (hasCallback) return { actionType: "callback_requested", actionLabel: "Rappel demandé", actionIcon: "🔁" };
  const hasEscalation = call.actions.some((a) => a.type === "escalation");
  if (hasEscalation) return { actionType: "escalated", actionLabel: "Escaladé", actionIcon: "⚠️" };
  const hasAppointment = call.actions.some((a) => a.type === "appointment");
  if (hasAppointment) return { actionType: "booking_proposed", actionLabel: "RDV proposé", actionIcon: "📅" };
  if (call.status === "missed") return { actionType: "refused", actionLabel: "Manqué", actionIcon: "📞" };
  return { actionType: "message_taken", actionLabel: "Message pris", actionIcon: "📝" };
}

function deriveImpact(call: Call): string {
  if (call.status === "blocked") return "Aucune action requise";
  const hasEscalation = call.actions.some((a) => a.type === "escalation");
  if (hasEscalation) return "Escalade en direct";
  if (call.status === "voicemail") return "Message enregistré";
  const hasCallback = call.actions.some((a) => a.type === "callback");
  if (hasCallback) return "Notification envoyée";
  return "Aucune action requise";
}

const groupMap: Record<string, { slug: string; name: string; icon: string }> = {
  family: { slug: "family", name: "Famille", icon: "👨‍👩‍👧‍👦" },
  clients: { slug: "clients", name: "Clients", icon: "💼" },
  unknown: { slug: "unknown", name: "Inconnus", icon: "❓" },
  deliveries: { slug: "deliveries", name: "Livraisons", icon: "📦" },
  vip: { slug: "vip", name: "VIP", icon: "⭐" },
};

export function getDemoCallHistory(): CallHistoryItem[] {
  return recentCalls.map((call) => {
    const action = deriveAction(call);
    const g = groupMap[call.group];
    return {
      id: call.id,
      callerName: call.callerName,
      callerNumber: call.callerNumber,
      groupSlug: g?.slug,
      groupName: g?.name,
      groupIcon: g?.icon || groupEmoji[call.group] || "❓",
      ...action,
      priority: call.urgent ? "high" : "normal",
      summary: call.summary,
      urgent: call.urgent,
      impactLabel: deriveImpact(call),
      timeLabel: formatTime(call.timestamp),
      durationLabel: formatDuration(call.duration),
      reasoning: call.reasoning,
      actions: call.actions.map((a) => ({ type: a.type, description: a.description })),
      transcript: call.transcript,
    };
  });
}
