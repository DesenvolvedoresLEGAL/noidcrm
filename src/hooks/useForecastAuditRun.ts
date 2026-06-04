/**
 * Sprint F2.1 — Forecast Audit Layer
 * Executa a RPC `calculate_forecast_audit_v2` e expõe o último run em cache.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { forecastKeys } from '@/lib/query-keys';

export interface ForecastAuditRunResult {
  run_id: string;
  calculation_version?: string;
  total_closed: number;
  total_commit: number;
  total_best_case: number;
  scenario_pessimistic: number;
  scenario_realistic: number;
  scenario_optimistic: number;
  scenario_best_case: number;
  forecast_confidence: number;
  nrhs_avg: number;
  data_quality_score: number;
  deals_count: number;
  included_deals_count: number;
  excluded_deals_count: number;
  risk_deals_count: number;
  slipping_deals_count: number;
  days_remaining?: number;
  is_end_of_month_restricted?: boolean;
  confidence_reasons?: string[];
}

export interface UseForecastAuditRunArgs {
  organizationId: string | null | undefined;
  pipelineId: string | null | undefined;
  periodStart: string; // YYYY-MM-DD
  periodEnd: string;   // YYYY-MM-DD
  sellerId?: string | null;
}

export function useForecastAuditRun(args: UseForecastAuditRunArgs) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (): Promise<ForecastAuditRunResult> => {
      if (!args.organizationId) throw new Error('organization missing');
      if (!args.pipelineId) throw new Error('sales pipeline missing');
      const { data, error } = await supabase.rpc('calculate_forecast_audit_v2' as any, {
        p_organization_id: args.organizationId,
        p_pipeline_id: args.pipelineId,
        p_period_start: args.periodStart,
        p_period_end: args.periodEnd,
        p_seller_id: args.sellerId ?? null,
      });
      if (error) throw error;
      return data as ForecastAuditRunResult;
    },
    onSuccess: (data) => {
      qc.setQueryData(
        ['forecast-audit-last-run', args.organizationId, args.pipelineId, args.periodStart, args.periodEnd, args.sellerId ?? null],
        data,
      );
    },
  });

  return {
    run: mutation.data ?? null,
    runId: mutation.data?.run_id ?? null,
    isLoading: mutation.isPending,
    error: mutation.error as Error | null,
    runCalculation: mutation.mutateAsync,
    reset: mutation.reset,
  };
}
