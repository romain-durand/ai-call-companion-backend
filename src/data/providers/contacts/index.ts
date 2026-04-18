import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds, useUserAccountId } from "@/hooks/useUserAccountId";
import { getDemoContacts } from "./demo";
import {
  getLiveContacts,
  createLiveContact,
  updateLiveContact,
  deleteLiveContact,
  getLiveContactGroups,
  setLiveContactGroups,
} from "./live";
import type { ContactItem, ContactFormData } from "./types";

export type { ContactItem, ContactFormData } from "./types";

export function useContacts() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<ContactItem[]>({
    queryKey: ["contacts", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoContacts();
      return getLiveContacts(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  const { data: accountId } = useUserAccountId();

  return useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (!accountId) throw new Error("No account");
      return createLiveContact(accountId, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["caller-groups"] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ContactFormData }) => {
      return updateLiveContact(id, data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      return deleteLiveContact(contactId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
      qc.invalidateQueries({ queryKey: ["caller-groups"] });
    },
  });
}

export function useContactGroups(contactId: string | null) {
  return useQuery<string[]>({
    queryKey: ["contact-groups", contactId],
    queryFn: async () => {
      if (!contactId) return [];
      return getLiveContactGroups(contactId);
    },
    enabled: !!contactId,
  });
}

export function useSetContactGroups() {
  const qc = useQueryClient();
  const { data: accountId } = useUserAccountId();

  return useMutation({
    mutationFn: async ({ contactId, groupIds }: { contactId: string; groupIds: string[] }) => {
      if (!accountId) throw new Error("No account");
      return setLiveContactGroups(accountId, contactId, groupIds);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["contacts"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["contact-groups"], refetchType: "all" }),
        qc.invalidateQueries({ queryKey: ["caller-groups"], refetchType: "all" }),
      ]);
    },
  });
}
