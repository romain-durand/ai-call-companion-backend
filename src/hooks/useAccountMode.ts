import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserAccountIds } from "@/hooks/useUserAccountId";

/**
 * Determines whether the current user is in demo mode.
 * Demo mode = the user's primary (default) account has is_demo = true.
 * 
 * If the user has ANY non-demo account, isDemo = false (live mode).
 */
export function useAccountMode() {
  const { data: accountIds } = useUserAccountIds();

  return useQuery({
    queryKey: ["account-mode", accountIds],
    queryFn: async () => {
      if (!accountIds || accountIds.length === 0) return { isDemo: true };

      const { data, error } = await supabase
        .from("accounts")
        .select("id, is_demo")
        .in("id", accountIds);

      if (error) throw error;

      // If any account is NOT demo → live mode
      const hasLiveAccount = data?.some((a) => !(a as any).is_demo) ?? false;
      return { isDemo: !hasLiveAccount };
    },
    enabled: !!accountIds && accountIds.length > 0,
  });
}
