import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type AssistantMode = Tables<"assistant_modes">;
type CallerGroup = Tables<"caller_groups">;
type CallHandlingRule = Tables<"call_handling_rules">;

const BEHAVIOR_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: "take_message", label: "Prendre un message", icon: "📝" },
  { value: "transfer", label: "Transférer", icon: "📲" },
  { value: "ask_user", label: "Demander mon avis", icon: "💬" },
  { value: "book_appointment", label: "Proposer un RDV", icon: "📅" },
  { value: "block", label: "Bloquer", icon: "🚫" },
];

const MODE_ICONS: Record<string, string> = {
  work: "💼",
  personal: "🏠",
  focus: "🎯",
  night: "🌙",
  autopilot: "🤖",
};

export default function AssistantModes() {
  const { data: accountId } = useUserAccountId();
  const queryClient = useQueryClient();

  const { data: modes, isLoading: modesLoading } = useQuery({
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

  const activeMode = modes?.find((m) => m.is_active) || modes?.[0];
  const [selectedModeId, setSelectedModeId] = useState<string | null>(null);
  const currentModeId = selectedModeId || activeMode?.id;

  const { data: rules, isLoading: rulesLoading } = useQuery({
    queryKey: ["call-handling-rules", accountId, currentModeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_handling_rules")
        .select("*, caller_groups(*)")
        .eq("account_id", accountId!)
        .eq("assistant_mode_id", currentModeId!)
        .order("priority_rank", { ascending: false });
      if (error) throw error;
      return data as (CallHandlingRule & { caller_groups: CallerGroup })[];
    },
    enabled: !!accountId && !!currentModeId,
  });

  const updateBehavior = useMutation({
    mutationFn: async ({ ruleId, behavior }: { ruleId: string; behavior: string }) => {
      const { error } = await supabase
        .from("call_handling_rules")
        .update({ behavior: behavior as any })
        .eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["call-handling-rules", accountId, currentModeId] });
      toast.success("Règle mise à jour");
    },
    onError: () => {
      toast.error("Erreur lors de la mise à jour");
    },
  });

  if (modesLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!modes?.length) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
        Aucun mode configuré.
      </div>
    );
  }

  const autopilotMode = modes.find((m) => m.slug === "autopilot");
  const regularModes = modes.filter((m) => m.slug !== "autopilot");

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Autopilot card */}
      {autopilotMode && (() => {
        const isSelected = autopilotMode.id === currentModeId;
        return (
          <motion.div whileTap={{ scale: 0.98 }}>
            <Card
              className={`cursor-pointer transition-all ${
                isSelected
                  ? "border-emerald-500/60 bg-emerald-950/30 ring-1 ring-emerald-500/30"
                  : "bg-emerald-950/10 hover:bg-emerald-950/20 border-emerald-500/20"
              }`}
              onClick={() => setSelectedModeId(autopilotMode.id)}
            >
              <CardContent className="p-5 flex items-center gap-4 relative">
                {isSelected && (
                  <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className="text-3xl">🤖</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-emerald-400">{autopilotMode.name}</h3>
                    {autopilotMode.is_active && (
                      <Badge variant="secondary" className="text-[10px] h-4 px-1.5 bg-emerald-500/20 text-emerald-400 border-0">
                        Actif
                      </Badge>
                    )}
                  </div>
                  {autopilotMode.description && (
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {autopilotMode.description}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })()}

      {/* Regular mode selector cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {regularModes.map((mode) => {
          const isSelected = mode.id === currentModeId;
          const icon = MODE_ICONS[mode.slug] || "⚙️";

          return (
            <motion.div key={mode.id} whileTap={{ scale: 0.97 }}>
              <Card
                className={`cursor-pointer transition-all h-full ${
                  isSelected
                    ? "border-primary/50 bg-card/60 glow-primary"
                    : "bg-card/20 hover:bg-card/40 border-border/50"
                }`}
                onClick={() => setSelectedModeId(mode.id)}
              >
                <CardContent className="p-4 text-center relative">
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className="text-3xl mb-2">{icon}</div>
                  <h3 className="text-sm font-semibold">{mode.name}</h3>
                  {mode.description && (
                    <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                      {mode.description}
                    </p>
                  )}
                  {mode.is_active && (
                    <Badge variant="secondary" className="text-[10px] mt-2 h-4 px-1.5">
                      Actif
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Rules for selected mode */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">
          Règles pour « {modes.find((m) => m.id === currentModeId)?.name} »
        </h2>

        {currentModeId === autopilotMode?.id ? (
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
            <Info className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              En mode Pilote automatique, l'assistant décide librement comment traiter chaque appel.
              Il utilise tous les outils à sa disposition et adapte son comportement en fonction de l'appelant.
            </p>
          </div>
        ) : rulesLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !rules?.length ? (
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
            <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              Aucune règle définie pour ce mode. Les appels seront gérés avec le comportement par défaut.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule) => {
              const group = rule.caller_groups;

              return (
                <Card key={rule.id} className="bg-card/30">
                  <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                      {group?.icon || "❓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium">{group?.name || "Groupe inconnu"}</h3>
                    </div>
                    <Select
                      value={rule.behavior}
                      onValueChange={(value) =>
                        updateBehavior.mutate({ ruleId: rule.id, behavior: value })
                      }
                    >
                      <SelectTrigger className="w-full sm:w-[200px] h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BEHAVIOR_OPTIONS.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value} className="text-xs">
                            <span className="mr-1.5">{opt.icon}</span>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
