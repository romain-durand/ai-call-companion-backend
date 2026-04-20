import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CalendarIcon, Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import BackToSettingsButton from "@/components/BackToSettingsButton";

const MAX = 4000;

export default function AboutMePage() {
  const { data: accountId, isLoading: accountLoading } = useUserAccountId();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [aboutShareable, setAboutShareable] = useState("");
  const [aboutConfidential, setAboutConfidential] = useState("");
  const [noteShareable, setNoteShareable] = useState("");
  const [noteConfidential, setNoteConfidential] = useState("");
  const [noteExpiresAt, setNoteExpiresAt] = useState<Date | undefined>(undefined);

  useEffect(() => {
    if (!accountId) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("accounts")
        .select("about_shareable, about_confidential, current_note_shareable, current_note_confidential, current_note_expires_at")
        .eq("id", accountId)
        .maybeSingle();
      if (error) {
        toast({ title: "Erreur de chargement", description: error.message, variant: "destructive" });
      } else if (data) {
        setAboutShareable(data.about_shareable || "");
        setAboutConfidential(data.about_confidential || "");
        setNoteShareable(data.current_note_shareable || "");
        setNoteConfidential(data.current_note_confidential || "");
        setNoteExpiresAt(data.current_note_expires_at ? new Date(data.current_note_expires_at) : undefined);
      }
      setLoading(false);
    })();
  }, [accountId]);

  const save = async () => {
    if (!accountId) return;
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({
        about_shareable: aboutShareable.trim() || null,
        about_confidential: aboutConfidential.trim() || null,
        current_note_shareable: noteShareable.trim() || null,
        current_note_confidential: noteConfidential.trim() || null,
        current_note_expires_at: noteExpiresAt ? noteExpiresAt.toISOString() : null,
      })
      .eq("id", accountId);
    setSaving(false);
    if (error) {
      toast({ title: "Erreur d'enregistrement", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Enregistré", description: "Vos informations ont été mises à jour." });
    }
  };

  const clearNote = () => {
    setNoteShareable("");
    setNoteConfidential("");
    setNoteExpiresAt(undefined);
  };

  if (accountLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const noteExpired = noteExpiresAt && noteExpiresAt < new Date();

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <BackToSettingsButton />
      <div>
        <h1 className="text-3xl font-bold tracking-tight">À propos de moi</h1>
        <p className="text-muted-foreground mt-1">
          Donnez à votre assistant les informations qui l'aideront à personnaliser ses réponses lors des appels.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>À propos de moi (permanent)</CardTitle>
          <CardDescription>
            Informations générales et durables sur vous. Transmises à l'assistant à chaque appel.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="about-shareable">
                Partageable <Badge variant="secondary" className="ml-2">Peut être révélé si demandé</Badge>
              </Label>
              <span className="text-xs text-muted-foreground">{aboutShareable.length}/{MAX}</span>
            </div>
            <Textarea
              id="about-shareable"
              maxLength={MAX}
              rows={5}
              placeholder="Ex: Je suis médecin généraliste à Paris. Mon cabinet est ouvert du lundi au vendredi, 9h-18h."
              value={aboutShareable}
              onChange={(e) => setAboutShareable(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="about-confidential">
                Confidentiel <Badge variant="destructive" className="ml-2">Jamais révélé à l'appelant</Badge>
              </Label>
              <span className="text-xs text-muted-foreground">{aboutConfidential.length}/{MAX}</span>
            </div>
            <Textarea
              id="about-confidential"
              maxLength={MAX}
              rows={5}
              placeholder="Ex: Je ne donne jamais mon numéro personnel. Je refuse les sollicitations commerciales d'assurance."
              value={aboutConfidential}
              onChange={(e) => setAboutConfidential(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>Note actuelle (ponctuelle)</CardTitle>
              <CardDescription>
                Information temporaire valable pour la période en cours (voyage, événement, indisponibilité…).
              </CardDescription>
            </div>
            {(noteShareable || noteConfidential || noteExpiresAt) && (
              <Button variant="ghost" size="sm" onClick={clearNote}>
                <Trash2 className="w-4 h-4 mr-1" /> Effacer
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note-shareable">
                Partageable <Badge variant="secondary" className="ml-2">Peut être révélé si demandé</Badge>
              </Label>
              <span className="text-xs text-muted-foreground">{noteShareable.length}/{MAX}</span>
            </div>
            <Textarea
              id="note-shareable"
              maxLength={MAX}
              rows={4}
              placeholder="Ex: Je suis en déplacement à Lyon cette semaine, joignable uniquement par message."
              value={noteShareable}
              onChange={(e) => setNoteShareable(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="note-confidential">
                Confidentiel <Badge variant="destructive" className="ml-2">Jamais révélé à l'appelant</Badge>
              </Label>
              <span className="text-xs text-muted-foreground">{noteConfidential.length}/{MAX}</span>
            </div>
            <Textarea
              id="note-confidential"
              maxLength={MAX}
              rows={4}
              placeholder="Ex: J'attends un appel important de mon avocat — passez-le-moi en priorité."
              value={noteConfidential}
              onChange={(e) => setNoteConfidential(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Date d'expiration (optionnelle)</Label>
            <div className="flex items-center gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-[260px] justify-start text-left font-normal",
                      !noteExpiresAt && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {noteExpiresAt ? format(noteExpiresAt, "PPP", { locale: fr }) : "Aucune expiration"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={noteExpiresAt}
                    onSelect={setNoteExpiresAt}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              {noteExpiresAt && (
                <Button variant="ghost" size="sm" onClick={() => setNoteExpiresAt(undefined)}>
                  Retirer
                </Button>
              )}
              {noteExpired && (
                <Badge variant="outline" className="text-destructive border-destructive">Expirée</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Après cette date, la note ne sera plus envoyée à l'assistant (mais reste enregistrée).
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end sticky bottom-4">
        <Button onClick={save} disabled={saving} size="lg" className="shadow-lg">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
