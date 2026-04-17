import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Copy, Check } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

export default function SettingsPage() {
  const { user } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [initialName, setInitialName] = useState("");
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const callUrl = user ? `${window.location.origin}/call/${user.id}` : "";

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const name = data?.display_name ?? "";
        setDisplayName(name);
        setInitialName(name);
        setLoadingProfile(false);
      });
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ display_name: displayName.trim() || null })
      .eq("id", user.id);
    setSaving(false);
    if (error) {
      toast.error("Impossible de sauvegarder le profil");
    } else {
      setInitialName(displayName.trim());
      toast.success("Profil mis à jour");
    }
  };

  const profileDirty = displayName.trim() !== initialName;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Réglages</h1>
        <p className="text-sm text-muted-foreground mt-1">Paramètres généraux de votre assistant.</p>
      </div>

      {/* Mon profil */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mon profil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Email</Label>
            <Input value={user?.email ?? ""} className="max-w-xs" disabled />
          </div>
          <div className="space-y-2">
            <Label className="text-sm">Nom d'affichage</Label>
            {loadingProfile ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement…
              </div>
            ) : (
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Votre nom"
                className="max-w-xs"
              />
            )}
          </div>
          {profileDirty && (
            <Button size="sm" onClick={handleSaveProfile} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Enregistrer
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Lien d'appel web */}
      <Card className="bg-card/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mon lien d'appel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Partagez ce lien ou ce QR code pour permettre à vos contacts de vous joindre via le web.
          </p>
          <div className="flex items-center gap-2">
            <Input value={callUrl} readOnly className="text-xs font-mono" />
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(callUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
            >
              {copied ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          {callUrl && (
            <div className="flex justify-center py-2">
              <QRCodeSVG value={callUrl} size={160} bgColor="transparent" fgColor="hsl(var(--foreground))" />
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
