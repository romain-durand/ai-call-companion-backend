import { useState } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { profiles as initialProfiles, callerGroups, type Profile, type ProfileMode } from "@/data/mockData";

const actionLabels: Record<string, { label: string; color: string }> = {
  answer: { label: "Répondre", color: "bg-primary/10 text-primary" },
  voicemail: { label: "Messagerie", color: "bg-secondary text-secondary-foreground" },
  block: { label: "Bloquer", color: "bg-destructive/10 text-destructive" },
  escalate: { label: "Escalader", color: "bg-glow-warning/10 text-glow-warning" },
};

export default function Profiles() {
  const [activeId, setActiveId] = useState<ProfileMode>("work");

  const groupMap = Object.fromEntries(callerGroups.map(g => [g.id, g]));

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profils</h1>
        <p className="text-sm text-muted-foreground mt-1">Choisissez comment votre assistant gère les appels selon le moment.</p>
      </div>

      {/* Profile cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {initialProfiles.map((profile) => {
          const isActive = profile.id === activeId;
          return (
            <motion.div key={profile.id} whileTap={{ scale: 0.97 }}>
              <Card
                className={`cursor-pointer transition-all ${isActive ? "border-primary bg-primary/5 glow-primary" : "bg-card/30 hover:bg-card/60"}`}
                onClick={() => setActiveId(profile.id)}
              >
                <CardContent className="p-4 text-center relative">
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <span className="text-2xl">{profile.emoji}</span>
                  <p className="text-sm font-medium mt-2">{profile.label}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">{profile.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Active profile rules */}
      {(() => {
        const active = initialProfiles.find(p => p.id === activeId)!;
        return (
          <div>
            <h2 className="text-lg font-medium mb-3">Règles pour « {active.label} »</h2>
            <div className="space-y-2">
              {active.rules.map((rule) => {
                const group = groupMap[rule.group];
                const action = actionLabels[rule.action];
                return (
                  <div key={rule.group} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card/30">
                    <div className="flex items-center gap-2.5">
                      <span className="text-lg">{group.emoji}</span>
                      <span className="text-sm font-medium">{group.label}</span>
                    </div>
                    <Badge className={`${action.color} border-0`}>{action.label}</Badge>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
