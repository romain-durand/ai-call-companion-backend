import { motion } from "framer-motion";
import { PhoneCall, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallbackRequestItem } from "@/data/providers/types";

const priorityStyles: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  normal: "bg-secondary text-secondary-foreground",
  high: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  items: CallbackRequestItem[];
  isLoading: boolean;
}

export default function CallbackRequestsSection({ items, isLoading }: Props) {
  return (
    <div>
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <PhoneCall className="w-4 h-4 text-primary" />
        Demandes de rappel
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
          Aucune demande de rappel
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((cb, i) => (
            <motion.div
              key={cb.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{cb.callerLabel}</span>
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${priorityStyles[cb.priority] || ""}`}>
                    {cb.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">
                    {cb.statusLabel}
                  </Badge>
                </div>
                {cb.reason && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{cb.reason}</p>
                )}
                {cb.preferredTimeNote && (
                  <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {cb.preferredTimeNote}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{cb.createdAtLabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
