import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { CallerGroupFormData } from "@/data/providers/callerGroups";

const EMOJI_OPTIONS = [
  "👨‍👩‍👧‍👦", "⭐", "💼", "📦", "🏥", "🔧", "🤝", "🎓",
  "🏠", "🎯", "💎", "🔔", "🛡️", "🌐", "📞", "👤",
];

interface GroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: CallerGroupFormData) => void;
  isPending?: boolean;
  initialData?: { name: string; icon: string; description: string; custom_instructions?: string } | null;
}

export function GroupFormDialog({
  open,
  onOpenChange,
  onSubmit,
  isPending,
  initialData,
}: GroupFormDialogProps) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("👤");
  const [description, setDescription] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");

  useEffect(() => {
    if (open) {
      setName(initialData?.name || "");
      setIcon(initialData?.icon || "👤");
      setDescription(initialData?.description || "");
      setCustomInstructions(initialData?.custom_instructions || "");
    }
  }, [open, initialData]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      name: name.trim(),
      icon,
      description: description.trim(),
      custom_instructions: customInstructions.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initialData ? "Modifier le groupe" : "Nouveau groupe"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Icône</Label>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji)}
                  className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                    icon === emoji
                      ? "bg-primary/20 ring-2 ring-primary"
                      : "bg-secondary/50 hover:bg-secondary"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-name">Nom</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex : Famille, VIP, Fournisseurs…"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-desc">Description (optionnel)</Label>
            <Textarea
              id="group-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description courte du groupe…"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-instructions">Instructions pour l'assistant</Label>
            <Textarea
              id="group-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ex : Toujours proposer un rendez-vous. Parler en anglais…"
              rows={3}
              className="text-xs"
            />
            <p className="text-[11px] text-muted-foreground">
              Ces instructions seront ajoutées au comportement de l'assistant pour tous les contacts de ce groupe.
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!name.trim() || isPending}>
              {isPending
                ? "Enregistrement…"
                : initialData
                  ? "Enregistrer"
                  : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
