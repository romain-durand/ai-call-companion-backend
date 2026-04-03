import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted-foreground mt-1">Paramètres généraux de votre assistant.</p>
      </div>

      {/* General */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Général</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Nom de l'assistant</Label>
            <Input defaultValue="Aria" className="max-w-xs" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Langue</Label>
            <Input defaultValue="Français" className="max-w-xs" disabled />
          </div>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Notifications</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { label: "Appels manqués", desc: "Recevoir une notification pour chaque appel manqué", on: true },
            { label: "Escalades urgentes", desc: "Alerte immédiate pour les situations urgentes", on: true },
            { label: "Résumé quotidien", desc: "Récapitulatif chaque soir à 19h", on: false },
            { label: "Rendez-vous pris", desc: "Notification quand un RDV est confirmé", on: true },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{n.label}</p>
                <p className="text-xs text-muted-foreground">{n.desc}</p>
              </div>
              <Switch defaultChecked={n.on} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Twilio */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Téléphonie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Numéro Twilio</Label>
            <Input defaultValue="+33 1 86 XX XX XX" className="max-w-xs" disabled />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Statut</p>
              <p className="text-xs text-muted-foreground">Connecté et actif</p>
            </div>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button>Sauvegarder</Button>
      </div>
    </div>
  );
}
