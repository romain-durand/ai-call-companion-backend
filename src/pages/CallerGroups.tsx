import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { callerGroups } from "@/data/mockData";

export default function CallerGroups() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Groupes d'appelants</h1>
        <p className="text-sm text-muted-foreground mt-1">Organisez vos contacts pour personnaliser le comportement de l'assistant.</p>
      </div>

      <div className="space-y-3">
        {callerGroups.map((group) => (
          <Card key={group.id} className="bg-card/30 hover:bg-card/60 transition-colors">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                {group.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{group.label}</h3>
                  {group.memberCount > 0 && (
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{group.memberCount} contacts</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{group.description}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">Comportement par défaut</p>
                <p className="text-sm font-medium text-primary">{group.defaultBehavior}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
