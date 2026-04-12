import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Plus, Phone, Clock, CheckCircle2, XCircle, Loader2, Trash2, Eye } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type MissionStatus = "draft" | "queued" | "in_progress" | "completed" | "failed" | "cancelled";
type MissionResult = "pending" | "success" | "partial" | "failure" | "no_answer";

interface Mission {
  id: string;
  status: MissionStatus;
  objective: string;
  target_phone_e164: string;
  target_name: string | null;
  constraints_json: Record<string, unknown>;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result_summary: string | null;
  result_status: MissionResult;
  attempt_count: number;
  max_attempts: number;
  call_session_id: string | null;
  created_at: string;
}

const statusConfig: Record<MissionStatus, { label: string; color: string; icon: typeof Clock }> = {
  draft: { label: "Brouillon", color: "bg-muted text-muted-foreground", icon: Clock },
  queued: { label: "En attente", color: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Loader2 },
  completed: { label: "Terminé", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  failed: { label: "Échoué", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  cancelled: { label: "Annulé", color: "bg-muted text-muted-foreground", icon: XCircle },
};

const resultLabels: Record<MissionResult, string> = {
  pending: "En attente",
  success: "Succès",
  partial: "Partiel",
  failure: "Échec",
  no_answer: "Pas de réponse",
};

export default function MissionsPage() {
  const { data: accountId } = useUserAccountId();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [detailMissionId, setDetailMissionId] = useState<string | null>(null);

  const [autoRefresh, setAutoRefresh] = useState(false);

  const { data: missions, isLoading } = useQuery({
    queryKey: ["outbound-missions", accountId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outbound_missions")
        .select("*")
        .eq("account_id", accountId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Mission[];
    },
    enabled: !!accountId,
    refetchInterval: detailMissionId ? 1500 : (autoRefresh ? 3000 : false),
    refetchIntervalInBackground: true,
  });

  const detailMission = missions?.find((mission) => mission.id === detailMissionId) ?? null;

  useEffect(() => {
    if (!detailMissionId || !accountId) return;
    queryClient.invalidateQueries({ queryKey: ["outbound-missions", accountId] });
  }, [accountId, detailMissionId, queryClient]);

  // Auto-open detail dialog when a mission transitions to in_progress
  const prevMissionsRef = useRef<Mission[] | undefined>();
  useEffect(() => {
    if (!missions || !prevMissionsRef.current) {
      prevMissionsRef.current = missions;
      return;
    }
    const prev = prevMissionsRef.current;
    for (const m of missions) {
      if (m.status === "in_progress") {
        const old = prev.find((p) => p.id === m.id);
        if (!old || old.status !== "in_progress") {
          setDetailMissionId(m.id);
          break;
        }
      }
    }
    prevMissionsRef.current = missions;
  }, [missions]);

  const deleteMission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outbound_missions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outbound-missions"] });
      toast.success("Mission supprimée");
    },
  });

  const cancelMission = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("outbound_missions")
        .update({ status: "cancelled" } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["outbound-missions"] });
      toast.success("Mission annulée");
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Missions</h1>
          <p className="text-muted-foreground text-sm">Appels sortants effectués par votre assistant</p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nouvelle mission</Button>
          </DialogTrigger>
          <CreateMissionDialog
            accountId={accountId}
            onClose={() => setCreateOpen(false)}
            onCreated={() => {
              queryClient.invalidateQueries({ queryKey: ["outbound-missions"] });
              setCreateOpen(false);
            }}
          />
        </Dialog>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}
        </div>
      ) : !missions?.length ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Phone className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground text-sm">Aucune mission pour le moment</p>
            <p className="text-muted-foreground/60 text-xs mt-1">
              Créez une mission pour que votre assistant passe un appel en votre nom
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {missions.map((mission, i) => {
            const cfg = statusConfig[mission.status];
            const StatusIcon = cfg.icon;
            return (
              <motion.div
                key={mission.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card
                  className="cursor-pointer hover:border-primary/30 transition-colors"
                  onClick={() => setDetailMissionId(mission.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={`text-[10px] ${cfg.color}`}>
                            <StatusIcon className={`h-3 w-3 mr-1 ${mission.status === "in_progress" ? "animate-spin" : ""}`} />
                            {cfg.label}
                          </Badge>
                          {mission.scheduled_at && mission.status === "queued" && (
                            <span className="text-[10px] text-muted-foreground">
                              Planifié : {format(new Date(mission.scheduled_at), "dd MMM HH:mm", { locale: fr })}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-medium truncate">{mission.objective}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {mission.target_name ? `${mission.target_name} · ` : ""}
                          {mission.target_phone_e164}
                        </p>
                        {mission.result_summary && (
                          <p className="text-xs text-muted-foreground/80 mt-1 line-clamp-2">
                            {mission.result_summary}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {(mission.status === "draft" || mission.status === "queued") && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              cancelMission.mutate(mission.id);
                            }}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMission.mutate(mission.id);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailMissionId} onOpenChange={(open) => !open && setDetailMissionId(null)}>
        <DialogContent className="max-w-lg">
          {detailMission ? (
            <MissionDetail mission={detailMission} />
          ) : (
            <div className="space-y-3 py-6">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MissionDetail({ mission }: { mission: Mission }) {
  const cfg = statusConfig[mission.status];
  const StatusIcon = cfg.icon;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          Détail de la mission
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label className="text-xs text-muted-foreground">Statut</Label>
          <div className="mt-1">
            <Badge variant="outline" className={cfg.color}>
              <StatusIcon className={`h-3 w-3 mr-1 ${mission.status === "in_progress" ? "animate-spin" : ""}`} />
              {cfg.label}
            </Badge>
          </div>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Objectif</Label>
          <p className="text-sm mt-1">{mission.objective}</p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-xs text-muted-foreground">Destinataire</Label>
            <p className="text-sm mt-1">{mission.target_name || "—"}</p>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Téléphone</Label>
            <p className="text-sm mt-1">{mission.target_phone_e164}</p>
          </div>
        </div>
        {mission.scheduled_at && (
          <div>
            <Label className="text-xs text-muted-foreground">Planifié pour</Label>
            <p className="text-sm mt-1">
              {format(new Date(mission.scheduled_at), "dd MMMM yyyy à HH:mm", { locale: fr })}
            </p>
          </div>
        )}
        {Object.keys(mission.constraints_json || {}).length > 0 && (
          <div>
            <Label className="text-xs text-muted-foreground">Contraintes</Label>
            <pre className="text-xs mt-1 bg-muted/50 rounded-lg p-2 overflow-auto">
              {JSON.stringify(mission.constraints_json, null, 2)}
            </pre>
          </div>
        )}
        {mission.result_summary && (
          <div>
            <Label className="text-xs text-muted-foreground">Résultat</Label>
            <div className="mt-1 flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">
                {resultLabels[mission.result_status]}
              </Badge>
            </div>
            <p className="text-sm mt-1">{mission.result_summary}</p>
          </div>
        )}

        {mission.status === "in_progress" && !mission.call_session_id && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Transcription</Label>
              <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] text-primary animate-pulse">
                ● En direct
              </Badge>
            </div>
            <div className="mt-1 rounded-lg border border-dashed p-4 text-center">
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Connexion du suivi en direct…
              </div>
            </div>
          </div>
        )}

        {mission.call_session_id && (
          <MissionTranscript callSessionId={mission.call_session_id} isLive={mission.status === "in_progress"} />
        )}

        <div className="text-[10px] text-muted-foreground/50">
          Créé le {format(new Date(mission.created_at), "dd/MM/yyyy HH:mm", { locale: fr })}
          {mission.attempt_count > 0 && ` · ${mission.attempt_count} tentative(s)`}
        </div>
      </div>
    </>
  );
}

interface CallMessage {
  id: string;
  speaker: string;
  content_text: string | null;
  tool_name: string | null;
  seq_no: number;
  created_at: string;
}

const speakerLabels: Record<string, { label: string; color: string }> = {
  caller: { label: "Interlocuteur", color: "text-blue-600 dark:text-blue-400" },
  assistant: { label: "Assistant", color: "text-primary" },
  tool: { label: "Outil", color: "text-amber-600 dark:text-amber-400" },
  system: { label: "Système", color: "text-muted-foreground" },
};

function MissionTranscript({ callSessionId, isLive }: { callSessionId: string; isLive: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: messages } = useQuery({
    queryKey: ["call-messages", callSessionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_messages")
        .select("id, speaker, content_text, tool_name, seq_no, created_at")
        .eq("call_session_id", callSessionId)
        .order("seq_no", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CallMessage[];
    },
    refetchInterval: isLive ? 2000 : false,
  });

  // Realtime subscription for live missions
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!isLive) return;
    const channel = supabase
      .channel(`transcript-${callSessionId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "call_messages",
        filter: `call_session_id=eq.${callSessionId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["call-messages", callSessionId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [callSessionId, isLive, queryClient]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  if (!messages?.length) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label className="text-xs text-muted-foreground">Transcription</Label>
          {isLive && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] text-primary animate-pulse">
              ● En direct
            </Badge>
          )}
        </div>
        <div className="mt-1 rounded-lg border border-dashed p-4 text-center">
          {isLive ? (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              En attente des premiers messages…
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Aucun message enregistré</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-xs text-muted-foreground">Transcription</Label>
        {isLive && (
            <Badge variant="outline" className="border-primary/30 bg-primary/10 text-[9px] text-primary animate-pulse">
            ● En direct
          </Badge>
        )}
      </div>
      <div
        ref={scrollRef}
        className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 space-y-2"
      >
        {messages.map((msg) => {
          const sp = speakerLabels[msg.speaker] || { label: msg.speaker, color: "text-foreground" };
          return (
            <div key={msg.id} className="text-xs">
              <span className={`font-semibold ${sp.color}`}>
                {sp.label}
                {msg.tool_name ? ` (${msg.tool_name})` : ""}
              </span>
              {msg.content_text && (
                <span className="text-foreground/80 ml-1.5">{msg.content_text}</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface CreateMissionDialogProps {
  accountId: string | null | undefined;
  onClose: () => void;
  onCreated: () => void;
}

function CreateMissionDialog({ accountId, onClose, onCreated }: CreateMissionDialogProps) {
  const [objective, setObjective] = useState("");
  const [targetPhone, setTargetPhone] = useState("");
  const [targetName, setTargetName] = useState("");
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!accountId || !objective.trim() || !targetPhone.trim()) return;
    setSubmitting(true);
    try {
      let scheduledAt: string | null = null;
      if (isScheduled && scheduledDate && scheduledTime) {
        scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      }
      const { error } = await supabase.from("outbound_missions").insert({
        account_id: accountId,
        objective: objective.trim(),
        target_phone_e164: targetPhone.trim(),
        target_name: targetName.trim() || null,
        status: "queued" as unknown as string,
        scheduled_at: scheduledAt,
      } as any);
      if (error) throw error;
      toast.success("Mission créée");
      onCreated();
    } catch (err: any) {
      toast.error("Erreur : " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Nouvelle mission</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div>
          <Label>Objectif de l'appel *</Label>
          <Textarea
            placeholder="Ex : Réserver une table pour 2 personnes ce soir à 20h au Restaurant Le Petit Bistrot"
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            className="mt-1"
            rows={3}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Numéro à appeler *</Label>
            <Input
              placeholder="+33 1 23 45 67 89"
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Nom du destinataire</Label>
            <Input
              placeholder="Restaurant Le Petit Bistrot"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={isScheduled} onCheckedChange={setIsScheduled} />
          <Label className="text-sm">Planifier l'appel</Label>
        </div>
        {isScheduled && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date</Label>
              <Input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Heure</Label>
              <Input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="mt-1" />
            </div>
          </div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Annuler</Button>
        <Button onClick={handleSubmit} disabled={!objective.trim() || !targetPhone.trim() || submitting}>
          {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Phone className="h-4 w-4 mr-2" />}
          Lancer la mission
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
