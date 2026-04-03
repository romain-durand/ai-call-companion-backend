import { useState } from "react";
import { motion } from "framer-motion";
import { Info, ChevronDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { smartScenarios, type SmartScenario } from "@/data/mockData";

export default function SmartScenarios() {
  const [scenarios, setScenarios] = useState<SmartScenario[]>(smartScenarios);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggle = (id: string) => {
    setScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Scénarios intelligents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Des automatismes prêts à l'emploi pour les situations courantes. Activez ceux qui vous correspondent.
        </p>
      </div>

      <div className="space-y-3">
        {scenarios.map((scenario) => {
          const isExpanded = expandedId === scenario.id;
          return (
            <Card
              key={scenario.id}
              className={`transition-all ${
                scenario.enabled
                  ? "bg-card/50 border-border"
                  : "bg-card/20 border-border/50 opacity-75"
              }`}
            >
              <CardContent className="p-0">
                <div className="p-4 flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                    {scenario.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{scenario.label}</h3>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {scenario.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {scenario.configurable && scenario.enabled && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : scenario.id)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ChevronDown
                          className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                    <Switch
                      checked={scenario.enabled}
                      onCheckedChange={() => toggle(scenario.id)}
                    />
                  </div>
                </div>

                {/* Preview */}
                {scenario.enabled && (
                  <div className="px-4 pb-3">
                    <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                      <p className="text-[11px] text-muted-foreground">{scenario.preview}</p>
                    </div>
                  </div>
                )}

                {/* Config */}
                {isExpanded && scenario.config && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="px-4 pb-4 overflow-hidden"
                  >
                    <div className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                      {Object.entries(scenario.config).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground capitalize">{key}</span>
                          <span className="text-xs font-medium">{value}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
