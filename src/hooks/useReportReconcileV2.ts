/**
 * Sprint 2.9 — Hook que invoca a edge function `report_reconcile_v2`.
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import { useCurrentUser } from '@/hooks/useCurrentUser';

export interface ReconcileCheck {
  key: string;
  description: string;
  type: 'monetary' | 'pct' | 'count';
  expected: number;
  actual: number;
  delta: number;
  tolerance: number;
  isConsistent: boolean;
  severity: 'info' | 'warning' | 'critical';
}

export interface ReconcileData {
  checks: ReconcileCheck[];
  overallStatus: 'consistent' | 'warning' | 'critical';
  persisted: boolean;
}

export function useReportReconcileV2(options?: { persist?: boolean }) {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;
  const persist = Boolean(options?.persist);

  const query = useQuery({
    queryKey: ['report-reconcile-v2', orgId, persist],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async () =>
      callReportEdgeFunction<ReconcileData>('report_reconcile_v2', {
        organizationId: orgId!,
        options: { persist },
      } as Parameters<typeof callReportEdgeFunction>[1]),
  });

  return {
    data: query.data?.data ?? null,
    meta: query.data?.meta ?? null,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
