-- ============================================================
-- Sprint F2.5 — Acurácia Real do Forecast
-- ============================================================

-- 1) Schema additions on forecast_daily_snapshots (idempotent)
ALTER TABLE public.forecast_daily_snapshots
  ADD COLUMN IF NOT EXISTS actual_closed_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS realistic_error_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS realistic_error_percentage numeric NULL,
  ADD COLUMN IF NOT EXISTS optimistic_error_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS optimistic_error_percentage numeric NULL,
  ADD COLUMN IF NOT EXISTS best_case_error_amount numeric NULL,
  ADD COLUMN IF NOT EXISTS best_case_error_percentage numeric NULL,
  ADD COLUMN IF NOT EXISTS bias_direction text NULL,
  ADD COLUMN IF NOT EXISTS accuracy_calculated_at timestamptz NULL;

-- Bias check constraint (idempotent via DROP IF EXISTS)
ALTER TABLE public.forecast_daily_snapshots
  DROP CONSTRAINT IF EXISTS fds_bias_direction_check;
ALTER TABLE public.forecast_daily_snapshots
  ADD CONSTRAINT fds_bias_direction_check
  CHECK (bias_direction IS NULL OR bias_direction IN ('overestimating','underestimating','balanced','unknown'));

-- ============================================================
-- 2) RPC: get_forecast_actual_closed_amount_v2
--    Same revenue formula used by the V2 engine for closed deals.
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_forecast_actual_closed_amount_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_total numeric := 0;
BEGIN
  IF v_caller IS NOT NULL THEN
    SELECT public.get_user_organization_id() INTO v_caller_org;
    IF v_caller_org IS DISTINCT FROM p_organization_id
       AND NOT public.is_platform_admin() THEN
      RAISE EXCEPTION 'forbidden: organization mismatch';
    END IF;
  END IF;

  SELECT COALESCE(SUM(
           COALESCE(o.valor_previsto, COALESCE(o.mrr_value,0)*12 + COALESCE(o.arr_value,0), 0)
         ), 0)
    INTO v_total
  FROM public.opportunities o
  WHERE o.organization_id = p_organization_id
    AND o.deleted_at IS NULL
    AND o.status = 'won'
    AND o.closed_at IS NOT NULL
    AND o.closed_at::date BETWEEN p_period_start AND p_period_end
    AND (p_pipeline_id IS NULL OR o.pipeline_id = p_pipeline_id)
    AND (p_seller_id IS NULL OR o.owner_user_id = p_seller_id);

  RETURN v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_actual_closed_amount_v2(uuid, uuid, date, date, uuid)
  TO authenticated;

-- ============================================================
-- 3) RPC: calculate_forecast_accuracy_v2
--    Updates snapshots in scope with per-scenario error fields and
--    returns an aggregated summary.
-- ============================================================
CREATE OR REPLACE FUNCTION public.calculate_forecast_accuracy_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL,
  p_seller_id uuid DEFAULT NULL
) RETURNS jsonb
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
  v_seller_filter uuid := p_seller_id;

  v_actual numeric := 0;
  v_count integer := 0;
  v_avg_realistic numeric := 0;
  v_last_realistic numeric := 0;
  v_avg_err_amt numeric := 0;
  v_avg_err_pct numeric := 0;
  v_mape numeric := 0;
  v_accuracy numeric := 0;
  v_bias text := 'unknown';
  v_trend text := 'unknown';
  v_calc_version text := 'forecast_v2_engine_1';

  v_first_avg numeric;
  v_second_avg numeric;
  v_split integer;

  v_best jsonb := '{}'::jsonb;
  v_worst jsonb := '{}'::jsonb;
