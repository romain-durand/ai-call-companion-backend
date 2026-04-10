import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { PriorityItem } from "@/data/providers/types";

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  normal: "bg-secondary text-secondary-foreground border-border",
  low: "bg-muted text-muted-foreground border-border",
};

const priorityLabels: Record<string, string> = {
  high: "Urgent",
  normal: "Normal",
  low: "Faible",
};

const leftBorderStyles: Record<string, string> = {
  high: "border-l-destructive",
  normal: "border-l-primary/40",
  low: "border-l-muted-foreground/30",
};

interface Props {
  items: PriorityItem[];
  isLoading: boolean;
}

export default function PrioritySection({ items, isLoading }: Props) {
  const queryClient = useQueryClient();

  async function handleDismiss(item: PriorityItem) {
    const table = item.type === "callback" ? "callback_requests" : "escalation_events";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) {
      toast.error("Impossible de supprimer cet élément");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["priority-items"] });
  }

  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-glow-warning" />
          À traiter
        </h2>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-glow-warning" />
        À traiter
        {items.length > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 px-2 rounded-full ml-1">
            {items.length}
          </Badge>
        )}
      </h2>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-3 p-5 rounded-xl border border-border/40 bg-card/30 text-sm text-muted-foreground"
        >
          <CheckCircle className="w-4 h-4 text-glow-success" />
          Aucune action requise — tout est sous contrôle
        </motion.div>
      ) : (
        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ delay: i * 0.04 }}
              className={`flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30 border-l-2 ${leftBorderStyles[item.priority] || ""}`}
            >
              <span className="text-lg shrink-0">{item.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{item.callerLabel}</span>
                  {item.callerPhone && (
                    <span className="text-[10px] text-muted-foreground/60 font-mono">{item.callerPhone}</span>
                  )}
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${priorityStyles[item.priority] || ""}`}>
                    {priorityLabels[item.priority] || item.priority}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5 rounded-full">
                    {item.type === "callback" ? "Rappel" : item.type === "escalation" ? "Escalade" : "Notification"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.summary}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <p className="text-xs text-muted-foreground">{item.timeLabel}</p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDismiss(item)}
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
