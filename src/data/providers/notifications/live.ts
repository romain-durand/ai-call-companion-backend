import { supabase } from "@/integrations/supabase/client";
import type { NotificationItem } from "../types";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  sent: "Envoyée",
  delivered: "Délivrée",
  failed: "Échouée",
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export async function getLiveNotifications(accountIds: string[]): Promise<NotificationItem[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("id, title, body, priority, status, created_at")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return (data || []).map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    priority: n.priority,
    status: n.status,
    statusLabel: statusLabels[n.status] || n.status,
    createdAtLabel: formatDate(n.created_at),
  }));
}
