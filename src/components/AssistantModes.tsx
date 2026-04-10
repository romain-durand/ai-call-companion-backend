import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Info } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import type { Tables } from "@/integrations/supabase/types";

type AssistantMode = Tables<"assistant_modes">;
type CallerGroup = Tables<"caller_groups">;
type CallHandlingRule = Tables<"call_handling_rules">;

const BEHAVIOR_LABELS: Record<string, { label: string; color: string }> = {
  answer_and_take_message: { label: "Messagerie", color: "bg-muted text-muted-foreground" },
  answer_and_transfer: { label: "Transférer", color: "bg-blue-500/20 text-blue-400" },
  answer_and_book: { label: "Réserver", color: "bg-purple-500/20 text-purple-400" },
  answer_and_escalate: { label: "Escalader", color: "bg-amber-500/20 text-amber-400" },
  answer_only: { label: "Répondre", color: "bg-emerald-500/20 text-emerald-400" },
  block: { label: "Bloquer", color: "bg-red-500/20 text-red-400" },
  voicemail: { label: "Messagerie vocale", color: "bg-muted text-muted-foreground" },
};

const MODE_ICONS: Record<string, string> = {
  standard: "💼",
  work: "💼",
  personal: "🏠",
  night: "🌙",
  focus: "🎯",
};

export default function AssistantModes() {
  const { data: accountId } = useUserAccountId();

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

  if (modesLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
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

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Mode selector cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {modes.map((mode) => {
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

        {rulesLoading ? (
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
              const behavior = BEHAVIOR_LABELS[rule.behavior] || {
                label: rule.behavior,
                color: "bg-muted text-muted-foreground",
              };

              return (
                <Card key={rule.id} className="bg-card/30">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                      {group?.icon || "❓"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium">{group?.name || "Groupe inconnu"}</h3>
                    </div>
                    <Badge className={`${behavior.color} border-0 text-xs font-medium`}>
                      {behavior.label}
                    </Badge>
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
