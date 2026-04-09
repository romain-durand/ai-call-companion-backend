import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoCallerGroups } from "./demo";
import { getLiveCallerGroups } from "./live";
import type { CallerGroupItem } from "../types";

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
