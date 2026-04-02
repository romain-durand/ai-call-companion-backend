import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Loader2, CheckCircle2, XCircle } from "lucide-react";
import type { ToolExchange } from "@/hooks/useGeminiLive";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ToolExchangeLogProps {
  exchanges: ToolExchange[];
}

function StatusIcon({ status }: { status: ToolExchange["status"] }) {
  if (status === "pending") return <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />;
  if (status === "success") return <CheckCircle2 className="w-4 h-4 text-glow-success" />;
  return <XCircle className="w-4 h-4 text-destructive" />;
}

function formatJson(obj: unknown): string {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(obj);
  }
}

export function ToolExchangeLog({ exchanges }: ToolExchangeLogProps) {
  if (exchanges.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucun appel d'outil pour le moment.
      </p>
    );
  }

  return (
    <ScrollArea className="h-[400px] w-full">
      <div className="space-y-3 pr-3">
        <AnimatePresence>
          {[...exchanges].reverse().map((ex) => (
            <motion.div
              key={ex.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-lg border border-border bg-secondary/50 overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50">
                <StatusIcon status={ex.status} />
                <span className="text-sm font-semibold text-foreground">{ex.callName}</span>
                <span className="text-xs text-muted-foreground font-mono ml-auto">
                  {ex.callTimestamp.toLocaleTimeString("fr-FR")}
                </span>
              </div>

              {/* Call args */}
              <div className="px-3 py-2 border-b border-border/30">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span className="text-xs font-mono text-primary uppercase tracking-wider">Appel Gemini</span>
                </div>
                <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all bg-background/50 rounded p-2">
                  {formatJson(ex.callArgs)}
                </pre>
              </div>

              {/* Response */}
              <div className="px-3 py-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <ArrowLeft className="w-3 h-3 text-glow-success" />
                  <span className="text-xs font-mono text-glow-success uppercase tracking-wider">Réponse</span>
                  {ex.responseTimestamp && (
                    <span className="text-xs text-muted-foreground font-mono ml-auto">
                      {ex.responseTimestamp.toLocaleTimeString("fr-FR")}
                    </span>
                  )}
                </div>
                {ex.response ? (
                  <pre className="text-xs font-mono text-foreground/80 whitespace-pre-wrap break-all bg-background/50 rounded p-2">
                    {formatJson(ex.response)}
                  </pre>
                ) : (
                  <p className="text-xs text-muted-foreground italic">En attente...</p>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
