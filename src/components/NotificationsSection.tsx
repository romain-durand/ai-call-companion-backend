import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

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

export default function NotificationsSection({ accountIds }: { accountIds: string[] }) {
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", accountIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, priority, status, created_at")
        .in("account_id", accountIds)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: accountIds.length > 0,
  });

  return (
    <div>
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Bell className="w-4 h-4 text-primary" />
        Notifications
      </h2>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!notifications || notifications.length === 0) && (
        <div className="text-sm text-muted-foreground p-6 text-center border border-border/40 rounded-xl bg-card/30">
          Aucune notification
        </div>
      )}

      {!isLoading && notifications && notifications.length > 0 && (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{n.title}</span>
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${priorityStyles[n.priority] || ""}`}>
                    {n.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">
                    {statusLabels[n.status] || n.status}
                  </Badge>
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatDate(n.created_at)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
