import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PlayCircle, Phone, Bot, Zap, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { testScenarios, type TestScenario } from "@/data/mockData";

function SimulationView({ scenario, onBack }: { scenario: TestScenario; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [showActions, setShowActions] = useState(false);
  const dialogue = scenario.simulatedDialogue;

  const advance = () => {
    if (step < dialogue.length - 1) {
      setStep(step + 1);
    } else {
      setShowActions(true);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack} className="text-muted-foreground">
          ← Retour
        </Button>
        <div>
          <h2 className="text-lg font-medium">{scenario.emoji} {scenario.label}</h2>
          <p className="text-xs text-muted-foreground">{scenario.description}</p>
        </div>
      </div>

      {/* Dialogue */}
      <div className="space-y-3 min-h-[280px]">
        <AnimatePresence>
          {dialogue.slice(0, step + 1).map((line, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`flex gap-3 ${line.speaker === "aria" ? "" : "flex-row-reverse"}`}
            >
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs ${
                line.speaker === "aria" ? "bg-primary/10 text-primary" : "bg-secondary text-foreground"
              }`}>
                {line.speaker === "aria" ? <Bot className="w-4 h-4" /> : <Phone className="w-4 h-4" />}
              </div>
              <div className={`max-w-[75%] p-3 rounded-2xl text-sm leading-relaxed ${
                line.speaker === "aria"
                  ? "bg-primary/8 border border-primary/15 text-foreground rounded-tl-md"
                  : "bg-secondary/60 border border-border/40 text-foreground rounded-tr-md"
              }`}>
                {line.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Actions */}
      {!showActions ? (
        <Button onClick={advance} className="w-full rounded-full" size="lg">
          {step < dialogue.length - 1 ? "Continuer la conversation" : "Voir les actions"}
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm font-medium">Actions d'Aria</p>
          </div>
          {scenario.expectedActions.map((action, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/10 text-sm"
            >
              <span className="text-primary">✓</span>
              <span className="text-foreground/80">{action}</span>
            </motion.div>
          ))}
          <Button variant="outline" onClick={onBack} className="w-full rounded-full mt-4">
            Tester un autre scénario
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function TestAssistant() {
  const [activeScenario, setActiveScenario] = useState<TestScenario | null>(null);

  if (activeScenario) {
    return (
      <div className="max-w-2xl">
        <SimulationView scenario={activeScenario} onBack={() => setActiveScenario(null)} />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-semibold tracking-tight">Tester votre assistant</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Simulez un appel entrant pour voir comment Aria réagit. Choisissez un scénario.
        </p>
      </motion.div>

      <div className="grid gap-3">
        {testScenarios.map((scenario, i) => (
          <motion.div
            key={scenario.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card
              className="bg-card/40 border-border/40 hover:border-border/70 hover:bg-card/60 transition-all cursor-pointer group"
              onClick={() => setActiveScenario(scenario)}
            >
              <CardContent className="p-5 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-secondary/60 flex items-center justify-center text-xl shrink-0 group-hover:bg-secondary transition-colors">
                  {scenario.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{scenario.label}</h3>
                    {scenario.isUrgent && (
                      <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full">Urgent</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{scenario.description}</p>
                </div>
                <PlayCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
