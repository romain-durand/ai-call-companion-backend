import { useQuery } from "@tanstack/react-query";
import { useAccountMode } from "@/hooks/useAccountMode";
import { useUserAccountIds } from "@/hooks/useUserAccountId";
import { getDemoStats, getDemoRecentCalls, getDemoPriorityItems, getDemoPerformanceStats } from "./demo";
import { getLiveStats, getLiveRecentCalls, getLivePriorityItems, getLivePerformanceStats } from "./live";
import type { DashboardStats, RecentCallItem, PriorityItem, PerformanceStats } from "../types";

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

export function usePriorityItems() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<PriorityItem[]>({
    queryKey: ["priority-items", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoPriorityItems();
      return getLivePriorityItems(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
    refetchInterval: 30000, // Refresh every 30s for urgency
  });
}

export function usePerformanceStats() {
  const { data: mode } = useAccountMode();
  const { data: accountIds } = useUserAccountIds();
  const isDemo = mode?.isDemo ?? true;

  return useQuery<PerformanceStats>({
    queryKey: ["performance-stats", isDemo, accountIds],
    queryFn: async () => {
      if (isDemo) return getDemoPerformanceStats();
      return getLivePerformanceStats(accountIds!);
    },
    enabled: mode !== undefined && (isDemo || (!!accountIds && accountIds.length > 0)),
  });
}
