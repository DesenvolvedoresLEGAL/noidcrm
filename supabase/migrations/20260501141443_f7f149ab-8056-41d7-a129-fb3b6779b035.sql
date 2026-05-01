-- Recreate snapshots fetch RPC with accuracy columns
DROP FUNCTION IF EXISTS public.get_forecast_snapshots_v2(uuid, uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.get_forecast_snapshots_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
)
RETURNS TABLE (
  snapshot_id uuid,
  snapshot_date date,
  period_start date,
  period_end date,
  period_type text,
  seller_id uuid,
  monthly_goal numeric,
  closed_amount numeric,
  commit_amount numeric,
  best_case_amount numeric,
  scenario_pessimistic numeric,
  scenario_realistic numeric,
  scenario_optimistic numeric,
  scenario_best_case numeric,
  pipeline_total numeric,
  forecast_confidence numeric,
  nrhs_avg numeric,
  data_quality_score numeric,
  deals_count integer,
  included_deals_count integer,
  excluded_deals_count integer,
  risk_deals_count integer,
  slipping_deals_count integer,
  no_recent_activity_count integer,
  no_next_step_count integer,
  expired_close_date_count integer,
  low_nrhs_count integer,
  accuracy_score numeric,
  actual_closed_amount numeric,
  closed_won_final_amount numeric,
  realistic_error_amount numeric,
  realistic_error_percentage numeric,
  optimistic_error_amount numeric,
  optimistic_error_percentage numeric,
  best_case_error_amount numeric,
  best_case_error_percentage numeric,
  bias_direction text,
  accuracy_calculated_at timestamptz,
  calculation_version text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.snapshot_date,
    s.period_start,
    s.period_end,
    s.period_type,
    s.seller_id,
    s.monthly_goal,
    s.closed_amount,
    s.commit_amount,
    s.best_case_amount,
    s.scenario_pessimistic,
    s.scenario_realistic,
    s.scenario_optimistic,
    s.scenario_best_case,
    s.pipeline_total,
    s.forecast_confidence,
    s.nrhs_avg,
    s.data_quality_score,
    s.deals_count,
    s.included_deals_count,
    s.excluded_deals_count,
    s.risk_deals_count,
    s.slipping_deals_count,
    s.no_recent_activity_count,
    s.no_next_step_count,
    s.expired_close_date_count,
    s.low_nrhs_count,
    s.accuracy_score,
    s.actual_closed_amount,
    s.closed_won_final_amount,
    s.realistic_error_amount,
    s.realistic_error_percentage,
    s.optimistic_error_amount,
    s.optimistic_error_percentage,
    s.best_case_error_amount,
    s.best_case_error_percentage,
    s.bias_direction,
    s.accuracy_calculated_at,
    s.calculation_version,
    s.created_at
  FROM public.forecast_daily_snapshots s
  WHERE s.organization_id = p_organization_id
    AND (p_pipeline_id IS NULL OR s.pipeline_id IS NOT DISTINCT FROM p_pipeline_id)
    AND (p_period_start IS NULL OR s.period_start = p_period_start)
    AND (p_period_end IS NULL OR s.period_end = p_period_end)
    AND (p_seller_id IS NULL OR s.seller_id IS NOT DISTINCT FROM p_seller_id)
  ORDER BY s.snapshot_date ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_snapshots_v2(uuid, uuid, date, date, uuid) TO authenticated, service_role;