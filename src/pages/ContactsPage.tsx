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
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { useAccountMode } from "@/hooks/useAccountMode";
import { ContactFormDialog } from "@/components/contacts/ContactFormDialog";
import { GroupAssignDialog } from "@/components/contacts/GroupAssignDialog";
import { DeleteContactDialog } from "@/components/contacts/DeleteContactDialog";

export default function ContactsPage() {
  const { data: contacts, isLoading } = useContacts();
  const { data: mode } = useAccountMode();
  const isDemo = mode?.isDemo ?? true;

  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const deleteContact = useDeleteContact();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ContactItem | null>(null);
  const [groupContact, setGroupContact] = useState<ContactItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ContactItem | null>(null);

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

  const handleCreate = (data: ContactFormData) => {
    if (isDemo) {
      toast.info("Création impossible en mode démo");
      setFormOpen(false);
      return;
    }
    createContact.mutate(data, {
      onSuccess: () => {
        toast.success("Contact ajouté");
        setFormOpen(false);
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

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Gérez vos contacts et assignez-les à des groupes pour personnaliser le traitement des appels.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled
            className="opacity-50 cursor-not-allowed"
            title="Bientôt disponible"
          >
            <Upload className="w-4 h-4 mr-1.5" />
            Importer
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" />
            Ajouter
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher par nom, téléphone, email…"
          className="pl-9"
        />
      </div>

      {/* List */}
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
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {filtered.map((contact) => (
              <motion.div
                key={contact.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.15 }}
              >
                <Card className="bg-card/30 hover:bg-card/50 transition-all">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Avatar placeholder */}
                    <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-sm font-semibold shrink-0">
                      {contact.displayName.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
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

                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        {contact.primaryPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {contact.primaryPhone}
                          </span>
                        )}
                        {contact.email && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </span>
                        )}
                        {contact.companyName && (
                          <span className="flex items-center gap-1 truncate">
                            <Building2 className="w-3 h-3" />
                            {contact.companyName}
                          </span>
                        )}
                      </div>

                      {/* Group badges */}
                      {contact.groups.length > 0 && (
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

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="shrink-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => setEditingContact(contact)}
                        >
                          <Pencil className="w-4 h-4 mr-2" />
                          Modifier
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setGroupContact(contact)}
                        >
                          <Users className="w-4 h-4 mr-2" />
                          Groupes
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteTarget(contact)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Supprimer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>

          <p className="text-xs text-muted-foreground text-center pt-2">
            {filtered.length} contact{filtered.length > 1 ? "s" : ""}
            {search && contacts && filtered.length < contacts.length
              ? ` sur ${contacts.length}`
              : ""}
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
    </div>
  );
}
