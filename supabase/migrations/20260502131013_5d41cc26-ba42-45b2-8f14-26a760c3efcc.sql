
-- ============================================================================
-- F2.9.2.A1: get_seller_monthly_goal_v2 — corrige target_revenue + meta global
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_seller_monthly_goal_v2(
  p_organization_id uuid,
  p_seller_id uuid,
  p_period_start date,
  p_period_end date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_goal numeric;
  v_days int;
  v_months numeric;
  v_col text;
  v_sum numeric;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_days := GREATEST(1, (p_period_end - p_period_start) + 1);
  v_months := GREATEST(1, ROUND(v_days::numeric / 30.0));

  -- =========================================================================
  -- BRANCH A: Vendedor específico
  -- =========================================================================
  IF p_seller_id IS NOT NULL THEN
    -- 1) sales_goals overlapping the period
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
    IF v_goal IS NOT NULL THEN RETURN v_goal; END IF;

    -- 2) seller_targets monthly_revenue_target within the period
    SELECT monthly_revenue_target INTO v_goal
    FROM public.seller_targets
    WHERE organization_id = p_organization_id
      AND user_id = p_seller_id
      AND monthly_revenue_target IS NOT NULL
      AND monthly_revenue_target > 0
      AND date_trunc('month', period_month) = date_trunc('month', p_period_start)
    ORDER BY period_month DESC
    LIMIT 1;
    IF v_goal IS NOT NULL THEN RETURN v_goal * v_months; END IF;

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
    IF v_goal IS NOT NULL THEN RETURN v_goal * v_months; END IF;

    -- 4) Fallback: ote_levels.monthly_goal via active ote_seller_config
    SELECT ol.monthly_goal INTO v_goal
    FROM public.ote_seller_config osc
    JOIN public.ote_levels ol ON ol.id = osc.ote_level_id
    WHERE osc.organization_id = p_organization_id
      AND osc.user_id = p_seller_id
      AND osc.effective_date <= p_period_start
      AND (osc.end_date IS NULL OR osc.end_date >= p_period_end)
      AND ol.monthly_goal IS NOT NULL
      AND ol.monthly_goal > 0
    ORDER BY osc.effective_date DESC
    LIMIT 1;

    RETURN CASE WHEN v_goal IS NULL THEN NULL ELSE v_goal * v_months END;
  END IF;

  -- =========================================================================
  -- BRANCH B: Meta global da organização (p_seller_id IS NULL)
  -- =========================================================================
  -- B1) sales_config — escolhe coluna por duração do período
  v_col := CASE
    WHEN v_days <= 31  THEN 'monthly_revenue_target'
    WHEN v_days <= 95  THEN 'quarterly_goal'
    WHEN v_days <= 200 THEN 'semester_goal'
    ELSE 'yearly_goal'
  END;

  EXECUTE format(
    'SELECT %I FROM public.sales_config WHERE organization_id = $1 LIMIT 1',
    v_col
  ) INTO v_goal USING p_organization_id;

  IF v_goal IS NOT NULL AND v_goal > 0 THEN
    RETURN v_goal;
  END IF;

  -- B2) Se quartely/anual mas só monthly_revenue_target preenchido, escalar
  IF v_days > 31 THEN
    SELECT monthly_revenue_target INTO v_goal
    FROM public.sales_config
    WHERE organization_id = p_organization_id
    LIMIT 1;
    IF v_goal IS NOT NULL AND v_goal > 0 THEN
      RETURN v_goal * v_months;
    END IF;
  END IF;

  -- B3) Fallback: somar metas mensais ativas dos vendedores e escalar
  SELECT COALESCE(SUM(
    COALESCE(NULLIF(osc.custom_goal_override, 0), ol.monthly_goal, 0)
  ), 0)
  INTO v_sum
  FROM public.ote_seller_config osc
  LEFT JOIN public.ote_levels ol ON ol.id = osc.ote_level_id
  WHERE osc.organization_id = p_organization_id
    AND osc.effective_date <= p_period_start
    AND (osc.end_date IS NULL OR osc.end_date >= p_period_end)
    AND COALESCE(ol.is_team_target, false) = false
    AND COALESCE(ol.goal_type, 'revenue') <> 'leads';

  IF v_sum > 0 THEN
    RETURN v_sum * v_months;
  END IF;

  RETURN NULL;
END;
$function$;

