import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { PhoneCallback, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

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

export default function CallbackRequestsSection({ accountId }: { accountId: string }) {
  const { data: callbacks, isLoading } = useQuery({
    queryKey: ["callback-requests", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("callback_requests")
        .select("id, caller_name, caller_phone_e164, reason, priority, preferred_time_note, status, created_at")
        .eq("account_id", accountId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  return (
    <div>
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <PhoneCallback className="w-4 h-4 text-primary" />
        Demandes de rappel
      </h2>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!callbacks || callbacks.length === 0) && (
        <div className="text-sm text-muted-foreground p-6 text-center border border-border/40 rounded-xl bg-card/30">
          Aucune demande de rappel
        </div>
      )}

      {!isLoading && callbacks && callbacks.length > 0 && (
        <div className="space-y-2">
          {callbacks.map((cb, i) => (
            <motion.div
              key={cb.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">
                    {cb.caller_name || cb.caller_phone_e164 || "Inconnu"}
                  </span>
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${priorityStyles[cb.priority] || ""}`}>
                    {cb.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">
                    {statusLabels[cb.status] || cb.status}
                  </Badge>
                </div>
                {cb.reason && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{cb.reason}</p>
                )}
                {cb.preferred_time_note && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {cb.preferred_time_note}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatDate(cb.created_at)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
