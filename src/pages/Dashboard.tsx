import { motion } from "framer-motion";
import { Users, PhoneCall, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import DemoModeBadge from "@/components/DemoModeBadge";
import ActiveModeSelector from "@/components/ActiveModeSelector";
import LiveConsultBanner from "@/components/LiveConsultBanner";
import TransferCallBanner from "@/components/TransferCallBanner";
import { CallMyAssistantButton } from "@/components/CallMyAssistantButton";

const configItems = [
  { title: "Qui peut me joindre", url: "/who", icon: Users, description: "Contacts et groupes d'appelants" },
  { title: "Comment gérer les appels", url: "/how", icon: PhoneCall, description: "Comportements par mode et groupe" },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { data: mode } = useAccountMode();
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
      </motion.div>

      {/* Call my assistant */}
      <CallMyAssistantButton />

      {/* Live consultation banner */}
      <LiveConsultBanner />

      {/* Transfer call banner */}
      <TransferCallBanner />

      {/* Active mode selector */}
      <ActiveModeSelector />

      {/* Configuration shortcuts */}
      <Card className="bg-card/30 overflow-hidden">
        <ul className="divide-y divide-border/60">
          {configItems.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.url}>
                <Link
                  to={item.url}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
