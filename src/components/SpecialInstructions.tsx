import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId, useUserAccountIds } from "@/hooks/useUserAccountId";
import { useAccountMode } from "@/hooks/useAccountMode";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Trash2, Plus, User, Users, Info } from "lucide-react";
import { toast } from "sonner";

interface InstructionEntry {
  id: string;
  type: "contact" | "group";
  name: string;
  emoji: string;
  instructions: string;
}

export default function SpecialInstructions() {
  const { data: accountId } = useUserAccountId();
  const { data: accountIds } = useUserAccountIds();
  const { data: mode } = useAccountMode();
  const isDemo = mode?.isDemo ?? true;
  const qc = useQueryClient();

  const [editEntry, setEditEntry] = useState<InstructionEntry | null>(null);
  const [editText, setEditText] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<"contact" | "group">("contact");
  const [addTargetId, setAddTargetId] = useState("");
  const [addText, setAddText] = useState("");

  // Fetch contacts with instructions
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["contacts-with-instructions", accountIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, display_name, first_name, last_name, custom_instructions")
        .in("account_id", accountIds!)
        .not("custom_instructions", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !isDemo && !!accountIds?.length,
  });

  // Fetch groups with instructions
  const { data: groups, isLoading: groupsLoading } = useQuery({
    queryKey: ["groups-with-instructions", accountIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caller_groups")
        .select("id, name, icon, custom_instructions")
        .in("account_id", accountIds!)
        .not("custom_instructions", "is", null);
      if (error) throw error;
      return data;
    },
    enabled: !isDemo && !!accountIds?.length,
  });

  // All contacts (for add dialog)
  const { data: allContacts } = useQuery({
    queryKey: ["all-contacts-for-instructions", accountIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, display_name, first_name, last_name, custom_instructions")
        .in("account_id", accountIds!)
        .order("display_name");
      if (error) throw error;
      return data;
    },
    enabled: addOpen && !isDemo && !!accountIds?.length,
  });

  // All groups (for add dialog)
  const { data: allGroups } = useQuery({
    queryKey: ["all-groups-for-instructions", accountIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("caller_groups")
        .select("id, name, icon, custom_instructions")
        .in("account_id", accountIds!)
        .order("name");
      if (error) throw error;
      return data;
    },
    enabled: addOpen && !isDemo && !!accountIds?.length,
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, instructions }: { id: string; instructions: string | null }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ custom_instructions: instructions })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts-with-instructions"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const updateGroup = useMutation({
    mutationFn: async ({ id, instructions }: { id: string; instructions: string | null }) => {
      const { error } = await supabase
        .from("caller_groups")
        .update({ custom_instructions: instructions })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups-with-instructions"] });
      qc.invalidateQueries({ queryKey: ["caller-groups"] });
    },
  });

  const entries: InstructionEntry[] = [
    ...(groups || [])
      .filter((g) => g.custom_instructions?.trim())
      .map((g) => ({
        id: g.id,
        type: "group" as const,
        name: g.name,
        emoji: g.icon || "👥",
        instructions: g.custom_instructions!,
      })),
    ...(contacts || [])
      .filter((c) => c.custom_instructions?.trim())
      .map((c) => ({
        id: c.id,
        type: "contact" as const,
        name: c.display_name || `${c.first_name || ""} ${c.last_name || ""}`.trim() || "Sans nom",
        emoji: "👤",
        instructions: c.custom_instructions!,
      })),
  ];

  const isLoading = contactsLoading || groupsLoading;

  const handleEdit = (entry: InstructionEntry) => {
    setEditEntry(entry);
    setEditText(entry.instructions);
  };

  const handleSaveEdit = async () => {
    if (!editEntry) return;
    const mutation = editEntry.type === "contact" ? updateContact : updateGroup;
    await mutation.mutateAsync({ id: editEntry.id, instructions: editText.trim() || null });
    setEditEntry(null);
    toast.success("Instructions mises à jour");
  };

  const handleDelete = async (entry: InstructionEntry) => {
    const mutation = entry.type === "contact" ? updateContact : updateGroup;
    await mutation.mutateAsync({ id: entry.id, instructions: null });
    toast.success("Instructions supprimées");
  };

  const handleAdd = async () => {
    if (!addTargetId || !addText.trim()) return;
    const mutation = addType === "contact" ? updateContact : updateGroup;
    await mutation.mutateAsync({ id: addTargetId, instructions: addText.trim() });
    setAddOpen(false);
    setAddTargetId("");
    setAddText("");
    toast.success("Instructions ajoutées");
  };

  const availableTargets =
    addType === "contact"
      ? (allContacts || []).filter((c) => !c.custom_instructions?.trim())
      : (allGroups || []).filter((g) => !g.custom_instructions?.trim());

  if (isLoading) {
    return (
      <div className="space-y-3 max-w-4xl">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Instructions spéciales transmises à l'assistant pour personnaliser son comportement.
        </p>
        <Button size="sm" onClick={() => { setAddOpen(true); setAddType("contact"); setAddTargetId(""); setAddText(""); }}>
          <Plus className="w-4 h-4 mr-1" /> Ajouter
        </Button>
      </div>

      {entries.length === 0 ? (
        <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-primary/5 border border-primary/10">
          <Info className="w-4 h-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Aucune instruction spéciale définie. Ajoutez-en pour personnaliser le comportement de l'assistant par contact ou par groupe.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map((entry) => (
            <Card key={`${entry.type}-${entry.id}`} className="bg-card/30">
              <CardContent className="p-4 flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-xl shrink-0">
                  {entry.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-medium">{entry.name}</h3>
                    <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                      {entry.type === "group" ? (
                        <><Users className="w-2.5 h-2.5 mr-0.5" />Groupe</>
                      ) : (
                        <><User className="w-2.5 h-2.5 mr-0.5" />Contact</>
                      )}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.instructions}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(entry)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(entry)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editEntry} onOpenChange={(o) => !o && setEditEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les instructions — {editEntry?.name}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            placeholder="Ex : Toujours proposer un rappel, ne jamais transférer…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEntry(null)}>Annuler</Button>
            <Button onClick={handleSaveEdit} disabled={updateContact.isPending || updateGroup.isPending}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter des instructions</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={addType === "contact" ? "default" : "outline"}
                size="sm"
                onClick={() => { setAddType("contact"); setAddTargetId(""); }}
              >
                <User className="w-3.5 h-3.5 mr-1" /> Contact
              </Button>
              <Button
                variant={addType === "group" ? "default" : "outline"}
                size="sm"
                onClick={() => { setAddType("group"); setAddTargetId(""); }}
              >
                <Users className="w-3.5 h-3.5 mr-1" /> Groupe
              </Button>
            </div>
            <Select value={addTargetId} onValueChange={setAddTargetId}>
              <SelectTrigger>
                <SelectValue placeholder={`Choisir un ${addType === "contact" ? "contact" : "groupe"}…`} />
              </SelectTrigger>
              <SelectContent>
                {availableTargets.map((t: any) => (
                  <SelectItem key={t.id} value={t.id}>
                    {addType === "contact"
                      ? t.display_name || `${t.first_name || ""} ${t.last_name || ""}`.trim() || "Sans nom"
                      : `${t.icon || "👥"} ${t.name}`}
                  </SelectItem>
                ))}
                {availableTargets.length === 0 && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">
                    Tous les {addType === "contact" ? "contacts" : "groupes"} ont déjà des instructions.
                  </div>
                )}
              </SelectContent>
            </Select>
            <Textarea
              value={addText}
              onChange={(e) => setAddText(e.target.value)}
              placeholder="Ex : Toujours proposer un rappel, ne jamais transférer…"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
            <Button onClick={handleAdd} disabled={!addTargetId || !addText.trim() || updateContact.isPending || updateGroup.isPending}>
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
