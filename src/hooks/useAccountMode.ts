import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountId } from "@/hooks/useUserAccountId";

/**
 * Determines whether the current user is in demo mode.
 * Based on the ACTIVE (default/primary) account's is_demo flag only.
 */
export function useAccountMode() {
  const { data: accountId } = useUserAccountId();

  return useQuery({
    queryKey: ["account-mode", accountId],
    queryFn: async () => {
      if (!accountId) return { isDemo: true };

      const { data, error } = await supabase
        .from("accounts")
        .select("is_demo")
        .eq("id", accountId)
        .single();

      if (error) throw error;
      return { isDemo: data?.is_demo ?? true };
    },
    enabled: !!accountId,
  });
}
