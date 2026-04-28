import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCloserDashboardData } from '@/services/crm/closerDashboard';
import type { CloserDashboardData, CloserPeriodKey } from '@/types/dashboard/closer';

export interface UseCloserDashboardDataOptions {
  tenantId: string | null | undefined;
  userId: string | null | undefined;
  enabled?: boolean;
}

export interface CustomRange {
  startDate?: string;
  endDate?: string;
}

export function useCloserDashboardData({
  tenantId,
  userId,
  enabled = true,
}: UseCloserDashboardDataOptions) {
  const [period, setPeriod] = useState<CloserPeriodKey>('current_month');
  const [customRange, setCustomRange] = useState<CustomRange>({});

  const query = useQuery<CloserDashboardData>({
    queryKey: ['closer-dashboard', tenantId, userId, period, customRange],
    queryFn: () =>
      getCloserDashboardData({
        tenantId: tenantId as string,
        userId: userId as string,
        period,
        startDate: period === 'custom' ? customRange.startDate : undefined,
        endDate: period === 'custom' ? customRange.endDate : undefined,
      }),
    enabled: !!tenantId && !!userId && enabled,
    staleTime: 30_000,
  });

  const unavailableWidgets = useMemo(() => {
    const av = query.data?.availability ?? {};
    return Object.entries(av)
      .filter(([, v]) => v === 'unavailable')
      .map(([k]) => k);
  }, [query.data]);

  const isEmpty =
    !!query.data &&
    !query.data.error &&
    (query.data.kpis?.open_pipeline_count ?? 0) === 0 &&
    (query.data.kpis?.proposals_open_count ?? 0) === 0 &&
    (query.data.kpis?.overdue_followups_count ?? 0) === 0;

  return {
    ...query,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    unavailableWidgets,
    isEmpty,
  };
}
