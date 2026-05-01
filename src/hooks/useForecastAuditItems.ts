/**
 * Sprint F2.1 — Lista de items (oportunidades) de um run de auditoria.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ForecastAuditItem {
  id: string;
  run_id: string;
  organization_id: string;
  opportunity_id: string;
  seller_id: string | null;
  stage_id: string | null;
  deal_name: string | null;
  company_name: string | null;
  deal_value: number;
  manual_probability: number | null;
  stage_probability: number | null;
  adjusted_probability: number | null;
  nrhs_score: number | null;
  nrhs_factor: number | null;
  time_factor: number | null;
  activity_factor: number | null;
  next_step_factor: number | null;
  stage_factor: number | null;
  risk_factor: number | null;
  adjusted_value: number;
  forecast_bucket:
    | 'closed' | 'commit' | 'best_case' | 'realistic'
    | 'optimistic' | 'pipeline_only' | 'excluded' | 'slipping';
  metadata?: Record<string, any> | null;
  eligibility_status: 'included' | 'penalized' | 'excluded' | 'slipping';
  risk_level: 'low' | 'medium' | 'high' | null;
  close_date: string | null;
  last_activity_at: string | null;
  next_step_exists: boolean;
  exclusion_reasons: string[];
  penalty_reasons: string[];
  created_at: string;
}

export interface ForecastAuditItemsFilters {
  bucket?: ForecastAuditItem['forecast_bucket'] | null;
  sellerId?: string | null;
  riskLevel?: 'low' | 'medium' | 'high' | null;
  eligibility?: ForecastAuditItem['eligibility_status'] | null;
  exclusionReason?: string | null;
}

export function useForecastAuditItems(
  runId: string | null | undefined,
  filters: ForecastAuditItemsFilters = {},
) {
  return useQuery({
    queryKey: ['forecast-audit-items', runId, filters],
    enabled: !!runId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<ForecastAuditItem[]> => {
      let q = supabase
        .from('forecast_calculation_items' as any)
        .select('*')
        .eq('run_id', runId!)
        .order('adjusted_value', { ascending: false })
        .limit(500);

      if (filters.bucket) q = q.eq('forecast_bucket', filters.bucket);
      if (filters.sellerId) q = q.eq('seller_id', filters.sellerId);
      if (filters.riskLevel) q = q.eq('risk_level', filters.riskLevel);
      if (filters.eligibility) q = q.eq('eligibility_status', filters.eligibility);
      if (filters.exclusionReason) q = q.contains('exclusion_reasons', [filters.exclusionReason]);

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ForecastAuditItem[];
    },
  });
}
