import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Returns all account_ids the current user belongs to.
 * Components can query across all accounts for a complete view.
 */
export function useUserAccountIds() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-account-ids", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("profile_id", user.id);
      if (error) throw error;
      return data?.map((d) => d.account_id) ?? [];
    },
    enabled: !!user,
  });
}

/**
 * Returns the primary account_id (default or first found).
 */
export function useUserAccountId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-account-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("account_members")
        .select("account_id, is_default_account")
        .eq("profile_id", user.id)
        .order("is_default_account", { ascending: false });
      if (error) throw error;
      return data?.[0]?.account_id ?? null;
    },
    enabled: !!user,
  });
}
