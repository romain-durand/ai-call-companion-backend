import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoCallHistory } from "./demo";
import { getLiveCallHistory } from "./live";
import type { CallHistoryItem } from "./demo";

export type { CallHistoryItem } from "./demo";

export function useCallHistory() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<CallHistoryItem[]>({
    queryKey: ["call-history", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoCallHistory();
      return getLiveCallHistory(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}
