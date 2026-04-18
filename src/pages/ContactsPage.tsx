import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Star,
  Ban,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
  Upload,
  Phone,
  Mail,
  Building2,
  List,
  LayoutGrid,
  ChevronRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useSetContactGroups,
} from "@/data/providers/contacts";
import type { ContactItem, ContactFormData } from "@/data/providers/contacts";
import {
  useCallerGroups,
  useCreateCallerGroup,
  useUpdateCallerGroup,
  useDeleteCallerGroup,
} from "@/data/providers/callerGroups";
import type { CallerGroupFormData } from "@/data/providers/callerGroups";
import { useAccountMode } from "@/hooks/useAccountMode";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { GroupAssignDialog } from "@/components/contacts/GroupAssignDialog";
import { DeleteContactDialog } from "@/components/contacts/DeleteContactDialog";
import { GroupFormDialog } from "@/components/contacts/GroupFormDialog";
import { ImportContactsMenu } from "@/components/contacts/ImportContactsMenu";

type ViewMode = "list" | "groups";

function ContactCard({
  contact,
  onEdit,
  onGroups,
  onDelete,
  showGroupBadges = true,
}: {
  contact: ContactItem;
  onEdit: () => void;
  onGroups: () => void;
  onDelete: () => void;
  showGroupBadges?: boolean;
}) {
  return (
    <Card className="bg-card/30 hover:bg-card/50 transition-all cursor-pointer" onClick={onEdit}>
      <CardContent className="p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold shrink-0">
          {contact.displayName.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">
              {contact.displayName}
            </span>
            {contact.isFavorite && (
              <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
            )}
            {contact.isBlocked && (
              <Ban className="w-3.5 h-3.5 text-destructive shrink-0" />
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 mt-0.5 text-xs text-muted-foreground">
            {contact.primaryPhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {contact.primaryPhone}
              </span>
            )}
            {contact.email && (
              <span className="flex items-center gap-1 truncate hidden sm:flex">
                <Mail className="w-3 h-3" />
                {contact.email}
              </span>
            )}
            {contact.companyName && (
              <span className="flex items-center gap-1 truncate hidden sm:flex">
                <Building2 className="w-3 h-3" />
                {contact.companyName}
              </span>
            )}
          </div>

          {showGroupBadges && contact.groups.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {contact.groups.map((g) => (
                <Badge
                  key={g.id}
                  variant="secondary"
                  className="text-[10px] h-5 px-1.5 gap-1"
                >
                  <span>{g.emoji}</span>
                  {g.name}
                </Badge>
              ))}
            </div>
          )}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="w-4 h-4 mr-2" />
              Modifier
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGroups}>
              <Users className="w-4 h-4 mr-2" />
              Groupes
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={onDelete}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Supprimer
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardContent>
    </Card>
  );
}

