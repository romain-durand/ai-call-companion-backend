import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Clock, ChevronDown, ChevronUp, Brain, Zap, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallHistory, type CallHistoryItem } from "@/data/providers/callHistory";

const statusConfig: Record<string, { label: string; style: string }> = {
  answered: { label: "Traité", style: "bg-primary/10 text-primary border-primary/20" },
  missed: { label: "Manqué", style: "bg-glow-warning/10 text-glow-warning border-glow-warning/20" },
  blocked: { label: "Bloqué", style: "bg-muted text-muted-foreground border-border" },
  voicemail: { label: "Message", style: "bg-secondary text-secondary-foreground border-border" },
};

const actionIcons: Record<string, string> = {
  appointment: "📅",
  message: "💬",
  escalation: "🚨",
  callback: "📞",
  info: "ℹ️",
  blocked: "🚫",
};

function CallRow({ call, onDelete }: { call: CallHistoryItem; onDelete: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const st = statusConfig[call.status] || statusConfig.answered;

  return (
    <Card className="bg-card/40 border-border/40 hover:border-border/70 transition-all">
      <CardContent className="p-0">
        <div
          className="flex items-center gap-4 p-4 cursor-pointer group"
          onClick={() => setOpen(!open)}
        >
          <span className="text-lg">{call.groupEmoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium">{call.callerName}</span>
              {call.callerNumber && call.callerName !== call.callerNumber && (
                <span className="text-[10px] text-muted-foreground/60 font-mono">{call.callerNumber}</span>
              )}
              {call.urgent && (
                <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full">Urgent</Badge>
              )}
              <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${st.style}`}>{call.statusLabel}</Badge>
              {call.actionsCount > 0 && (
                <span className="text-[10px] text-primary font-medium">{call.actionsCount} action{call.actionsCount > 1 ? "s" : ""}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-1">{call.summary}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{call.timeLabel}</p>
              <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 justify-end mt-0.5">
                <Clock className="w-3 h-3" /> {call.durationLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(call.id);
              }}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-secondary/50 group-hover:bg-secondary transition-colors">
              {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
                {call.reasoning && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <Brain className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[11px] font-medium text-primary mb-1">Raisonnement d'Aria</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{call.reasoning}</p>
                    </div>
                  </div>
                )}

                {call.actions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs font-medium text-foreground">Actions effectuées</p>
                    </div>
                    <div className="space-y-1.5">
                      {call.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-xs p-2 rounded-lg bg-secondary/30">
                          <span className="text-sm">{actionIcons[a.type] || "•"}</span>
                          <span className="text-foreground/80">{a.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {call.transcript && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Transcription</p>
                    <div className="text-xs text-foreground/70 whitespace-pre-wrap bg-secondary/20 rounded-lg p-4 leading-relaxed font-mono border border-border/30">
                      {call.transcript}
                    </div>
                  </div>
                )}

                {call.callerNumber && (
                  <p className="text-[10px] text-muted-foreground/50 font-mono">{call.callerNumber}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function CallHistory() {
  const { data: calls, isLoading } = useCallHistory();
  const queryClient = useQueryClient();

  async function handleDelete(id: string) {
    const { error } = await supabase.from("call_sessions").delete().eq("id", id);
    if (error) {
      toast.error("Impossible de supprimer cet appel");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["call-history"] });
    queryClient.invalidateQueries({ queryKey: ["recent-calls"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold tracking-tight">Historique des appels</h1>
        <p className="text-sm text-muted-foreground mt-2">
          {isLoading ? "Chargement…" : `${calls?.length || 0} appels récents · Cliquez pour voir les détails`}
        </p>
      </motion.div>

      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && (!calls || calls.length === 0) && (
        <Card className="bg-card/40 border-border/40">
          <CardContent className="py-12 text-center">
            <Phone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Aucun appel pour le moment</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && calls && calls.length > 0 && (
        <div className="space-y-2">
          {calls.map((call, i) => (
            <motion.div key={call.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <CallRow call={call} onDelete={handleDelete} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
