import { motion } from "framer-motion";
import { Phone } from "lucide-react";
import { useRecentCalls } from "@/data/providers/dashboard";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import ActivityTimeline from "@/components/ActivityTimeline";
import DemoModeBadge from "@/components/DemoModeBadge";
import ActiveModeSelector from "@/components/ActiveModeSelector";
import LiveConsultBanner from "@/components/LiveConsultBanner";
import TransferCallBanner from "@/components/TransferCallBanner";
import { CallMyAssistantButton } from "@/components/CallMyAssistantButton";

export default function Dashboard() {
  const { user } = useAuth();
  const { data: mode } = useAccountMode();
  const { data: recentCalls, isLoading: callsLoading } = useRecentCalls();
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

  return (
    <div className="space-y-6 sm:space-y-8 max-w-5xl">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Bonjour{profile?.display_name ? `, ${profile.display_name}` : ""}</h1>
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

      {/* Call my assistant */}
      <CallMyAssistantButton />

      {/* Live consultation banner */}
      <LiveConsultBanner />

      {/* Transfer call banner */}
      <TransferCallBanner />

      {/* Active mode selector */}
      <ActiveModeSelector />

      {/* ACTIVITY TIMELINE */}
      <ActivityTimeline items={recentCalls || []} isLoading={callsLoading} />
    </div>
  );
}
