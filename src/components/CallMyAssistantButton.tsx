import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Mic, Sparkles, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { OwnerCallDialog } from "@/components/OwnerCallDialog";
import { useUserAccountId } from "@/hooks/useUserAccountId";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CallMyAssistantButton() {
  const [open, setOpen] = useState(false);
  const { accountId } = useUserAccountId();
  const [confirmActions, setConfirmActions] = useState<boolean>(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!accountId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("accounts")
        .select("owner_confirm_actions")
        .eq("id", accountId)
        .maybeSingle();
      if (cancelled) return;
      setConfirmActions(data?.owner_confirm_actions ?? true);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  const handleToggle = async (next: boolean) => {
    if (!accountId) return;
    const previous = confirmActions;
    setConfirmActions(next);
    setSaving(true);
    const { error } = await supabase
      .from("accounts")
      .update({ owner_confirm_actions: next })
      .eq("id", accountId);
    setSaving(false);
    if (error) {
      setConfirmActions(previous);
      toast.error("Impossible de mettre à jour le réglage");
    } else {
      toast.success(next ? "Confirmation activée" : "Confirmation désactivée");
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="p-5 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Mic className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">Parler à mon assistant</h3>
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                Aide, infos compte, ou configuration vocale
              </p>
            </div>
            <Button onClick={() => setOpen(true)} className="shrink-0">
              Appeler
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 pt-3 border-t border-primary/10">
            <Label htmlFor="confirm-actions" className="text-sm font-normal cursor-pointer flex items-center gap-2">
              Demander confirmation à chaque action
              {(loading || saving) && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
            </Label>
            <Switch
              id="confirm-actions"
              checked={confirmActions}
              disabled={loading || saving}
              onCheckedChange={handleToggle}
            />
          </div>
        </Card>
      </motion.div>
      <OwnerCallDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
