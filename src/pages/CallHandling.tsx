import { ArrowRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { callerGroups, behaviorOptions } from "@/data/mockData";

export default function CallHandling() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comment ça marche</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Voici ce qui se passe quand quelqu'un vous appelle, selon le groupe auquel il appartient.
        </p>
      </div>

      <div className="space-y-3">
        {callerGroups.map((group) => {
          const behavior = behaviorOptions.find((b) => b.id === group.defaultBehavior)!;
          return (
            <Card key={group.id} className="bg-card/30">
              <CardContent className="p-4 flex items-center gap-4">
                <div className="flex items-center gap-2.5 w-32 shrink-0">
                  <span className="text-xl">{group.emoji}</span>
                  <span className="text-sm font-medium">{group.label}</span>
                </div>

                <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />

                <div className="flex items-center gap-2 flex-1">
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-secondary/20 text-xs text-muted-foreground">
                    📞 Appel entrant
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border bg-secondary/20 text-xs text-muted-foreground">
                    🤖 Aria analyse
                  </div>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-primary/20 bg-primary/5 text-xs font-medium text-primary">
                    {behavior.emoji} {behavior.label}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
        <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          Modifiez le comportement de chaque groupe depuis la page{" "}
          <span className="text-foreground font-medium">« Qui peut me joindre »</span>.
        </p>
      </div>
    </div>
  );
}
