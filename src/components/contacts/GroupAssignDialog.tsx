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
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useCallerGroups } from "@/data/providers/callerGroups";
import {
  useContactGroups,
  useSetContactGroups,
} from "@/data/providers/contacts";
import type { ContactItem } from "@/data/providers/contacts";
import { toast } from "sonner";

interface GroupAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact: ContactItem | null;
}

export function GroupAssignDialog({
  open,
  onOpenChange,
  contact,
}: GroupAssignDialogProps) {
  const { data: groups, isLoading: groupsLoading } = useCallerGroups();
  const { data: currentGroupIds, isLoading: membershipLoading } =
    useContactGroups(contact?.id ?? null);
  const setGroups = useSetContactGroups();

  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (currentGroupIds) {
      setSelected(currentGroupIds);
    } else if (contact) {
      // Fallback from contact view model
      setSelected(contact.groups.map((g) => g.id));
    }
  }, [currentGroupIds, contact, open]);

  const toggle = (groupId: string) => {
    setSelected((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId],
    );
  };

  const handleSave = () => {
    if (!contact) return;
    setGroups.mutate(
      { contactId: contact.id, groupIds: selected },
      {
        onSuccess: () => {
          toast.success("Groupes mis à jour");
          onOpenChange(false);
        },
        onError: () => {
          toast.error("Erreur lors de la mise à jour des groupes");
        },
      },
    );
  };

  const isLoading = groupsLoading || membershipLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Groupes de {contact?.displayName}</DialogTitle>
          <DialogDescription>
            Cochez les groupes auxquels ce contact appartient.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2 max-h-64 overflow-y-auto">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded-lg" />
            ))
          ) : (
            (groups || []).map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors"
              >
                <Checkbox
                  checked={selected.includes(group.id)}
                  onCheckedChange={() => toggle(group.id)}
                />
                <span className="text-lg">{group.emoji}</span>
                <span className="text-sm font-medium">{group.name}</span>
              </label>
            ))
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={setGroups.isPending}
          >
            {setGroups.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