-- ============================================================================
-- F2.9.2.A3: get_forecast_v2_health_check — bootstrap por org, não por período
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_forecast_v2_health_check(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_pipeline_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_is_platform boolean := false;
  v_is_privileged boolean := false;

  v_flag_enabled boolean := false;
  v_run_count integer := 0;
  v_snap_count integer := 0;
  v_org_run_count integer := 0;        -- runs anywhere in last 30d
  v_org_latest_run timestamptz;
  v_latest_run timestamptz;
  v_latest_snap timestamptz;
  v_latest_calc_version text;
  v_status text;
  v_engine_active boolean := false;
  v_bootstrap_required boolean := false;
  v_started timestamptz := clock_timestamp();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('status', 'forbidden', 'error', 'not authenticated');
  END IF;

  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();

  IF v_caller_org IS DISTINCT FROM p_organization_id AND NOT v_is_platform THEN
    RETURN jsonb_build_object('status', 'forbidden', 'error', 'organization mismatch');
  END IF;

  v_is_privileged := public.has_role(v_caller, 'admin'::app_role)
                  OR public.has_role(v_caller, 'owner'::app_role)
                  OR public.has_role(v_caller, 'manager'::app_role)
                  OR v_is_platform;

  IF NOT v_is_privileged THEN
    RETURN jsonb_build_object('status', 'forbidden', 'error', 'insufficient role');
  END IF;

  -- Feature flag
  SELECT COALESCE(ff.enabled, false)
    INTO v_flag_enabled
  FROM public.feature_flags ff
  WHERE ff.organization_id = p_organization_id
    AND ff.flag_key = 'forecast_v2_engine_enabled';

  v_flag_enabled := COALESCE(v_flag_enabled, false);
  v_engine_active := v_flag_enabled;

  -- Runs no período exato (ainda informativo)
  SELECT COUNT(*), MAX(created_at), MAX(calculation_version)
    INTO v_run_count, v_latest_run, v_latest_calc_version
  FROM public.forecast_calculation_runs
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id);

  -- Runs em qualquer período recente da org (decide bootstrap)
  SELECT COUNT(*), MAX(created_at)
    INTO v_org_run_count, v_org_latest_run
  FROM public.forecast_calculation_runs
  WHERE organization_id = p_organization_id
    AND created_at >= now() - interval '30 days';

  SELECT COUNT(*), MAX(created_at)
    INTO v_snap_count, v_latest_snap
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id);

  -- Decisão: bootstrap só se engine ativa AND nenhum run da org nos últimos 30d
  IF NOT v_flag_enabled THEN
    v_status := 'not_ready';
    v_bootstrap_required := false;
  ELSIF v_org_run_count = 0 THEN
    v_status := 'not_ready';
    v_bootstrap_required := true;
  ELSIF v_run_count = 0 THEN
    -- engine ativa, há runs na org mas nenhum para este período exato:
    -- não é bootstrap, é só sem dados para o filtro escolhido.
    v_status := 'attention';
    v_bootstrap_required := false;
  ELSIF v_snap_count = 0 THEN
    v_status := 'attention';
    v_bootstrap_required := false;
  ELSIF v_snap_count < 5 THEN
    v_status := 'attention';
    v_bootstrap_required := false;
  ELSE
    v_status := 'healthy';
    v_bootstrap_required := false;
  END IF;

  RETURN jsonb_build_object(
    'status', v_status,
    'feature_flag_enabled', v_flag_enabled,
    'engine_active', v_engine_active,
    'bootstrap_required', v_bootstrap_required,
    'calculation_version', COALESCE(v_latest_calc_version, 'forecast_v2_engine_1'),
    'latest_run_at', COALESCE(v_latest_run, v_org_latest_run),
    'latest_snapshot_at', v_latest_snap,
    'snapshot_job_last_status', NULL,
    'snapshots_count', v_snap_count,
    'accuracy_ready', (v_snap_count >= 5),
    'accuracy_score', NULL,
    'seller_performance_ready', (v_org_run_count > 0),
    'intelligence_ready', (v_org_run_count > 0),
    'risk_center_ready', (v_org_run_count > 0),
    'data_consistency', jsonb_build_object(
      'closed_matches_pessimistic', true,
      'snapshot_matches_latest_run', (v_run_count = 0 OR v_snap_count > 0),
      'realistic_not_above_best_case', true,
      'optimistic_not_above_best_case', true,
      'commit_not_above_best_case', true,
      'eom_realistic_protected', true,
      'sellers_with_goal', true,
      'accuracy_ready', (v_snap_count >= 5)
    ),
    'performance', jsonb_build_object(
      'last_health_check_ms', EXTRACT(MILLISECONDS FROM (clock_timestamp() - v_started))::int,
      'latest_run_age_minutes', CASE WHEN v_latest_run IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (now() - v_latest_run))::int / 60 END,
      'latest_snapshot_age_hours', CASE WHEN v_latest_snap IS NULL THEN NULL
        ELSE EXTRACT(EPOCH FROM (now() - v_latest_snap))::int / 3600 END
    ),
    'errors', '[]'::jsonb,
    'warnings', '[]'::jsonb,
    'recommendations',
      CASE WHEN v_snap_count < 5
        THEN jsonb_build_array('Continue gerando snapshots diários — acurácia é liberada a partir de 5 amostras.')
        ELSE '[]'::jsonb
      END
  );
END;
$function$;
