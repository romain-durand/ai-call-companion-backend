import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  callerGroups,
  behaviorOptions,
  type CallerGroupType,
  type BehaviorType,
} from "@/data/mockData";

export default function CallerGroups() {
  const [behaviors, setBehaviors] = useState<Record<CallerGroupType, BehaviorType>>(
    Object.fromEntries(callerGroups.map((g) => [g.id, g.defaultBehavior])) as Record<CallerGroupType, BehaviorType>
  );
  const [expandedGroup, setExpandedGroup] = useState<CallerGroupType | null>(null);

  const getBehavior = (id: BehaviorType) => behaviorOptions.find((b) => b.id === id)!;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Qui peut vous joindre ?</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Définissez comment Aria gère les appels de chaque groupe de contacts.
        </p>
      </div>

      <div className="space-y-3">
        {callerGroups.map((group) => {
          const currentBehavior = getBehavior(behaviors[group.id]);
          const isExpanded = expandedGroup === group.id;

          return (
            <div key={group.id} className="space-y-0">
              {/* Group header */}
              <Card
                className={`cursor-pointer transition-all ${
                  isExpanded
                    ? "border-primary/30 bg-card/60"
                    : "bg-card/30 hover:bg-card/50"
                }`}
                onClick={() => setExpandedGroup(isExpanded ? null : group.id)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center text-2xl shrink-0">
                    {group.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{group.label}</h3>
                      {group.memberCount > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                          {group.memberCount} contacts
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {group.description}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-medium">
                        {currentBehavior.emoji} {currentBehavior.label}
                      </p>
                    </div>
                    <ChevronRight
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Expanded behavior selector */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="pt-2 pb-1 space-y-3">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {behaviorOptions.map((option) => {
                          const isSelected = behaviors[group.id] === option.id;
                          return (
                            <motion.div
                              key={option.id}
                              whileTap={{ scale: 0.97 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setBehaviors((prev) => ({ ...prev, [group.id]: option.id }));
                              }}
                            >
                              <Card
                                className={`cursor-pointer transition-all h-full ${
                                  isSelected
                                    ? "border-primary bg-primary/5 glow-primary"
                                    : "bg-card/20 hover:bg-card/40 border-border/50"
                                }`}
                              >
                                <CardContent className="p-3 relative">
                                  {isSelected && (
                                    <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                                      <Check className="w-2.5 h-2.5 text-primary-foreground" />
                                    </div>
                                  )}
                                  <span className="text-lg">{option.emoji}</span>
                                  <p className="text-xs font-medium mt-1.5">{option.label}</p>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                                    {option.description}
                                  </p>
                                </CardContent>
                              </Card>
                            </motion.div>
                          );
                        })}
                      </div>

                      {/* Live preview */}
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <Info className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium text-foreground">
                            Les {group.label.toLowerCase()}
                          </span>{" "}
                          {getBehavior(behaviors[group.id]).preview}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
