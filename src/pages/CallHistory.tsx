import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Clock, ChevronDown, ChevronUp, Brain, Zap, X, Bell, BellOff, Check } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useCallHistory, type CallHistoryItem } from "@/data/providers/callHistory";

// ── Action styling ──────────────────────────────────────────────────────────
const actionStyles: Record<string, string> = {
  message_taken: "bg-secondary text-secondary-foreground border-border",
  callback_requested: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  booking_proposed: "bg-glow-success/10 text-glow-success border-glow-success/20",
  escalated: "bg-destructive/10 text-destructive border-destructive/20",
  blocked: "bg-muted text-muted-foreground border-border",
  refused: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  call_handled: "bg-primary/10 text-primary border-primary/20",
};

const priorityStyles: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  normal: "bg-secondary text-secondary-foreground border-border",
  low: "bg-muted text-muted-foreground/60 border-border/50",
};
const priorityLabels: Record<string, string> = { high: "Urgent", normal: "Normal", low: "Faible" };

// ── Filter chips ────────────────────────────────────────────────────────────
const filterChips = [
  { slug: "all", label: "Tous", icon: "📋" },
  { slug: "family", label: "Famille", icon: "👨‍👩‍👧‍👦" },
  { slug: "vip", label: "VIP", icon: "⭐" },
  { slug: "clients", label: "Clients", icon: "💼" },
  { slug: "unknown", label: "Inconnus", icon: "❓" },
  { slug: "blocked", label: "Bloqués", icon: "🚫" },
];

const detailActionIcons: Record<string, string> = {
  appointment: "📅",
  message: "💬",
  escalation: "🚨",
  callback: "📞",
  info: "ℹ️",
  blocked: "🚫",
};

