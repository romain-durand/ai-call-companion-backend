import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, Ban } from "lucide-react";
import type { ContactFormData, ContactItem } from "@/data/providers/contacts";
import { useCallerGroups } from "@/data/providers/callerGroups";

interface ContactFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: ContactItem | null;
  onSubmit: (data: ContactFormData, groupIds?: string[]) => void;
  isPending: boolean;
}

const emptyForm: ContactFormData = {
  first_name: "",
  last_name: "",
  display_name: "",
  primary_phone_e164: "",
  secondary_phone_e164: "",
  email: "",
  company_name: "",
  notes: "",
  custom_instructions: "",
  is_favorite: false,
  is_blocked: false,
};

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onSubmit,
  isPending,
}: ContactFormDialogProps) {
  const [form, setForm] = useState<ContactFormData>(emptyForm);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const isEdit = !!contact;

  const { data: groups, isLoading: groupsLoading } = useCallerGroups();

  useEffect(() => {
    if (contact) {
      setForm({
        first_name: contact.firstName || "",
        last_name: contact.lastName || "",
        display_name: contact.displayName || "",
        primary_phone_e164: contact.primaryPhone || "",
        secondary_phone_e164: contact.secondaryPhone || "",
        email: contact.email || "",
        company_name: contact.companyName || "",
        notes: contact.notes || "",
        custom_instructions: contact.customInstructions || "",
        is_favorite: contact.isFavorite,
        is_blocked: contact.isBlocked,
      });
      setSelectedGroups(contact.groups.map((g) => g.id));
    } else {
      setForm(emptyForm);
      setSelectedGroups([]);
    }
  }, [contact, open]);

  const update = (field: keyof ContactFormData, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleGroup = (groupId: string) =>
    setSelectedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );

  const hasMinimumInfo =
    form.primary_phone_e164.trim() ||
    form.display_name.trim() ||
    form.first_name.trim() ||
    form.last_name.trim();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasMinimumInfo) return;
    onSubmit(form, selectedGroups.length > 0 ? selectedGroups : undefined);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifier le contact" : "Nouveau contact"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Modifiez les informations de ce contact."
              : "Ajoutez un nouveau contact manuellement. Un numéro de téléphone ou un nom est requis."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Names */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="first_name">Prénom</Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={(e) => update("first_name", e.target.value)}
                placeholder="Marie"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="last_name">Nom</Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={(e) => update("last_name", e.target.value)}
                placeholder="Dupont"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="display_name">Nom d'affichage</Label>
            <Input
              id="display_name"
              value={form.display_name}
              onChange={(e) => update("display_name", e.target.value)}
              placeholder="Optionnel — calculé automatiquement si vide"
            />
          </div>

          {/* Phone */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="primary_phone">Téléphone principal</Label>
              <Input
                id="primary_phone"
                type="tel"
                value={form.primary_phone_e164}
                onChange={(e) => update("primary_phone_e164", e.target.value)}
                placeholder="+33 6 12 34 56 78"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="secondary_phone">Téléphone secondaire</Label>
              <Input
                id="secondary_phone"
                type="tel"
                value={form.secondary_phone_e164}
                onChange={(e) => update("secondary_phone_e164", e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          {/* Email & Company */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="marie@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="company">Entreprise</Label>
              <Input
                id="company"
                value={form.company_name}
                onChange={(e) => update("company_name", e.target.value)}
                placeholder="Optionnel"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Notes internes..."
              rows={2}
            />
          </div>

          {/* Group assignment (creation mode) */}
          {!isEdit && (
            <div className="space-y-2">
              <Label>Groupes (optionnel)</Label>
              <div className="rounded-lg border border-border p-2 space-y-1 max-h-40 overflow-y-auto">
                {groupsLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full rounded" />
                  ))
                ) : (
                  (groups || []).map((group) => (
                    <label
                      key={group.id}
                      className="flex items-center gap-2.5 px-2 py-1.5 rounded hover:bg-secondary/50 cursor-pointer transition-colors"
                    >
                      <Checkbox
                        checked={selectedGroups.includes(group.id)}
                        onCheckedChange={() => toggleGroup(group.id)}
                      />
                      <span className="text-base">{group.emoji}</span>
                      <span className="text-sm">{group.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Toggles */}
          <div className="flex items-center gap-6 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_favorite}
                onCheckedChange={(v) => update("is_favorite", v)}
              />
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <Star className="w-3.5 h-3.5 text-yellow-500" />
                Favori
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_blocked}
                onCheckedChange={(v) => update("is_blocked", v)}
              />
              <Label className="flex items-center gap-1.5 cursor-pointer">
                <Ban className="w-3.5 h-3.5 text-destructive" />
                Bloqué
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={!hasMinimumInfo || isPending}>
              {isPending
                ? "Enregistrement..."
                : isEdit
                ? "Enregistrer"
                : "Ajouter"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
