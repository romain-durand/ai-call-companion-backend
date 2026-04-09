import { supabase } from "@/integrations/supabase/client";
import type { CallbackRequestItem } from "../types";

const statusLabels: Record<string, string> = {
  pending: "En attente",
  scheduled: "Planifié",
  completed: "Terminé",
  cancelled: "Annulé",
  expired: "Expiré",
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

export async function getLiveCallbackRequests(accountIds: string[]): Promise<CallbackRequestItem[]> {
  const { data, error } = await supabase
    .from("callback_requests")
    .select("id, caller_name, caller_phone_e164, reason, priority, preferred_time_note, status, created_at")
    .in("account_id", accountIds)
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) throw error;

  return (data || []).map((cb) => ({
    id: cb.id,
    callerLabel: cb.caller_name || cb.caller_phone_e164 || "Inconnu",
    reason: cb.reason,
    priority: cb.priority,
    preferredTimeNote: cb.preferred_time_note,
    status: cb.status,
    statusLabel: statusLabels[cb.status] || cb.status,
    createdAtLabel: formatDate(cb.created_at),
  }));
}
