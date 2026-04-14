import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type AssistantMode = Tables<"assistant_modes">;

const MODE_ICONS: Record<string, string> = {
  work: "💼",
  personal: "🏠",
  focus: "🎯",
  autopilot: "🤖",
};

export default function ActiveModeSelector() {
  const { data: accountId } = useUserAccountId();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const { data: modes, isLoading } = useQuery({
    queryKey: ["assistant-modes", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("assistant_modes")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at");
      if (error) throw error;
      return data as AssistantMode[];
    },
    enabled: !!accountId,
  });

  const switchMode = useMutation({
    mutationFn: async (newModeId: string) => {
      const { error: deactivateErr } = await supabase
        .from("assistant_modes")
        .update({ is_active: false })
        .eq("account_id", accountId!);
      if (deactivateErr) throw deactivateErr;

      const { error: activateErr } = await supabase
        .from("assistant_modes")
        .update({ is_active: true })
        .eq("id", newModeId);
      if (activateErr) throw activateErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["assistant-modes"] });
      queryClient.invalidateQueries({ queryKey: ["active-mode-sidebar"] });
      toast.success("Mode activé");
      setExpanded(false);
    },
    onError: () => {
      toast.error("Impossible de changer de mode");
    },
  });

  if (isLoading) {
    return <Skeleton className="h-16 rounded-xl" />;
  }

  if (!modes?.length) return null;

  const activeMode = modes.find((m) => m.is_active);
  if (!activeMode) return null;

  const isAutopilot = activeMode.slug === "autopilot";
  const activeIcon = MODE_ICONS[activeMode.slug] || "⚙️";
  const otherModes = modes.filter((m) => m.id !== activeMode.id);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Mode actif</h2>
      </div>

      {/* Active mode - always visible */}
      <Card
        className={`cursor-pointer transition-all ${
          isAutopilot
            ? "border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/30"
            : "border-primary/50 bg-card/60"
        }`}
        onClick={() => setExpanded(!expanded)}
      >
        <CardContent className="p-3 flex items-center gap-3">
          <div className="text-2xl">{activeIcon}</div>
          <div className="flex-1 min-w-0">
            <h3 className={`text-sm font-semibold ${isAutopilot ? "text-emerald-400" : ""}`}>
              {activeMode.name}
            </h3>
            {activeMode.description && (
              <p className="text-[10px] text-muted-foreground leading-snug line-clamp-1">
                {activeMode.description}
              </p>
            )}
          </div>
          <div className={`w-5 h-5 rounded-full flex items-center justify-center ${
            isAutopilot ? "bg-emerald-500" : "bg-primary"
          }`}>
            <Check className="w-3 h-3 text-primary-foreground" />
          </div>
          <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
        </CardContent>
      </Card>

      {/* Other modes - shown on expand */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden space-y-1.5"
          >
            {otherModes.map((mode) => {
              const icon = MODE_ICONS[mode.slug] || "⚙️";
              const modeIsAutopilot = mode.slug === "autopilot";

              return (
                <motion.div key={mode.id} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-all ${
                      modeIsAutopilot
                        ? "bg-emerald-950/10 hover:bg-emerald-950/20 border-emerald-500/20"
                        : "bg-card/20 hover:bg-card/40 border-border/30"
                    }`}
                    onClick={() => {
                      if (!switchMode.isPending) {
                        switchMode.mutate(mode.id);
                      }
                    }}
                  >
                    <CardContent className="p-3 flex items-center gap-3">
                      <div className="text-xl">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className={`text-xs font-semibold ${modeIsAutopilot ? "text-emerald-400" : ""}`}>
                          {mode.name}
                        </h3>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
