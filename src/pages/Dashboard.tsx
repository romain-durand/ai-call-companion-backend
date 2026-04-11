import { motion } from "framer-motion";
import { Phone, Calendar, AlertTriangle, Bot } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useDashboardStats, useRecentCalls, usePriorityItems, usePerformanceStats } from "@/data/providers/dashboard";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import PrioritySection from "@/components/PrioritySection";
import ActivityTimeline from "@/components/ActivityTimeline";
import PerformanceBlock from "@/components/PerformanceBlock";
import DemoModeBadge from "@/components/DemoModeBadge";
import ActiveModeSelector from "@/components/ActiveModeSelector";
import LiveConsultBanner from "@/components/LiveConsultBanner";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: mode } = useAccountMode();
  const { data: stats, isLoading: statsLoading } = useDashboardStats();
  const { data: recentCalls, isLoading: callsLoading } = useRecentCalls();
  const { data: priorityItems, isLoading: priorityLoading } = usePriorityItems();
  const { data: perfStats, isLoading: perfLoading } = usePerformanceStats();
  const { data: profile } = useQuery({
    queryKey: ["profile-phone", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, phone_e164")
        .eq("id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const statCards = stats
    ? [
        { label: "Appels traités", value: stats.callsToday, icon: Phone, color: "text-primary", sub: `${stats.callsThisWeek} cette semaine` },
        { label: "Rappels créés", value: stats.callbacksCreated, icon: Phone, color: "text-glow-warning", sub: "Cette semaine" },
        { label: "Escalades", value: stats.escalations, icon: AlertTriangle, color: "text-destructive", sub: "Situations urgentes" },
        { label: "RDV pris", value: stats.appointmentsBooked, icon: Calendar, color: "text-glow-success", sub: "Cette semaine" },
      ]
    : [];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">Bonjour{profile?.display_name ? `, ${profile.display_name}` : ""}</h1>
          {mode?.isDemo && <DemoModeBadge />}
        </div>
        <p className="text-muted-foreground text-sm mt-2">
          Aria est en ligne et gère vos appels
        </p>
        {profile?.phone_e164 && (
          <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1.5">
            <Phone className="w-3 h-3" />
            {profile.phone_e164}
          </p>
        )}
      </motion.div>

      {/* Live consultation banner */}
      <LiveConsultBanner />

      {/* Active mode selector */}
      <ActiveModeSelector />

      {/* 1. PRIORITY SECTION — "À traiter" */}
      <PrioritySection items={priorityItems || []} isLoading={priorityLoading} />

      {/* 2. KPI CARDS */}
      {statsLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
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
      )}

      {/* 3. ACTIVITY TIMELINE */}
      <ActivityTimeline items={recentCalls || []} isLoading={callsLoading} />

      {/* 4. PERFORMANCE BLOCK */}
      <PerformanceBlock stats={perfStats} isLoading={perfLoading} />

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
    </div>
  );
}
