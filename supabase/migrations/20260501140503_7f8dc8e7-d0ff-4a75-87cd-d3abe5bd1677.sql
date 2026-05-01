-- ============================================================
-- Sprint F2.4 — Forecast por Vendedor e Metas Comerciais
-- ============================================================

-- 1) RPC: get_seller_monthly_goal_v2
-- Returns NULL when no goal source is configured for the seller.
CREATE OR REPLACE FUNCTION public.get_seller_monthly_goal_v2(
  p_organization_id uuid,
  p_seller_id uuid,
  p_period_start date,
  p_period_end date
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_goal numeric;
BEGIN
  IF p_seller_id IS NULL OR p_organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 1) sales_goals overlapping the period (prefer pipeline-agnostic)
  SELECT target_value INTO v_goal
  FROM public.sales_goals
  WHERE organization_id = p_organization_id
    AND user_id = p_seller_id
    AND target_value IS NOT NULL
    AND target_value > 0
    AND period_start <= p_period_end
    AND period_end >= p_period_start
  ORDER BY (pipeline_id IS NULL) DESC, period_start DESC
  LIMIT 1;

  IF v_goal IS NOT NULL THEN
    RETURN v_goal;
  END IF;

  -- 2) seller_targets monthly_revenue_target whose period_month is within the period
  SELECT monthly_revenue_target INTO v_goal
  FROM public.seller_targets
  WHERE organization_id = p_organization_id
    AND user_id = p_seller_id
    AND monthly_revenue_target IS NOT NULL
    AND monthly_revenue_target > 0
    AND date_trunc('month', period_month) = date_trunc('month', p_period_start)
  ORDER BY period_month DESC
  LIMIT 1;

  IF v_goal IS NOT NULL THEN
    RETURN v_goal;
  END IF;

  -- 3) ote_seller_config.custom_goal_override active in the period
  SELECT custom_goal_override INTO v_goal
  FROM public.ote_seller_config
  WHERE organization_id = p_organization_id
    AND user_id = p_seller_id
    AND custom_goal_override IS NOT NULL
    AND custom_goal_override > 0
    AND effective_date <= p_period_start
    AND (end_date IS NULL OR end_date >= p_period_end)
  ORDER BY effective_date DESC
  LIMIT 1;

  IF v_goal IS NOT NULL THEN
    RETURN v_goal;
  END IF;

  -- 4) Fallback: ote_levels.target_revenue via active ote_seller_config
  SELECT ol.target_revenue INTO v_goal
  FROM public.ote_seller_config osc
  JOIN public.ote_levels ol ON ol.id = osc.ote_level_id
  WHERE osc.organization_id = p_organization_id
    AND osc.user_id = p_seller_id
    AND osc.effective_date <= p_period_start
    AND (osc.end_date IS NULL OR osc.end_date >= p_period_end)
    AND ol.target_revenue IS NOT NULL
    AND ol.target_revenue > 0
  ORDER BY osc.effective_date DESC
  LIMIT 1;

  RETURN v_goal; -- may be NULL
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_seller_monthly_goal_v2(uuid, uuid, date, date) TO authenticated;

