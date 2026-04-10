import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoCallerGroups } from "./demo";
import { getLiveCallerGroups } from "./live";
import { supabase } from "@/integrations/supabase/client";
import type { CallerGroupItem } from "../types";

export interface CallerGroupFormData {
  name: string;
  icon: string;
  description: string;
  color?: string;
  custom_instructions?: string;
}

export function useCallerGroups() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<CallerGroupItem[]>({
    queryKey: ["caller-groups", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoCallerGroups();
      return getLiveCallerGroups(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}

export function useCreateCallerGroup() {
  const qc = useQueryClient();
  const { data: accountIds } = useUserAccountIds();

  return useMutation({
    mutationFn: async (data: CallerGroupFormData) => {
      const accountId = accountIds?.[0];
      if (!accountId) throw new Error("No account");

      const slug = data.name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      const { error } = await supabase.from("caller_groups").insert({
        account_id: accountId,
        name: data.name,
        slug,
        icon: data.icon,
        description: data.description || null,
        color: data.color || null,
        group_type: "custom" as const,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caller-groups"] }),
  });
}

export function useUpdateCallerGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CallerGroupFormData }) => {
      const { error } = await supabase
        .from("caller_groups")
        .update({
          name: data.name,
          icon: data.icon,
          description: data.description || null,
          color: data.color || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["caller-groups"] });
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeleteCallerGroup() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("caller_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["caller-groups"] }),
  });
}
