import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Clock, ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { recentCalls, callerGroups, type Call } from "@/data/mockData";

function formatTime(date: Date) {
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function formatDuration(seconds: number) {
  if (seconds === 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  answered: { label: "Répondu", variant: "default" },
  missed: { label: "Manqué", variant: "destructive" },
  blocked: { label: "Bloqué", variant: "secondary" },
  voicemail: { label: "Messagerie", variant: "outline" },
};

const groupEmoji = Object.fromEntries(callerGroups.map(g => [g.id, g.emoji]));

function CallRow({ call }: { call: Call }) {
  const [open, setOpen] = useState(false);
  const st = statusLabels[call.status];

  return (
    <Card className="bg-card/30 hover:bg-card/50 transition-colors">
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={() => setOpen(!open)}
        >
          <span className="text-lg">{groupEmoji[call.group]}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{call.callerName}</span>
              {call.urgent && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Urgent</Badge>}
              <Badge variant={st.variant} className="text-[10px] h-4 px-1.5">{st.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{call.summary}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-xs text-muted-foreground">{formatTime(call.timestamp)}</p>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
                <Clock className="w-3 h-3" /> {formatDuration(call.duration)}
              </p>
            </div>
            {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                {/* Actions */}
                {call.actions.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Actions</p>
                    <div className="space-y-1">
                      {call.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <span className="text-primary">•</span>
                          <span>{a.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Transcript */}
                {call.transcript && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">Transcription</p>
                    <pre className="text-xs font-mono text-foreground/70 whitespace-pre-wrap bg-secondary/30 rounded-lg p-3 leading-relaxed">
                      {call.transcript}
                    </pre>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground">{call.callerNumber}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function CallHistory() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Historique des appels</h1>
        <p className="text-sm text-muted-foreground mt-1">{recentCalls.length} appels récents</p>
      </div>

      <div className="space-y-2">
        {recentCalls.map((call) => (
          <CallRow key={call.id} call={call} />
        ))}
      </div>
    </div>
  );
}
