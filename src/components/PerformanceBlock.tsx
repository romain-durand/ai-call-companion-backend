import { motion } from "framer-motion";
import { Bot, TrendingUp, PhoneOff, Clock, BarChart3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { PerformanceStats } from "@/data/providers/types";

interface Props {
  stats: PerformanceStats | undefined;
  isLoading: boolean;
}

export default function PerformanceBlock({ stats, isLoading }: Props) {
  if (isLoading) {
    return (
      <div>
        <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" />
          Performance de l'assistant
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (!stats || stats.totalCalls === 0) {
    return null;
  }

  const metrics = [
    {
      label: "Résolus sans escalade",
      value: `${stats.resolvedWithoutEscalation}%`,
      icon: TrendingUp,
      color: "text-glow-success",
    },
    {
      label: "Taux d'escalade",
      value: `${stats.escalationRate}%`,
      icon: PhoneOff,
      color: stats.escalationRate > 20 ? "text-glow-warning" : "text-muted-foreground",
    },
    {
      label: "Taux de rappel",
      value: `${stats.callbackRate}%`,
      icon: BarChart3,
      color: "text-muted-foreground",
    },
    {
      label: "Durée moyenne",
      value: `${stats.averageDuration}s`,
      icon: Clock,
      color: "text-muted-foreground",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Bot className="w-4 h-4 text-primary" />
        Performance de l'assistant
        <span className="text-xs text-muted-foreground font-normal ml-1">7 derniers jours · {stats.totalCalls} appels</span>
      </h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card/30"
          >
            <m.icon className={`w-4 h-4 ${m.color} shrink-0`} />
            <div>
              <p className="text-lg font-semibold">{m.value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{m.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