BEGIN
  -- Tenant + role guards
  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();
  IF v_caller IS NOT NULL
     AND v_caller_org IS DISTINCT FROM p_organization_id
     AND NOT v_is_platform THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::app_role)
             OR public.has_role(v_caller, 'owner'::app_role)
             OR public.has_role(v_caller, 'manager'::app_role);
  v_can_view_all := v_is_admin OR v_is_platform;

  -- Force seller scope to self when not allowed to view all
  IF NOT v_can_view_all AND v_caller IS NOT NULL THEN
    v_seller_filter := v_caller;
  END IF;

  -- Actual closed for the scope
  v_actual := COALESCE(public.get_forecast_actual_closed_amount_v2(
    p_organization_id, p_pipeline_id, p_period_start, p_period_end, v_seller_filter
  ), 0);

  -- Update snapshots in scope with per-scenario errors and bias
  WITH scoped AS (
    SELECT id,
           COALESCE(scenario_realistic, 0) AS realistic,
           COALESCE(scenario_optimistic, 0) AS optimistic,
           COALESCE(scenario_best_case, 0) AS best_case
    FROM public.forecast_daily_snapshots
    WHERE organization_id = p_organization_id
      AND period_start = p_period_start
      AND period_end = p_period_end
      AND (
        (p_pipeline_id IS NULL AND pipeline_id IS NULL)
        OR pipeline_id = p_pipeline_id
      )
      AND (
        (v_seller_filter IS NULL AND seller_id IS NULL)
        OR seller_id = v_seller_filter
      )
  )
  UPDATE public.forecast_daily_snapshots fds
  SET actual_closed_amount = v_actual,
      closed_won_final_amount = COALESCE(fds.closed_won_final_amount, v_actual),
      realistic_error_amount = (s.realistic - v_actual),
      realistic_error_percentage = CASE
        WHEN v_actual > 0 THEN ROUND(ABS(s.realistic - v_actual) / v_actual * 100, 2)
        WHEN s.realistic > 0 THEN 100
        ELSE 0
      END,
      optimistic_error_amount = (s.optimistic - v_actual),
      optimistic_error_percentage = CASE
        WHEN v_actual > 0 THEN ROUND(ABS(s.optimistic - v_actual) / v_actual * 100, 2)
        WHEN s.optimistic > 0 THEN 100
        ELSE 0
      END,
      best_case_error_amount = (s.best_case - v_actual),
      best_case_error_percentage = CASE
        WHEN v_actual > 0 THEN ROUND(ABS(s.best_case - v_actual) / v_actual * 100, 2)
        WHEN s.best_case > 0 THEN 100
        ELSE 0
      END,
      accuracy_score = GREATEST(0, 100 - (CASE
        WHEN v_actual > 0 THEN ROUND(ABS(s.realistic - v_actual) / v_actual * 100, 2)
        WHEN s.realistic > 0 THEN 100
        ELSE 0
      END)),
      forecast_error_amount = COALESCE(fds.forecast_error_amount, s.realistic - v_actual),
      forecast_error_percentage = COALESCE(fds.forecast_error_percentage, CASE
        WHEN v_actual > 0 THEN ROUND(ABS(s.realistic - v_actual) / v_actual * 100, 2)
        WHEN s.realistic > 0 THEN 100
        ELSE 0
      END),
      bias_direction = CASE
        WHEN v_actual = 0 AND s.realistic = 0 THEN 'unknown'
        WHEN v_actual = 0 AND s.realistic > 0 THEN 'overestimating'
        WHEN s.realistic > v_actual * 1.10 THEN 'overestimating'
        WHEN s.realistic < v_actual * 0.90 THEN 'underestimating'
        ELSE 'balanced'
      END,
      accuracy_calculated_at = now(),
      updated_at = now()
  FROM scoped s
  WHERE fds.id = s.id;

  -- Aggregate
  SELECT
    COUNT(*),
    COALESCE(AVG(scenario_realistic), 0),
    COALESCE(AVG(realistic_error_amount), 0),
    COALESCE(AVG(realistic_error_percentage), 0),
    MAX(calculation_version)
  INTO v_count, v_avg_realistic, v_avg_err_amt, v_avg_err_pct, v_calc_version
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND ((p_pipeline_id IS NULL AND pipeline_id IS NULL) OR pipeline_id = p_pipeline_id)
    AND ((v_seller_filter IS NULL AND seller_id IS NULL) OR seller_id = v_seller_filter);

  v_calc_version := COALESCE(v_calc_version, 'forecast_v2_engine_1');
  v_mape := COALESCE(v_avg_err_pct, 0);
  v_accuracy := GREATEST(0, 100 - v_mape);

  -- Last realistic
  SELECT COALESCE(scenario_realistic, 0)
    INTO v_last_realistic
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND ((p_pipeline_id IS NULL AND pipeline_id IS NULL) OR pipeline_id = p_pipeline_id)
    AND ((v_seller_filter IS NULL AND seller_id IS NULL) OR seller_id = v_seller_filter)
  ORDER BY snapshot_date DESC
  LIMIT 1;

  -- Best/worst (by realistic_error_percentage)
  SELECT jsonb_build_object(
    'snapshot_date', snapshot_date,
    'realistic_error_percentage', realistic_error_percentage,
    'realistic_error_amount', realistic_error_amount,
    'scenario_realistic', scenario_realistic,
    'actual_closed_amount', COALESCE(actual_closed_amount, v_actual),
    'accuracy_score', accuracy_score
  )
  INTO v_best
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND ((p_pipeline_id IS NULL AND pipeline_id IS NULL) OR pipeline_id = p_pipeline_id)
    AND ((v_seller_filter IS NULL AND seller_id IS NULL) OR seller_id = v_seller_filter)
    AND realistic_error_percentage IS NOT NULL
  ORDER BY realistic_error_percentage ASC, snapshot_date DESC
  LIMIT 1;

  SELECT jsonb_build_object(
    'snapshot_date', snapshot_date,
    'realistic_error_percentage', realistic_error_percentage,
    'realistic_error_amount', realistic_error_amount,
    'scenario_realistic', scenario_realistic,
    'actual_closed_amount', COALESCE(actual_closed_amount, v_actual),
    'accuracy_score', accuracy_score
  )
  INTO v_worst
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND ((p_pipeline_id IS NULL AND pipeline_id IS NULL) OR pipeline_id = p_pipeline_id)
    AND ((v_seller_filter IS NULL AND seller_id IS NULL) OR seller_id = v_seller_filter)
    AND realistic_error_percentage IS NOT NULL
  ORDER BY realistic_error_percentage DESC, snapshot_date DESC
  LIMIT 1;

  -- Consolidated bias from average vs actual
  v_bias := CASE
    WHEN v_actual = 0 AND v_avg_realistic = 0 THEN 'unknown'
    WHEN v_actual = 0 AND v_avg_realistic > 0 THEN 'overestimating'
    WHEN v_avg_realistic > v_actual * 1.10 THEN 'overestimating'
    WHEN v_avg_realistic < v_actual * 0.90 THEN 'underestimating'
    ELSE 'balanced'
  END;

  -- Trend: split by date into halves and compare avg error
  v_trend := 'unknown';
  IF v_count >= 5 THEN
    v_split := v_count / 2;
    WITH ordered AS (
      SELECT realistic_error_percentage,
             ROW_NUMBER() OVER (ORDER BY snapshot_date ASC) AS rn
      FROM public.forecast_daily_snapshots
      WHERE organization_id = p_organization_id
        AND period_start = p_period_start
        AND period_end = p_period_end
        AND ((p_pipeline_id IS NULL AND pipeline_id IS NULL) OR pipeline_id = p_pipeline_id)
        AND ((v_seller_filter IS NULL AND seller_id IS NULL) OR seller_id = v_seller_filter)
        AND realistic_error_percentage IS NOT NULL
    )
    SELECT
      COALESCE(AVG(realistic_error_percentage) FILTER (WHERE rn <= v_split), 0),
      COALESCE(AVG(realistic_error_percentage) FILTER (WHERE rn > v_split), 0)
    INTO v_first_avg, v_second_avg
    FROM ordered;

    IF v_first_avg IS NOT NULL AND v_second_avg IS NOT NULL THEN
      IF v_first_avg = 0 AND v_second_avg = 0 THEN
        v_trend := 'stable';
      ELSIF v_first_avg = 0 THEN
        v_trend := CASE WHEN v_second_avg > 0 THEN 'worsening' ELSE 'stable' END;
      ELSE
        IF v_second_avg < v_first_avg * 0.9 THEN
          v_trend := 'improving';
        ELSIF v_second_avg > v_first_avg * 1.1 THEN
          v_trend := 'worsening';
        ELSE
          v_trend := 'stable';
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'actual_closed_amount', v_actual,
    'snapshots_count', v_count,
    'avg_realistic_forecast', ROUND(v_avg_realistic, 2),
    'last_realistic_forecast', ROUND(v_last_realistic, 2),
    'avg_error_amount', ROUND(v_avg_err_amt, 2),
    'avg_error_percentage', ROUND(v_avg_err_pct, 2),
    'mape', ROUND(v_mape, 2),
    'accuracy_score', ROUND(v_accuracy, 2),
    'bias_direction', v_bias,
    'best_snapshot', COALESCE(v_best, '{}'::jsonb),
    'worst_snapshot', COALESCE(v_worst, '{}'::jsonb),
    'forecast_trend', v_trend,
    'calculation_version', v_calc_version,
    'seller_id', v_seller_filter
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_forecast_accuracy_v2(uuid, uuid, date, date, uuid)
  TO authenticated;

