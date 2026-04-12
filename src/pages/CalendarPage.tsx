import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CalendarDays, CheckCircle2, ExternalLink, Loader2, Unplug, Radio } from "lucide-react";

const BRIDGE_URL = "https://bridgeserver.ted.paris";

export default function CalendarPage() {
  const { data: accountId } = useUserAccountId();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [togglingCalendar, setTogglingCalendar] = useState<string | null>(null);

  // Show toast based on redirect status
  useEffect(() => {
    const status = searchParams.get("status");
    if (status === "success") {
      toast.success("Google Calendar connecté avec succès !");
      queryClient.invalidateQueries({ queryKey: ["calendar-connection"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-calendars"] });
      setSearchParams({}, { replace: true });
    } else if (status === "error") {
      const reason = searchParams.get("reason") || "unknown";
      toast.error(`Erreur de connexion : ${reason}`);
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, queryClient]);

  // Fetch active calendar connection
  const { data: connection, isLoading: connLoading } = useQuery({
    queryKey: ["calendar-connection", accountId],
    queryFn: async () => {
      if (!accountId) return null;
      const { data, error } = await supabase
        .from("calendar_connections")
        .select("*")
        .eq("account_id", accountId)
        .eq("status", "active")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!accountId,
  });

  // Fetch calendars
  const { data: calendars } = useQuery({
    queryKey: ["calendar-calendars", connection?.id],
    queryFn: async () => {
      if (!connection?.id) return [];
      const { data, error } = await supabase
        .from("calendar_calendars")
        .select("*")
        .eq("calendar_connection_id", connection.id)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!connection?.id,
  });

  const handleConnect = () => {
    if (!accountId || !session?.access_token) return;
    const startUrl = `${BRIDGE_URL}/auth/google/start?account_id=${accountId}&token=${session.access_token}`;
    window.location.href = startUrl;
  };

  const handleDisconnect = async () => {
    if (!connection) return;
    setDisconnecting(true);
    try {
      await supabase
        .from("calendar_calendars")
        .delete()
        .eq("calendar_connection_id", connection.id);
      await supabase
        .from("calendar_connections")
        .delete()
        .eq("id", connection.id);
      toast.success("Calendrier déconnecté");
      queryClient.invalidateQueries({ queryKey: ["calendar-connection"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-calendars"] });
    } catch {
      toast.error("Erreur lors de la déconnexion");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleToggleWatched = async (calendarId: string, currentValue: boolean) => {
    setTogglingCalendar(calendarId);
    try {
      const { error } = await supabase
        .from("calendar_calendars")
        .update({ is_watched: !currentValue })
        .eq("id", calendarId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendar-calendars"] });
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setTogglingCalendar(null);
    }
  };

  const handleSetTarget = async (calendarId: string) => {
    if (!connection?.id) return;
    setTogglingCalendar(calendarId);
    try {
      // Remove target from all calendars in this connection
      await supabase
        .from("calendar_calendars")
        .update({ is_target: false } as any)
        .eq("calendar_connection_id", connection.id);
      // Set the selected one as target
      const { error } = await supabase
        .from("calendar_calendars")
        .update({ is_target: true } as any)
        .eq("id", calendarId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["calendar-calendars"] });
      toast.success("Calendrier cible mis à jour");
    } catch {
      toast.error("Erreur lors de la mise à jour");
    } finally {
      setTogglingCalendar(null);
    }
  };

  const isConnected = !!connection;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Calendrier</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Connectez votre agenda pour que l'assistant puisse consulter vos disponibilités et prendre des rendez-vous.
        </p>
      </div>

      {/* Connection status */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Google Calendar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {connLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Chargement…
            </div>
          ) : isConnected ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <span className="text-sm font-medium">Connecté</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-destructive hover:text-destructive"
                >
                  {disconnecting ? (
                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  ) : (
                    <Unplug className="h-3 w-3 mr-1" />
                  )}
                  Déconnecter
                </Button>
              </div>

              {/* Calendar list with toggle */}
              {calendars && calendars.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-border/50">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    Agendas synchronisés
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Activez les agendas que l'assistant doit consulter pour vérifier vos disponibilités.
                  </p>
                  {calendars.map((cal: any) => (
                    <div key={cal.id} className="flex items-center justify-between py-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <Switch
                          checked={cal.is_watched ?? false}
                          onCheckedChange={() => handleToggleWatched(cal.id, cal.is_watched ?? false)}
                          disabled={togglingCalendar === cal.id}
                        />
                        <span className="text-sm truncate">{cal.name}</span>
                      </div>
                      <div className="flex gap-1.5 shrink-0 ml-2">
                        {cal.is_primary && (
                          <Badge variant="secondary" className="text-xs">Principal</Badge>
                        )}
                        {cal.is_read_only && (
                          <Badge variant="outline" className="text-xs">Lecture seule</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Autorisez l'accès à votre Google Calendar pour permettre à l'assistant de vérifier vos disponibilités et de créer des rendez-vous.
              </p>
              <Button onClick={handleConnect} disabled={!accountId || !session}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Connecter Google Calendar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Booking types info */}
      {isConnected && (
        <Card className="bg-card/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Types de rendez-vous</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Configurez les types de rendez-vous que l'assistant peut proposer dans la section <strong>Gestion des appels</strong>.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
