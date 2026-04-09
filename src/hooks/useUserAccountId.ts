import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useUserAccountId() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["user-account-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("account_members")
        .select("account_id")
        .eq("profile_id", user.id)
        .eq("is_default_account", true)
        .maybeSingle();

      if (error) throw error;
      // Fallback: if no default, pick the first one
      if (!data) {
        const { data: fallback, error: fErr } = await supabase
          .from("account_members")
          .select("account_id")
          .eq("profile_id", user.id)
          .limit(1)
          .single();
        if (fErr) throw fErr;
        return fallback?.account_id ?? null;
      }
      return data.account_id;
    },
    enabled: !!user,
  });
}