-- ============================================================
-- 2) RPC: get_forecast_seller_performance_v2
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_forecast_seller_performance_v2(
  p_organization_id uuid,
  p_pipeline_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS TABLE (
  seller_id uuid,
  seller_name text,
  seller_email text,
  seller_avatar_url text,
  monthly_goal numeric,
  has_goal boolean,
  closed_amount numeric,
  scenario_realistic numeric,
  scenario_optimistic numeric,
  scenario_best_case numeric,
  gap_to_goal numeric,
  goal_attainment_percentage numeric,
  pipeline_total numeric,
  coverage_ratio numeric,
  deals_count integer,
  included_deals_count integer,
  excluded_deals_count integer,
  risk_deals_count integer,
  slipping_deals_count integer,
  no_recent_activity_count integer,
  no_next_step_count integer,
  expired_close_date_count integer,
  low_nrhs_count integer,
  nrhs_avg numeric,
  forecast_confidence numeric,
  risk_amount numeric,
  slipping_amount numeric,
  recommended_action text,
  recommended_action_type text,
  calculation_version text,
  run_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_is_admin boolean := false;
  v_is_platform boolean := false;
  v_can_view_all boolean := false;
  v_seller record;
  v_audit jsonb;
  v_run_id uuid;
  v_calc_version text;
  v_goal numeric;
  v_has_goal boolean;
  v_closed numeric;
  v_realistic numeric;
  v_optimistic numeric;
  v_best_case numeric;
  v_pipeline_total numeric;
  v_deals integer;
  v_included integer;
  v_excluded integer;
  v_risk_count integer;
  v_slipping_count integer;
  v_no_recent integer;
  v_no_next integer;
  v_expired integer;
  v_low_nrhs integer;
  v_nrhs_avg numeric;
  v_confidence numeric;
  v_risk_amount numeric;
  v_slipping_amount numeric;
  v_gap numeric;
  v_attainment numeric;
  v_coverage numeric;
  v_action text;
  v_action_type text;
BEGIN
  -- Tenant guard
  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();

  IF v_caller IS NOT NULL
     AND v_caller_org IS DISTINCT FROM p_organization_id
     AND NOT v_is_platform THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  -- Permission scope
  v_is_admin := public.has_role(v_caller, 'admin'::app_role)
             OR public.has_role(v_caller, 'owner'::app_role)
             OR public.has_role(v_caller, 'manager'::app_role);
  v_can_view_all := v_is_admin OR v_is_platform;

  -- Iterate over eligible sellers
  FOR v_seller IN
    SELECT u.user_id, u.full_name, u.email, u.avatar_url
    FROM public.crm_active_users_view u
    WHERE u.tenant_id = p_organization_id
      AND (v_can_view_all OR u.user_id = v_caller)
    ORDER BY u.full_name
  LOOP
    -- Run the audit engine for this seller
    BEGIN
      v_audit := public.calculate_forecast_audit_v2(
        p_organization_id, p_pipeline_id, p_period_start, p_period_end, v_seller.user_id
      );
    EXCEPTION WHEN OTHERS THEN
      v_audit := NULL;
    END;

    IF v_audit IS NULL THEN
      CONTINUE;
    END IF;

    v_run_id := NULLIF(v_audit->>'run_id','')::uuid;
    v_calc_version := COALESCE(v_audit->>'calculation_version', 'forecast_v2_audit_1');
    v_closed := COALESCE((v_audit->>'total_closed')::numeric, 0);
    v_realistic := COALESCE((v_audit->>'scenario_realistic')::numeric, 0);
    v_optimistic := COALESCE((v_audit->>'scenario_optimistic')::numeric, 0);
    v_best_case := COALESCE((v_audit->>'scenario_best_case')::numeric, 0);
    v_pipeline_total := COALESCE((v_audit->>'data_quality_score')::numeric * 0, 0); -- placeholder; recomputed below
    v_deals := COALESCE((v_audit->>'deals_count')::integer, 0);
    v_included := COALESCE((v_audit->>'included_deals_count')::integer, 0);
    v_excluded := COALESCE((v_audit->>'excluded_deals_count')::integer, 0);
    v_risk_count := COALESCE((v_audit->>'risk_deals_count')::integer, 0);
    v_slipping_count := COALESCE((v_audit->>'slipping_deals_count')::integer, 0);
    v_nrhs_avg := COALESCE((v_audit->>'nrhs_avg')::numeric, 0);
    v_confidence := COALESCE((v_audit->>'forecast_confidence')::numeric, 0);

    -- Pull pipeline_total + hygiene + risk amounts from items + run
    SELECT COALESCE(r.pipeline_total, 0) INTO v_pipeline_total
    FROM public.forecast_calculation_runs r WHERE r.id = v_run_id;

    SELECT
      COUNT(*) FILTER (WHERE i.last_activity_at IS NULL OR i.last_activity_at < (now() - interval '7 days')),
      COUNT(*) FILTER (WHERE COALESCE(i.next_step_exists, false) = false),
      COUNT(*) FILTER (WHERE i.close_date IS NOT NULL AND i.close_date < current_date AND i.eligibility_status <> 'excluded'),
      COUNT(*) FILTER (WHERE COALESCE(i.nrhs_score, 0) < 60),
      COALESCE(SUM(i.deal_value) FILTER (
        WHERE i.eligibility_status <> 'excluded' AND (
          i.risk_level IN ('alto','critico','crítico','high','critical')
          OR i.forecast_bucket = 'slipping'
          OR i.penalty_reasons && ARRAY['high_risk','critical_risk','expired_close_date','stale_activity']::text[]
        )
      ), 0),
      COALESCE(SUM(i.deal_value) FILTER (WHERE i.forecast_bucket = 'slipping'), 0)
    INTO v_no_recent, v_no_next, v_expired, v_low_nrhs, v_risk_amount, v_slipping_amount
    FROM public.forecast_calculation_items i
    WHERE i.run_id = v_run_id;

    -- Goal & derived metrics
    v_goal := public.get_seller_monthly_goal_v2(p_organization_id, v_seller.user_id, p_period_start, p_period_end);
    v_has_goal := v_goal IS NOT NULL AND v_goal > 0;

    IF v_has_goal THEN
      v_gap := v_goal - v_closed;
      v_attainment := ROUND((v_closed / v_goal) * 100, 2);
      v_coverage := CASE WHEN v_goal > 0 THEN ROUND(v_pipeline_total / v_goal, 2) ELSE NULL END;
    ELSE
      v_gap := NULL;
      v_attainment := NULL;
      v_coverage := NULL;
    END IF;

    -- Recommended action (priority cascade)
    IF NOT v_has_goal THEN
      v_action_type := 'configure_goal';
      v_action := 'Configurar meta mensal do vendedor';
    ELSIF v_coverage IS NOT NULL AND v_coverage < 2 THEN
      v_action_type := 'increase_pipeline';
      v_action := 'Aumentar geração de pipeline. Cobertura abaixo de 2x.';
    ELSIF v_risk_count >= 3 OR (v_has_goal AND v_risk_amount >= (v_goal * 0.3)) THEN
      v_action_type := 'recover_risk_deals';
      v_action := 'Recuperar deals em risco antes de confiar no forecast.';
    ELSIF v_no_recent >= 3 THEN
      v_action_type := 'reactivate_stale_deals';
      v_action := 'Reativar oportunidades sem atividade recente.';
    ELSIF v_no_next >= 3 THEN
      v_action_type := 'define_next_steps';
      v_action := 'Definir próximo passo nas oportunidades abertas.';
    ELSE
      v_action_type := 'maintain_execution';
      v_action := 'Manter cadência e proteger os deals de maior valor.';
    END IF;

    -- Skip sellers with zero relevance (no deals AND no goal AND not viewing self)
    IF v_deals = 0 AND v_closed = 0 AND NOT v_has_goal AND v_seller.user_id <> v_caller THEN
      CONTINUE;
    END IF;

    seller_id := v_seller.user_id;
    seller_name := COALESCE(v_seller.full_name, v_seller.email, 'Vendedor');
    seller_email := v_seller.email;
    seller_avatar_url := v_seller.avatar_url;
    monthly_goal := v_goal;
    has_goal := v_has_goal;
    closed_amount := v_closed;
    scenario_realistic := v_realistic;
    scenario_optimistic := v_optimistic;
    scenario_best_case := v_best_case;
    gap_to_goal := v_gap;
    goal_attainment_percentage := v_attainment;
    pipeline_total := v_pipeline_total;
    coverage_ratio := v_coverage;
    deals_count := v_deals;
    included_deals_count := v_included;
    excluded_deals_count := v_excluded;
    risk_deals_count := v_risk_count;
    slipping_deals_count := v_slipping_count;
    no_recent_activity_count := v_no_recent;
    no_next_step_count := v_no_next;
    expired_close_date_count := v_expired;
    low_nrhs_count := v_low_nrhs;
    nrhs_avg := v_nrhs_avg;
    forecast_confidence := v_confidence;
    risk_amount := v_risk_amount;
    slipping_amount := v_slipping_amount;
    recommended_action := v_action;
    recommended_action_type := v_action_type;
    calculation_version := v_calc_version;
    run_id := v_run_id;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_seller_performance_v2(uuid, uuid, date, date) TO authenticated;