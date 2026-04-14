import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
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
      // Deactivate all modes for this account
      const { error: deactivateErr } = await supabase
        .from("assistant_modes")
        .update({ is_active: false })
        .eq("account_id", accountId!);
      if (deactivateErr) throw deactivateErr;

      // Activate the selected mode
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
    },
    onError: () => {
      toast.error("Impossible de changer de mode");
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!modes?.length) return null;

  const activeMode = modes.find((m) => m.is_active);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Mode actif</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {modes.map((mode) => {
          const isActive = mode.id === activeMode?.id;
          const icon = MODE_ICONS[mode.slug] || "⚙️";
          const isAutopilot = mode.slug === "autopilot";

          return (
            <motion.div key={mode.id} whileTap={{ scale: 0.97 }}>
              <Card
                className={`cursor-pointer transition-all ${
                  isActive
                    ? isAutopilot
                      ? "border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/30"
                      : "border-primary/50 bg-card/60"
                    : isAutopilot
                      ? "bg-emerald-950/10 hover:bg-emerald-950/20 border-emerald-500/20"
                      : "bg-card/20 hover:bg-card/40 border-border/30"
                }`}
                onClick={() => {
                  if (!isActive && !switchMode.isPending) {
                    switchMode.mutate(mode.id);
                  }
                }}
              >
                <CardContent className="p-3 text-center relative">
                  {isActive && (
                    <div className={`absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center ${
                      isAutopilot ? "bg-emerald-500" : "bg-primary"
                    }`}>
                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                    </div>
                  )}
                  <div className="text-2xl mb-1">{icon}</div>
                  <h3 className={`text-xs font-semibold ${isAutopilot ? "text-emerald-400" : ""}`}>{mode.name}</h3>
                  {mode.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {mode.description}
                    </p>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
