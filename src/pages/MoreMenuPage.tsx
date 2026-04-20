import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserCircle,
  PhoneCall,
  CalendarDays,
  Settings,
  ChevronRight,
  LogOut,
  Loader2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const items = [
  { title: "À propos de moi", url: "/about-me", icon: UserCircle, description: "Votre identité et contexte personnel" },
  { title: "Mon lien d'appel", url: "/settings#call-link", icon: PhoneCall, description: "Partager votre lien d'appel web" },
  { title: "Calendrier", url: "/calendar", icon: CalendarDays, description: "Disponibilités et rendez-vous" },
  { title: "Réglages", url: "/settings", icon: Settings, description: "Préférences générales" },
];

export default function MoreMenuPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setDisplayName(data?.display_name ?? "");
        setLoadingProfile(false);
      });
  }, [user]);

  const handleLogout = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configuration, préférences et compte.
        </p>
      </div>

      {/* Configuration list */}
      <Card className="bg-card/30 overflow-hidden">
        <ul className="divide-y divide-border/60">
          {items.map((item) => {
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

      {/* Compte */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mon compte</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <UserCircle className="w-5 h-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {loadingProfile ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
                </div>
              ) : (
                <div className="text-sm font-medium truncate">{displayName || "—"}</div>
              )}
              <div className="text-xs text-muted-foreground truncate">{user?.email}</div>
            </div>
          </div>
          <Button
            variant="outline"
            className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Se déconnecter
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