-- ============================================================
-- 4) RPC: get_forecast_seller_accuracy_v2
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_forecast_seller_accuracy_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL,
  p_period_start date DEFAULT NULL,
  p_period_end date DEFAULT NULL
)
RETURNS TABLE (
  seller_id uuid,
  seller_name text,
  seller_email text,
  snapshots_count integer,
  actual_closed_amount numeric,
  avg_realistic_forecast numeric,
  last_realistic_forecast numeric,
  avg_error_percentage numeric,
  accuracy_score numeric,
  bias_direction text,
  forecast_trend text,
  calculation_version text
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
  v_summary jsonb;
BEGIN
  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();
  IF v_caller IS NOT NULL
     AND v_caller_org IS DISTINCT FROM p_organization_id
     AND NOT v_is_platform THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::app_role)
             OR public.has_role(v_caller, 'owner'::app_role)
             OR public.has_role(v_caller, 'manager'::app_role);
  v_can_view_all := v_is_admin OR v_is_platform;

  FOR v_seller IN
    SELECT u.user_id, u.full_name, u.email
    FROM public.crm_active_users_view u
    WHERE u.tenant_id = p_organization_id
      AND (v_can_view_all OR u.user_id = v_caller)
    ORDER BY u.full_name
  LOOP
    BEGIN
      v_summary := public.calculate_forecast_accuracy_v2(
        p_organization_id, p_pipeline_id, p_period_start, p_period_end, v_seller.user_id
      );
    EXCEPTION WHEN OTHERS THEN
      v_summary := NULL;
    END;

    IF v_summary IS NULL THEN
      CONTINUE;
    END IF;

    -- Skip sellers with absolutely no data and no snapshots
    IF COALESCE((v_summary->>'snapshots_count')::int, 0) = 0
       AND COALESCE((v_summary->>'actual_closed_amount')::numeric, 0) = 0
       AND v_seller.user_id <> COALESCE(v_caller, '00000000-0000-0000-0000-000000000000'::uuid) THEN
      CONTINUE;
    END IF;

    seller_id := v_seller.user_id;
    seller_name := COALESCE(v_seller.full_name, v_seller.email, 'Vendedor');
    seller_email := v_seller.email;
    snapshots_count := COALESCE((v_summary->>'snapshots_count')::int, 0);
    actual_closed_amount := COALESCE((v_summary->>'actual_closed_amount')::numeric, 0);
    avg_realistic_forecast := COALESCE((v_summary->>'avg_realistic_forecast')::numeric, 0);
    last_realistic_forecast := COALESCE((v_summary->>'last_realistic_forecast')::numeric, 0);
    avg_error_percentage := COALESCE((v_summary->>'avg_error_percentage')::numeric, 0);
    accuracy_score := COALESCE((v_summary->>'accuracy_score')::numeric, 0);
    bias_direction := COALESCE(v_summary->>'bias_direction', 'unknown');
    forecast_trend := COALESCE(v_summary->>'forecast_trend', 'unknown');
    calculation_version := COALESCE(v_summary->>'calculation_version', 'forecast_v2_engine_1');
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_seller_accuracy_v2(uuid, uuid, date, date)
  TO authenticated;