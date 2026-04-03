import { Phone, ArrowRight, MessageSquare, ShieldCheck, AlertTriangle, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { callerGroups, profiles } from "@/data/mockData";

const actionIcons: Record<string, typeof Phone> = {
  answer: Phone,
  voicemail: MessageSquare,
  block: ShieldCheck,
  escalate: AlertTriangle,
};

const actionLabels: Record<string, string> = {
  answer: "Répondre & Transférer",
  voicemail: "Prendre un message",
  block: "Bloquer l'appel",
  escalate: "Escalader (urgent)",
};

const actionColors: Record<string, string> = {
  answer: "text-primary border-primary/20 bg-primary/5",
  voicemail: "text-muted-foreground border-border bg-secondary/30",
  block: "text-destructive border-destructive/20 bg-destructive/5",
  escalate: "text-glow-warning border-glow-warning/20 bg-glow-warning/5",
};

export default function CallHandling() {
  const activeProfile = profiles.find(p => p.active) ?? profiles[0];
  const groupMap = Object.fromEntries(callerGroups.map(g => [g.id, g]));

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gestion des appels</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Aperçu du parcours d'un appel selon le profil « {activeProfile.emoji} {activeProfile.label} ».
        </p>
      </div>

      <div className="space-y-3">
        {activeProfile.rules.map((rule) => {
          const group = groupMap[rule.group];
          const Icon = actionIcons[rule.action];
          return (
            <Card key={rule.group} className="bg-card/30">
              <CardContent className="p-4 flex items-center gap-4">
                {/* Caller group */}
                <div className="flex items-center gap-2.5 w-36 shrink-0">
                  <span className="text-xl">{group.emoji}</span>
                  <span className="text-sm font-medium">{group.label}</span>
                </div>

                {/* Arrow */}
                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                {/* Flow: Identify → Decide → Act */}
                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-secondary/20 text-xs text-muted-foreground">
                    <Phone className="w-3 h-3" />
                    Appel entrant
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-secondary/20 text-xs text-muted-foreground">
                    🤖 Identification
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium ${actionColors[rule.action]}`}>
                    <Icon className="w-3 h-3" />
                    {actionLabels[rule.action]}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 pt-2">
        {Object.entries(actionLabels).map(([key, label]) => {
          const Icon = actionIcons[key];
          return (
            <div key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon className="w-3 h-3" />
              {label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
