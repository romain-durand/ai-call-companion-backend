import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
  const queryClient = useQueryClient();

  async function handleDelete(item: RecentCallItem) {
    const isMission = item.id.startsWith("mission-");
    const realId = isMission ? item.id.replace("mission-", "") : item.id;

    if (isMission) {
      // Fetch the mission to get its linked call_session_id
      const { data: mission } = await supabase
        .from("outbound_missions")
        .select("call_session_id")
        .eq("id", realId)
        .single();
      const { error } = await supabase.from("outbound_missions").delete().eq("id", realId);
      if (error) {
        toast.error("Impossible de supprimer cet élément");
        return;
      }
      // Also delete the linked call session
      if (mission?.call_session_id) {
        await supabase.from("call_sessions").delete().eq("id", mission.call_session_id);
      }
    } else {
      const { error } = await supabase.from("call_sessions").delete().eq("id", realId);
      if (error) {
        toast.error("Impossible de supprimer cet élément");
        return;
      }
    }
    queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
    toast.success("Élément supprimé");
  }

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
          <AnimatePresence>
            {items.map((call, i) => {
              const isMission = call.id.startsWith("mission-");
              const targetId = isMission ? call.callSessionId : call.id;
              const canOpenDetail = !isMission || !!call.callSessionId;
              return (
              <motion.div
                key={call.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => {
                  if (canOpenDetail && targetId) {
                    navigate(`/history#call-${targetId}`);
                  } else {
                    navigate("/history");
                  }
                }}
                className="flex items-start gap-2.5 sm:gap-3 p-3 sm:p-3.5 rounded-xl border border-border/40 bg-card/30 hover:bg-card/60 transition-all group cursor-pointer"
              >
                <span className="text-base shrink-0 mt-0.5">{call.groupEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <span className="text-sm font-medium">{call.callerName}</span>
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
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {call.eventType && <span className="text-muted-foreground/70">{call.eventType} · </span>}
                    {call.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <p className="text-[10px] sm:text-xs text-muted-foreground">{call.timeLabel}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(call);
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
