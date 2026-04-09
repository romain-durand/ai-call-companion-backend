import { motion } from "framer-motion";
import { Phone, Calendar, AlertTriangle, ShieldCheck, ArrowRight, Bot, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { dashboardStats, recentCalls, profiles, callerGroups } from "@/data/mockData";
import { useNavigate } from "react-router-dom";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import CallbackRequestsSection from "@/components/CallbackRequestsSection";
import NotificationsSection from "@/components/NotificationsSection";

const statCards = [
  { label: "Appels aujourd'hui", value: dashboardStats.callsToday, icon: Phone, color: "text-primary", sub: `${dashboardStats.callsThisWeek} cette semaine` },
  { label: "RDV pris", value: dashboardStats.appointmentsBooked, icon: Calendar, color: "text-glow-success", sub: "Cette semaine" },
  { label: "Escalades", value: dashboardStats.escalations, icon: AlertTriangle, color: "text-glow-warning", sub: "Situations urgentes" },
  { label: "Bloqués", value: dashboardStats.blocked, icon: ShieldCheck, color: "text-muted-foreground", sub: "Spam filtré" },
];

const insightCards = [
  { label: "Messages vocaux", value: dashboardStats.messagesLeft, icon: MessageSquare, color: "text-glow-primary" },
  { label: "Durée moy.", value: `${dashboardStats.averageDuration}s`, icon: Clock, color: "text-muted-foreground" },
  { label: "Satisfaction", value: `${dashboardStats.satisfactionRate}%`, icon: TrendingUp, color: "text-glow-success" },
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

const statusStyles: Record<string, string> = {
  answered: "bg-primary/10 text-primary border-primary/20",
  missed: "bg-glow-warning/10 text-glow-warning border-glow-warning/20",
  blocked: "bg-muted text-muted-foreground border-border",
  voicemail: "bg-secondary text-secondary-foreground border-border",
};

const statusLabels: Record<string, string> = {
  answered: "Traité",
  missed: "Manqué",
  blocked: "Bloqué",
  voicemail: "Message",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { data: accountIds } = useUserAccountIds();
  const activeProfile = profiles.find(p => p.active);

  return (
    <div className="space-y-10 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-semibold tracking-tight">Bonjour, Romain</h1>
        <p className="text-muted-foreground text-sm mt-2">
          Profil actif : <span className="text-foreground font-medium">{activeProfile?.emoji} {activeProfile?.label}</span> · Aria est en ligne et gère vos appels
        </p>
      </motion.div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card/60 border-border/50 hover:border-border transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className={`w-9 h-9 rounded-lg bg-secondary/80 flex items-center justify-center ${stat.color}`}>
                    <stat.icon className="w-4 h-4" />
                  </div>
                </div>
                <p className="text-3xl font-semibold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Insights row */}
      <div className="grid grid-cols-3 gap-4">
        {insightCards.map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}>
            <div className="flex items-center gap-3 p-4 rounded-xl border border-border/40 bg-card/30">
              <item.icon className={`w-4 h-4 ${item.color}`} />
              <div>
                <p className="text-lg font-semibold">{item.value}</p>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex gap-3 flex-wrap">
        <Button variant="default" size="sm" onClick={() => navigate("/test")} className="rounded-full px-5">
          <Bot className="w-4 h-4 mr-1.5" /> Tester l'assistant
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/profiles")} className="rounded-full px-5">
          Changer de profil
        </Button>
        <Button variant="outline" size="sm" onClick={() => navigate("/history")} className="rounded-full px-5">
          Voir l'historique
        </Button>
      </div>

      {/* Recent calls */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-medium">Activité récente</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground text-xs" onClick={() => navigate("/history")}>
            Tout voir <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
        <div className="space-y-2">
          {recentCalls.slice(0, 5).map((call, i) => (
            <motion.div
              key={call.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.04 }}
              className="flex items-center gap-4 p-4 rounded-xl border border-border/40 bg-card/30 hover:bg-card/60 transition-all cursor-pointer group"
              onClick={() => navigate("/history")}
            >
              <span className="text-lg">{groupEmoji[call.group]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{call.callerName}</span>
                  {call.urgent && (
                    <Badge variant="destructive" className="text-[10px] h-4 px-1.5 rounded-full">Urgent</Badge>
                  )}
                  <Badge className={`text-[10px] h-4 px-1.5 rounded-full border ${statusStyles[call.status]}`}>
                    {statusLabels[call.status]}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{call.summary}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs text-muted-foreground">{formatTime(call.timestamp)}</p>
                {call.actions.length > 0 && (
                  <p className="text-[10px] text-primary mt-0.5">{call.actions.length} action{call.actions.length > 1 ? "s" : ""}</p>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Callback Requests */}
      {accountIds && accountIds.length > 0 && <CallbackRequestsSection accountIds={accountIds} />}

      {/* Notifications */}
      {accountIds && accountIds.length > 0 && <NotificationsSection accountIds={accountIds} />}
    </div>
  );
}
