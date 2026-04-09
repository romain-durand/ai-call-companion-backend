import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoNotifications } from "./demo";
import { getLiveNotifications } from "./live";
import type { NotificationItem } from "../types";

export function useNotifications() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<NotificationItem[]>({
    queryKey: ["notifications-list", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoNotifications();
      return getLiveNotifications(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}