export default function ContactsPage({ forcedView }: { forcedView?: "list" | "groups" } = {}) {
  const { data: contacts, isLoading } = useContacts();
  const { data: groups } = useCallerGroups();
  const { data: mode } = useAccountMode();
  const isDemo = mode?.isDemo ?? true;

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();
  const setContactGroups = useSetContactGroups();

  const createCallerGroup = useCreateCallerGroup();
  const updateCallerGroup = useUpdateCallerGroup();
  const deleteCallerGroup = useDeleteCallerGroup();

  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>(forcedView || "list");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [groupContact, setGroupContact] = useState<ContactItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactItem | null>(null);

  // Group management state
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<{ id: string; name: string; icon: string; description: string; custom_instructions?: string } | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<{ id: string; name: string; contactCount: number } | null>(null);

  const filtered = useMemo(() => {
    if (!contacts) return [];
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        c.displayName.toLowerCase().includes(q) ||
        (c.firstName && c.firstName.toLowerCase().includes(q)) ||
        (c.lastName && c.lastName.toLowerCase().includes(q)) ||
        (c.primaryPhone && c.primaryPhone.includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)),
    );
  }, [contacts, search]);

  // Group contacts by caller group for "groups" view
  const groupedContacts = useMemo(() => {
    if (!groups || !filtered) return [];

    const result: { groupId: string; name: string; emoji: string; contacts: ContactItem[] }[] = [];

    for (const group of groups) {
      const members = filtered.filter((c) =>
        c.groups.some((g) => g.id === group.id),
      );
      if (members.length > 0 || !search) {
        result.push({
          groupId: group.id,
          name: group.name,
          emoji: group.emoji,
          contacts: members,
        });
      }
    }

    // Contacts without any group
    const ungrouped = filtered.filter((c) => c.groups.length === 0);
    if (ungrouped.length > 0) {
      result.push({
        groupId: "__none__",
        name: "Sans groupe",
        emoji: "📋",
        contacts: ungrouped,
      });
    }

    return result;
  }, [groups, filtered, search]);

  const handleCreate = (data: ContactFormData, groupIds?: string[]) => {
    if (isDemo) {
      toast.info("Création impossible en mode démo");
      setFormOpen(false);
      return;
    }
    createContact.mutate(data, {
      onSuccess: (contactId) => {
        if (groupIds && groupIds.length > 0) {
          setContactGroups.mutate(
            { contactId, groupIds },
            {
              onSuccess: () => {
                toast.success("Contact ajouté avec groupes");
                setFormOpen(false);
              },
              onError: () => {
                toast.success("Contact ajouté (erreur groupes)");
                setFormOpen(false);
              },
            },
          );
        } else {
          toast.success("Contact ajouté");
          setFormOpen(false);
        }
      },
      onError: () => toast.error("Erreur lors de la création"),
    });
  };

  const handleUpdate = (data: ContactFormData) => {
    if (!editingContact || isDemo) {
      if (isDemo) toast.info("Modification impossible en mode démo");
      setEditingContact(null);
      return;
    }
    updateContact.mutate(
      { id: editingContact.id, data },
      {
        onSuccess: () => {
          toast.success("Contact mis à jour");
          setEditingContact(null);
        },
        onError: () => toast.error("Erreur lors de la mise à jour"),
      },
    );
  };

  const handleDelete = () => {
    if (!deleteTarget || isDemo) {
      if (isDemo) toast.info("Suppression impossible en mode démo");
      setDeleteTarget(null);
      return;
    }
    deleteContact.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success("Contact supprimé");
        setDeleteTarget(null);
      },
      onError: () => toast.error("Erreur lors de la suppression"),
    });
  };

  const renderContactCard = (contact: ContactItem, showGroupBadges = true) => (
    <motion.div
      key={contact.id}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.15 }}
    >
      <ContactCard
        contact={contact}
        onEdit={() => setEditingContact(contact)}
        onGroups={() => setGroupContact(contact)}
        onDelete={() => setDeleteTarget(contact)}
        showGroupBadges={showGroupBadges}
      />
    </motion.div>
  );

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        {!forcedView && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Gérez vos contacts et assignez-les à des groupes pour personnaliser le traitement des appels.
            </p>
          </div>
        )}
        <div className="flex items-center gap-2 ml-auto">
          {forcedView !== "groups" && <ImportContactsMenu />}
          <Button
            size="sm"
            onClick={() =>
              forcedView === "groups" ? setGroupFormOpen(true) : setFormOpen(true)
            }
          >
            <Plus className="w-4 h-4 mr-1.5" />
            {forcedView === "groups" ? "Nouveau groupe" : "Ajouter"}
          </Button>
        </div>
      </div>

      {/* Search + view toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, téléphone, email…"
            className="pl-9"
          />
        </div>
        {!forcedView && (
          <div className="flex rounded-lg border border-border overflow-hidden shrink-0">
            <button
              onClick={() => setViewMode("list")}
              className={`p-2 transition-colors ${
                viewMode === "list"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
              title="Vue liste"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("groups")}
              className={`p-2 transition-colors ${
                viewMode === "groups"
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary/50"
              }`}
              title="Vue par groupes"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-muted-foreground" />
          </div>
          <h3 className="text-sm font-semibold mb-1">
            {search ? "Aucun contact trouvé" : "Aucun contact"}
          </h3>
          <p className="text-xs text-muted-foreground max-w-xs">
            {search
              ? "Essayez un autre terme de recherche."
              : "Ajoutez votre premier contact pour commencer à personnaliser le traitement de vos appels."}
          </p>
          {!search && (
            <Button size="sm" className="mt-4" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />
              Ajouter un contact
            </Button>
          )}
        </div>
      ) : viewMode === "list" ? (
        /* ── Flat list view ── */
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((contact) => renderContactCard(contact))}
          </AnimatePresence>
          <p className="text-xs text-muted-foreground text-center pt-2">
            {filtered.length} contact{filtered.length > 1 ? "s" : ""}
            {search && contacts && filtered.length < contacts.length
              ? ` sur ${contacts.length}`
              : ""}
          </p>
        </div>
      ) : (
        /* ── Grouped view (collapsible) ── */
        <div className="space-y-2">
          {groupedContacts.map((section) => (
            <Collapsible key={section.groupId}>
              <div className="flex items-center">
                <CollapsibleTrigger asChild>
                  <button className="flex items-center gap-2 flex-1 p-3 rounded-lg hover:bg-secondary/30 transition-colors text-left group">
                    <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
                    <span className="text-lg">{section.emoji}</span>
                    <h2 className="text-sm font-semibold">{section.name}</h2>
                    <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                      {section.contacts.length}
                    </Badge>
                  </button>
                </CollapsibleTrigger>
                {section.groupId !== "__none__" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="shrink-0 mr-1">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          setEditingGroup({
                            id: section.groupId,
                            name: section.name,
                            icon: section.emoji,
                            description:
                              groups?.find((g) => g.id === section.groupId)
                                ?.description || "",
                            custom_instructions:
                              (groups?.find((g) => g.id === section.groupId) as any)
                                ?.customInstructions || "",
                          })
                        }
                      >
                        <Pencil className="w-4 h-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          setDeleteGroupTarget({
                            id: section.groupId,
                            name: section.name,
                            contactCount: section.contacts.length,
                          })
                        }
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              <CollapsibleContent>
                {section.contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-10 py-2">
                    Aucun contact dans ce groupe.
                  </p>
                ) : (
                  <div className="space-y-2 pl-4 pt-1 pb-2">
                    <AnimatePresence mode="popLayout">
                      {section.contacts.map((contact) =>
                        renderContactCard(contact, false),
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </CollapsibleContent>
            </Collapsible>
          ))}
          <p className="text-xs text-muted-foreground text-center pt-2">
            {filtered.length} contact{filtered.length > 1 ? "s" : ""}
          </p>
        </div>
      )}

      {/* Dialogs */}
      <ContactFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
        isPending={createContact.isPending}
      />

      <ContactFormDialog
        open={!!editingContact}
        onOpenChange={(open) => !open && setEditingContact(null)}
        contact={editingContact}
        onSubmit={handleUpdate}
        isPending={updateContact.isPending}
      />

      <GroupAssignDialog
        open={!!groupContact}
        onOpenChange={(open) => !open && setGroupContact(null)}
        contact={groupContact}
      />

      <DeleteContactDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        contactName={deleteTarget?.displayName || ""}
        onConfirm={handleDelete}
        isPending={deleteContact.isPending}
      />

      {/* Group management dialogs */}
      <GroupFormDialog
        open={groupFormOpen}
        onOpenChange={setGroupFormOpen}
        onSubmit={(data) => {
          if (isDemo) {
            toast.info("Création impossible en mode démo");
            setGroupFormOpen(false);
            return;
          }
          createCallerGroup.mutate(data, {
            onSuccess: () => {
              toast.success("Groupe créé");
              setGroupFormOpen(false);
            },
            onError: () => toast.error("Erreur lors de la création"),
          });
        }}
        isPending={createCallerGroup.isPending}
      />

      <GroupFormDialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        initialData={editingGroup}
        onSubmit={(data) => {
          if (!editingGroup || isDemo) {
            if (isDemo) toast.info("Modification impossible en mode démo");
            setEditingGroup(null);
            return;
          }
          updateCallerGroup.mutate(
            { id: editingGroup.id, data },
            {
              onSuccess: () => {
                toast.success("Groupe mis à jour");
                setEditingGroup(null);
              },
              onError: () => toast.error("Erreur lors de la mise à jour"),
            },
          );
        }}
        isPending={updateCallerGroup.isPending}
      />

      <DeleteContactDialog
        open={!!deleteGroupTarget}
        onOpenChange={(open) => !open && setDeleteGroupTarget(null)}
        contactName={deleteGroupTarget?.name || ""}
        onConfirm={() => {
          if (!deleteGroupTarget) return;
          if (deleteGroupTarget.contactCount > 0) {
            toast.error("Impossible de supprimer un groupe qui contient des contacts. Retirez-les d'abord.");
            setDeleteGroupTarget(null);
            return;
          }
          if (isDemo) {
            toast.info("Suppression impossible en mode démo");
            setDeleteGroupTarget(null);
            return;
          }
          deleteCallerGroup.mutate(deleteGroupTarget.id, {
            onSuccess: () => {
              toast.success("Groupe supprimé");
              setDeleteGroupTarget(null);
            },
            onError: (err: any) => {
              const msg = err?.message || "";
              if (msg.includes("default group")) {
                toast.error("Le groupe par défaut ne peut pas être supprimé.");
              } else if (msg.includes("still has contacts")) {
                toast.error("Ce groupe contient encore des contacts. Retirez-les d'abord.");
              } else {
                toast.error("Erreur lors de la suppression");
              }
            },
          });
        }}
        isPending={deleteCallerGroup.isPending}
      />
    </div>
  );
}
