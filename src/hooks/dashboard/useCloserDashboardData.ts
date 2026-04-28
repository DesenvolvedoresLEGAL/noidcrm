import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCloserDashboardData } from '@/services/crm/closerDashboard';
import { getCloserPaceData } from '@/services/crm/closerDashboardPilot';
import type { CloserDashboardData, CloserPeriodKey, CloserPaceData } from '@/types/dashboard/closer';

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

  // Pace sempre referente ao mês atual, independente do período
  const paceQuery = useQuery<CloserPaceData>({
    queryKey: ['closer-pace', tenantId, userId],
    queryFn: () => getCloserPaceData(tenantId as string, userId as string),
    enabled: !!tenantId && !!userId && enabled,
    staleTime: 60_000,
  });

  const data = useMemo<CloserDashboardData | undefined>(() => {
    if (!query.data) return query.data;
    return { ...query.data, pace: paceQuery.data ?? query.data.pace };
  }, [query.data, paceQuery.data]);

  const unavailableWidgets = useMemo(() => {
    const av = data?.availability ?? {};
    return Object.entries(av)
      .filter(([, v]) => v === 'unavailable')
      .map(([k]) => k);
  }, [data]);

  const isEmpty =
    !!data &&
    !data.error &&
    (data.kpis?.open_pipeline_count ?? 0) === 0 &&
    (data.kpis?.proposals_open_count ?? 0) === 0 &&
    (data.kpis?.overdue_followups_count ?? 0) === 0;

  return {
    ...query,
    data,
    period,
    setPeriod,
    customRange,
    setCustomRange,
    unavailableWidgets,
    isEmpty,
  };
}
