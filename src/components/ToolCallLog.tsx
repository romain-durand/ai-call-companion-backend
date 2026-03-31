import { motion, AnimatePresence } from "framer-motion";
import { Bell, UserCheck, MessageSquare } from "lucide-react";
import type { ToolCall } from "@/hooks/useGeminiLive";

interface ToolCallLogProps {
  toolCalls: ToolCall[];
}

function getIcon(args: Record<string, string>) {
  const city = args.city || "";
  const lower = city.toLowerCase();
  // Check if it's a privileged contact
  const contacts = ["jacques", "bertrand", "colette", "hiromi", "théo", "theo"];
  if (contacts.some(c => lower.includes(c))) return <UserCheck className="w-4 h-4 text-glow-success" />;
  // Check if urgent
  if (lower.includes("urgent") || lower.includes("livreur")) return <Bell className="w-4 h-4 text-glow-warning" />;
  return <MessageSquare className="w-4 h-4 text-muted-foreground" />;
}

export function ToolCallLog({ toolCalls }: ToolCallLogProps) {
  if (toolCalls.length === 0) return null;

  return (
    <div className="w-full max-w-md space-y-2">
      <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-widest">
        Notifications
      </h3>
      <AnimatePresence>
        {toolCalls.map((tc) => (
          <motion.div
            key={tc.id}
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-3 rounded-lg bg-secondary border border-border"
          >
            <div className="mt-0.5">{getIcon(tc.args)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-medium">
                {tc.args.city || "Message"}
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                {tc.timestamp.toLocaleTimeString("fr-FR")}
              </p>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
