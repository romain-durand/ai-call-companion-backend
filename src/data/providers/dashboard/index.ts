import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoStats, getDemoRecentCalls } from "./demo";
import { getLiveStats, getLiveRecentCalls } from "./live";
import type { DashboardStats, RecentCallItem } from "../types";

export function useDashboardStats() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<DashboardStats>({
    queryKey: ["dashboard-stats", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoStats();
      return getLiveStats(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}

export function useRecentCalls() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<RecentCallItem[]>({
    queryKey: ["recent-calls", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoRecentCalls();
      return getLiveRecentCalls(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}