// ── Call Row ────────────────────────────────────────────────────────────────
function CallRow({ call, onDelete, defaultOpen, scrollIntoView }: { call: CallHistoryItem; onDelete: (id: string) => void; defaultOpen?: boolean; scrollIntoView?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);

  useEffect(() => {
    if (scrollIntoView && rootRef.current) {
      rootRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [scrollIntoView]);

  return (
    <Card ref={rootRef} id={`call-${call.id}`} className="bg-card/40 border-border/40 hover:border-border/70 transition-all scroll-mt-24">
      <CardContent className="p-0">
        <div
          className="flex items-start sm:items-center gap-2.5 sm:gap-3 p-3 sm:p-4 cursor-pointer group"
          onClick={() => setOpen(!open)}
        >
          {/* Action icon */}
          <span className="text-base shrink-0">{call.actionIcon}</span>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Row 1: Identity + badges */}
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <span className="text-base font-medium">{call.callerName}</span>
              {call.callerNumber && call.callerName !== call.callerNumber && (
                <span className="text-xs text-muted-foreground/60 font-mono hidden sm:inline">{call.callerNumber}</span>
              )}
              {/* Identity mismatch */}
              {call.contactName && (
                <span className="text-xs text-muted-foreground/50 italic">
                  (contact: {call.contactName})
                </span>
              )}
            </div>

            {/* Row 2: Action + priority badges */}
            <div className="flex items-center gap-2 mt-2">
              <Badge className={`text-xs h-5 px-2 rounded-full border ${actionStyles[call.actionType] || actionStyles.call_handled}`}>
                {call.actionLabel}
              </Badge>
              {call.priority !== "low" && (
                <Badge className={`text-xs h-5 px-2 rounded-full border ${priorityStyles[call.priority]}`}>
                  {priorityLabels[call.priority]}
                </Badge>
              )}
              {call.groupIcon && call.groupName && (
                <span className="text-xs text-muted-foreground/50 flex items-center gap-0.5 ml-1">
                  {call.groupIcon} {call.groupName}
                </span>
              )}
            </div>

            {/* Row 3: Summary */}
            <p className="text-sm text-muted-foreground mt-2">{call.summary}</p>

            {/* Row 4: Impact indicator */}
            <p className="text-[10px] text-muted-foreground/50 flex items-center gap-1 mt-0.5">
              {(call.impactLabel || "").includes("Notification") || (call.impactLabel || "").includes("Escalade")
                ? <Bell className="w-2.5 h-2.5" />
                : <BellOff className="w-2.5 h-2.5" />
              }
              {call.impactLabel}
            </p>
          </div>

          {/* Right side: time + actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div className="text-right">
              <p className="text-[10px] sm:text-xs text-muted-foreground">{call.timeLabel}</p>
              <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1 justify-end mt-0.5">
                <Clock className="w-3 h-3" /> {call.durationLabel}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity hidden sm:flex"
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

        {/* Expanded detail */}
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
                {call.actions.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Zap className="w-3.5 h-3.5 text-primary" />
                      <p className="text-xs font-medium text-foreground">Actions effectuées</p>
                    </div>
                    <div className="space-y-1.5">
                      {call.actions.map((a, i) => (
                        <div key={i} className="flex items-center gap-2.5 text-xs p-2 rounded-lg bg-secondary/30">
                          <span className="text-sm">{detailActionIcons[a.type] || "•"}</span>
                          <span className="text-foreground/80">{a.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {call.transcript && (
                  <div>
                    <p className="text-xs font-medium text-foreground mb-2">Transcription</p>
                    <div className="text-xs text-foreground/70 whitespace-pre-wrap bg-secondary/20 rounded-lg p-4 leading-relaxed font-mono border border-border/30 max-h-64 overflow-y-auto">
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

// ── Page ────────────────────────────────────────────────────────────────────
export default function CallHistory() {
  const { data: calls, isLoading } = useCallHistory();
  const queryClient = useQueryClient();
  const [activeFilter, setActiveFilter] = useState("all");
  const location = useLocation();
  const targetCallId = useMemo(() => {
    const h = location.hash || "";
    return h.startsWith("#call-") ? h.slice("#call-".length) : null;
  }, [location.hash]);

  // If deep-linked to a specific call, ensure it isn't hidden by an active filter.
  useEffect(() => {
    if (targetCallId) setActiveFilter("all");
  }, [targetCallId]);

  const filteredCalls = useMemo(() => {
    if (!calls) return [];
    if (activeFilter === "all") return calls;
    if (activeFilter === "blocked") return calls.filter((c) => c.actionType === "blocked");
    return calls.filter((c) => c.groupSlug === activeFilter);
  }, [calls, activeFilter]);

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
    <div className="space-y-5 sm:space-y-6 max-w-3xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">Historique des appels</h1>
          <p className="text-base text-muted-foreground mt-2">
            {isLoading ? "Chargement…" : `${filteredCalls.length} appel${filteredCalls.length > 1 ? "s" : ""} · Cliquez pour voir les détails`}
          </p>
        </div>

        {(() => {
          const active = filterChips.find((c) => c.slug === activeFilter) ?? filterChips[0];
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-full px-5 h-10 text-sm gap-2 shrink-0">
                  <span className="text-base">{active.icon}</span>
                  {active.label}
                  <ChevronDown className="w-4 h-4 ml-0.5 opacity-70" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[10rem]">
                {filterChips.map((chip) => (
                  <DropdownMenuItem
                    key={chip.slug}
                    onSelect={() => setActiveFilter(chip.slug)}
                    className="text-xs gap-2"
                  >
                    <span className="text-sm">{chip.icon}</span>
                    <span className="flex-1">{chip.label}</span>
                    {chip.slug === activeFilter && <Check className="w-3.5 h-3.5 text-primary" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        })()}
      </motion.div>

      {/* List */}
      {isLoading && (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      )}

      {!isLoading && filteredCalls.length === 0 && (
        <Card className="bg-card/40 border-border/40">
          <CardContent className="py-12 text-center">
            <Phone className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              {activeFilter === "all" ? "Aucun appel pour le moment" : "Aucun appel dans cette catégorie"}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && filteredCalls.length > 0 && (
        <div className="space-y-2">
          {filteredCalls.map((call, i) => (
            <motion.div key={call.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <CallRow
                call={call}
                onDelete={handleDelete}
                defaultOpen={call.id === targetCallId}
                scrollIntoView={call.id === targetCallId}
              />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
