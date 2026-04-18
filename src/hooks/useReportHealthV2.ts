/**
 * Sprint 2.9 — Hook que invoca a edge function `report_health_v2`.
 */
import { useQuery } from '@tanstack/react-query';
import { callReportEdgeFunction } from '@/lib/reports/edgeReportClient';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface CoverageBreakdown {
  monetary: number;
  stage_history: number;
  owner_history: number;
  qualification_history: number;
  loss_complete: number;
  loss_any: number;
}

interface ConfidenceData {
  proposal_based_coverage_pct: number;
  stage_history_coverage_pct: number;
  owner_history_coverage_pct: number;
  qualification_history_coverage_pct: number;
  loss_complete_coverage_pct: number;
  loss_any_coverage_pct: number;
  overall_confidence_score: number;
}

export interface ReadinessRow {
  report_key: string;
  readiness_status: 'ready' | 'almost_ready' | 'not_ready' | string;
  readiness_score: number;
  reconcile_consistent: boolean;
  reconcile_severity: string;
  last_check_at: string | null;
  reasons: Record<string, unknown>;
}

export interface ReportHealthData {
  confidence: ConfidenceData | null;
  coverage: CoverageBreakdown | null;
  reconcile: { checks: unknown[]; overallStatus: string };
  readiness: ReadinessRow[];
  warnings: string[];
}

export function useReportHealthV2() {
  const { organization } = useCurrentUser();
  const orgId = organization?.id;

  const query = useQuery({
    queryKey: ['report-health-v2', orgId],
    enabled: Boolean(orgId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await callReportEdgeFunction<ReportHealthData>('report_health_v2', {
        organizationId: orgId!,
      });
      return res;
    },
  });

  return {
    data: query.data?.data ?? null,
    meta: query.data?.meta ?? null,
    error: query.data?.error ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
