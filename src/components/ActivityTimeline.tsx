import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import type { RecentCallItem } from "@/data/providers/types";

const statusStyles: Record<string, string> = {
  answered: "bg-primary/10 text-primary border-primary/20",
  missed: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  blocked: "bg-muted text-muted-foreground border-border",
  voicemail: "bg-secondary text-secondary-foreground border-border",
  completed: "bg-primary/10 text-primary border-primary/20",
  escalated: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  transferred: "bg-secondary text-secondary-foreground border-border",
  rejected: "bg-muted text-muted-foreground border-border",
  failed: "bg-destructive/10 text-destructive border-destructive/20",
};

interface Props {
  items: RecentCallItem[];
  isLoading: boolean;
}

export default function ActivityTimeline({ items, isLoading }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Activité récente</h2>
        <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/history")}>
          Tout voir <ArrowRight className="w-3.5 h-3.5 ml-1" />
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-sm text-muted-foreground p-6 text-center border border-border/40 rounded-xl bg-card/30">
          Aucune activité récente
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border border-border/40 bg-card/30 hover:bg-card/60 transition-all cursor-pointer group"
              onClick={() => navigate("/history")}
            >
              <span className="text-base shrink-0">{call.groupEmoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{call.callerName}</span>
                  {call.callerPhone && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono hidden sm:inline">{call.callerPhone}</span>
                  )}
                  {call.urgent && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full">Urgent</Badge>
                  )}
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${statusStyles[call.status] || ""}`}>
                    {call.statusLabel}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {call.eventType && <span className="text-muted-foreground/70">{call.eventType} · </span>}
                  {call.summary}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground">{call.timeLabel}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
