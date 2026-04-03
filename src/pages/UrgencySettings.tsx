import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  urgencyLevels,
  escalationOptions,
  type UrgencyLevel,
  type EscalationBehavior,
} from "@/data/mockData";

export default function UrgencySettings() {
  const [urgency, setUrgency] = useState<UrgencyLevel>("normal");
  const [escalation, setEscalation] = useState<EscalationBehavior>("send_notification");

  const currentUrgency = urgencyLevels.find((u) => u.id === urgency)!;
  const currentEscalation = escalationOptions.find((e) => e.id === escalation)!;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Quand vous déranger ?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez votre seuil d'alerte et comment Aria doit réagir en cas d'urgence.
        </p>
      </div>

      {/* Urgency sensitivity */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Sensibilité aux urgences</CardTitle>
          <p className="text-xs text-muted-foreground">
            À quel point voulez-vous être alerté ?
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {urgencyLevels.map((level) => {
              const isSelected = urgency === level.id;
              return (
                <motion.div key={level.id} whileTap={{ scale: 0.97 }}>
                  <Card
                    className={`cursor-pointer transition-all h-full ${
                      isSelected
                        ? "border-primary bg-primary/5 glow-primary"
                        : "bg-card/20 hover:bg-card/40 border-border/50"
                    }`}
                    onClick={() => setUrgency(level.id)}
                  >
                    <CardContent className="p-4 text-center relative">
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check className="w-2.5 h-2.5 text-primary-foreground" />
                        </div>
                      )}
                      <span className="text-2xl">{level.emoji}</span>
                      <p className="text-sm font-medium mt-2">{level.label}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 leading-snug">
                        {level.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* Example */}
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10">
            <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Exemple :</span>{" "}
              {currentUrgency.example}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Escalation behavior */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Que faire en cas d'urgence ?</CardTitle>
          <p className="text-xs text-muted-foreground">
            Quand Aria détecte une situation urgente, comment doit-elle réagir ?
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {escalationOptions.map((option) => {
            const isSelected = escalation === option.id;
            return (
              <motion.div key={option.id} whileTap={{ scale: 0.98 }}>
                <div
                  className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : "border-border/50 bg-card/20 hover:bg-card/40"
                  }`}
                  onClick={() => setEscalation(option.id)}
                >
                  <span className="text-xl">{option.emoji}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{option.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {option.description}
                    </p>
                  </div>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Summary preview */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <p className="text-xs font-medium text-primary mb-1">Ce qui va se passer</p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Aria détectera les urgences avec une sensibilité{" "}
            <span className="text-foreground font-medium">
              « {currentUrgency.label.toLowerCase()} »
            </span>
            . En cas d'alerte, elle{" "}
            <span className="text-foreground font-medium">
              {escalation === "call_immediately"
                ? "vous appellera immédiatement"
                : escalation === "send_notification"
                ? "vous enverra une notification"
                : "ne vous dérangera que pour les urgences vitales"}
            </span>
            .
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
