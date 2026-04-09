import { motion } from "framer-motion";
import { Bell } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { NotificationItem } from "@/data/providers/types";

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  critical: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  items: NotificationItem[];
  isLoading: boolean;
}

export default function NotificationsSection({ items, isLoading }: Props) {
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

      {!isLoading && items.length === 0 && (
        <div className="text-sm text-muted-foreground p-6 text-center border border-border/40 rounded-xl bg-card/30">
          Aucune notification
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((n, i) => (
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
                    {n.statusLabel}
                  </Badge>
                </div>
                {n.body && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{n.body}</p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{n.createdAtLabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
