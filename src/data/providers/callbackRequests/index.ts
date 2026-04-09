import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoCallbackRequests } from "./demo";
import { getLiveCallbackRequests } from "./live";
import type { CallbackRequestItem } from "../types";

export function useCallbackRequests() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<CallbackRequestItem[]>({
    queryKey: ["callback-requests", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoCallbackRequests();
      return getLiveCallbackRequests(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}
