// Shared view-model types used by providers and consumed by UI components

export interface DashboardStats {
  callsToday: number;
  callsThisWeek: number;
  appointmentsBooked: number;
  escalations: number;
  blocked: number;
  averageDuration: number;
  messagesLeft: number;
  satisfactionRate: number;
}

export interface RecentCallItem {
  id: string;
  callerName: string;
  groupEmoji: string;
  status: string;
  statusLabel: string;
  summary: string;
  urgent: boolean;
  actionsCount: number;
  timeLabel: string;
}

export interface CallbackRequestItem {
  id: string;
  callerLabel: string;
  reason: string | null;
  priority: string;
  preferredTimeNote: string | null;
  status: string;
  statusLabel: string;
  createdAtLabel: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string | null;
  priority: string;
  status: string;
  statusLabel: string;
  createdAtLabel: string;
}

export interface CallerGroupItem {
  id: string;
  name: string;
  emoji: string;
  description: string;
  contactCount: number;
  defaultBehavior: string;
  color: string;
}
