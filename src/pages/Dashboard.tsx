import { motion } from "framer-motion";
import { Phone, Calendar, AlertTriangle, ShieldCheck, Clock, ArrowRight, Bot } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, recentCalls, profiles, callerGroups } from "@/data/mockData";
import { useNavigate } from "react-router-dom";

const statCards = [
  { label: "Appels aujourd'hui", value: dashboardStats.callsToday, icon: Phone, color: "text-primary" },
  { label: "RDV pris", value: dashboardStats.appointmentsBooked, icon: Calendar, color: "text-glow-success" },
  { label: "Escalades", value: dashboardStats.escalations, icon: AlertTriangle, color: "text-glow-warning" },
  { label: "Bloqués", value: dashboardStats.blocked, icon: ShieldCheck, color: "text-muted-foreground" },
];

function formatTime(date: Date) {
  const now = new Date();
  const diffMin = Math.floor((now.getTime() - date.getTime()) / 60000);
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH}h`;
  return date.toLocaleDateString("fr-FR");
}

const groupEmoji: Record<string, string> = {};
callerGroups.forEach(g => { groupEmoji[g.id] = g.emoji; });

export default function Dashboard() {
  const navigate = useNavigate();
  const activeProfile = profiles.find(p => p.active);

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bonjour, Romain 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Profil actif : <span className="text-foreground font-medium">{activeProfile?.emoji} {activeProfile?.label}</span> · {dashboardStats.callsThisWeek} appels cette semaine
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-secondary flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-semibold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={() => navigate("/assistant")}>
          <Bot className="w-4 h-4 mr-1.5" /> Tester l'assistant
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/profiles")}>
          Changer de profil
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/history")}>
          Voir l'historique
        </Button>
      </div>

      {/* Recent calls */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium">Activité récente</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => navigate("/history")}>
            Tout voir <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {recentCalls.slice(0, 5).map((call) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/30 hover:bg-card/60 transition-colors cursor-pointer"
              onClick={() => navigate("/history")}
            >
              <span className="text-lg">{groupEmoji[call.group]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{call.callerName}</span>
                  {call.urgent && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">Urgent</Badge>}
                  {call.status === "blocked" && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">Bloqué</Badge>}
                </div>
                <p className="text-xs text-muted-foreground truncate">{call.summary}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatTime(call.timestamp)}</p>
                {call.actions.length > 0 && (
                  <p className="text-[10px] text-primary">{call.actions.length} action{call.actions.length > 1 ? "s" : ""}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
