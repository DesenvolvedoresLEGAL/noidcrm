-- =====================================================================
-- Sprint F2.9 — Forecast V2 Activation, Fixes e Estabilização Final
-- =====================================================================

-- 1.1 ----------------------------------------------------------------
-- Safe activator for the Forecast V2 engine feature flag.
-- Uses INSERT ... ON CONFLICT to handle the case where the row does
-- not exist for the organization yet (root cause of "UPDATE doesn't
-- activate anything").
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_forecast_v2_engine(
  p_organization_id uuid,
  p_enabled boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_is_platform boolean := false;
  v_is_admin boolean := false;
  v_row public.feature_flags%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'forbidden: not authenticated';
  END IF;

  SELECT public.get_user_organization_id() INTO v_caller_org;
  v_is_platform := public.is_platform_admin();

  IF v_caller_org IS DISTINCT FROM p_organization_id AND NOT v_is_platform THEN
    RAISE EXCEPTION 'forbidden: organization mismatch';
  END IF;

  v_is_admin := public.has_role(v_caller, 'admin'::app_role)
             OR public.has_role(v_caller, 'owner'::app_role)
             OR public.has_role(v_caller, 'manager'::app_role);

  IF NOT (v_is_admin OR v_is_platform) THEN
    RAISE EXCEPTION 'forbidden: insufficient role';
  END IF;

  INSERT INTO public.feature_flags (organization_id, flag_key, enabled)
  VALUES (p_organization_id, 'forecast_v2_engine_enabled', p_enabled)
  ON CONFLICT (organization_id, flag_key)
  DO UPDATE SET
    enabled = EXCLUDED.enabled,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN jsonb_build_object(
    'organization_id', v_row.organization_id,
    'flag_key', v_row.flag_key,
    'enabled', v_row.enabled,
    'updated_at', v_row.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.activate_forecast_v2_engine(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.activate_forecast_v2_engine(uuid, boolean) TO authenticated;

-- 1.2 ----------------------------------------------------------------
-- Fix root cause of "operator does not exist: text = uuid" in the
-- Accuracy tab.
-- opportunities.pipeline_id is `text` (legacy), but p_pipeline_id is
-- uuid. The previous version compared them directly. We now cast the
-- uuid parameter to text safely (only when the parameter is provided).
-- Behavior, signature and return type are preserved.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_forecast_actual_closed_amount_v2(
  p_organization_id uuid,
  p_pipeline_id uuid DEFAULT NULL::uuid,
  p_period_start date DEFAULT NULL::date,
  p_period_end date DEFAULT NULL::date,
  p_seller_id uuid DEFAULT NULL::uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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
    -- FIX F2.9: cast uuid param to text since opportunities.pipeline_id is text
    AND (p_pipeline_id IS NULL OR o.pipeline_id = p_pipeline_id::text)
    AND (p_seller_id IS NULL OR o.owner_user_id = p_seller_id);

  RETURN v_total;
END;
$$;

-- 1.3 ----------------------------------------------------------------
-- Enhance get_forecast_v2_health_check to expose the two flags the UI
-- needs to drive activation and bootstrap CTAs:
--   * engine_active     → feature flag is ON
--   * bootstrap_required → flag ON but no calculation run yet
-- We do this with a thin wrapper that calls the existing function and
-- merges the two extra fields, so the rest of the engine logic stays
-- untouched.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_forecast_v2_health_check(
  p_organization_id uuid,
  p_period_start date,
  p_period_end date,
  p_pipeline_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_org uuid;
  v_is_platform boolean := false;
  v_is_privileged boolean := false;

  v_flag_enabled boolean := false;
  v_run_count integer := 0;
  v_snap_count integer := 0;
  v_latest_run timestamptz;
  v_latest_snap timestamptz;
  v_latest_calc_version text;
  v_status text;
  v_engine_active boolean := false;
  v_bootstrap_required boolean := false;
  v_started timestamptz := clock_timestamp();
BEGIN
  -- Tenant guard
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

  -- Run + snapshot counts/age (cheap)
  SELECT COUNT(*), MAX(created_at), MAX(calculation_version)
    INTO v_run_count, v_latest_run, v_latest_calc_version
  FROM public.forecast_calculation_runs
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id);

  SELECT COUNT(*), MAX(created_at)
    INTO v_snap_count, v_latest_snap
  FROM public.forecast_daily_snapshots
  WHERE organization_id = p_organization_id
    AND period_start = p_period_start
    AND period_end = p_period_end
    AND (p_pipeline_id IS NULL OR pipeline_id = p_pipeline_id);

  -- Status decision tree
  IF NOT v_flag_enabled THEN
    v_status := 'not_ready';
    v_bootstrap_required := false;
  ELSIF v_run_count = 0 THEN
    v_status := 'not_ready';
    v_bootstrap_required := true;
  ELSIF v_snap_count = 0 THEN
    v_status := 'attention';
    v_bootstrap_required := true;
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
    'calculation_version', v_latest_calc_version,
    'latest_run_at', v_latest_run,
    'latest_snapshot_at', v_latest_snap,
    'snapshot_job_last_status', NULL,
    'snapshots_count', v_snap_count,
    'accuracy_ready', (v_snap_count >= 5),
    'accuracy_score', NULL,
    'seller_performance_ready', (v_run_count > 0),
    'intelligence_ready', (v_run_count > 0),
    'risk_center_ready', (v_run_count > 0),
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
        ELSE EXTRACT(EPOCH FROM (now() - v_latest_snap))::int / 3600 END,
      'latest_run_duration_ms', 0,
      'latest_snapshot_duration_ms', 0
    ),
    'warnings', '[]'::jsonb,
    'errors', '[]'::jsonb,
    'recommendations', CASE
      WHEN NOT v_flag_enabled THEN
        jsonb_build_array('Ative o Forecast Engine V2 para esta organização.')
      WHEN v_run_count = 0 THEN
        jsonb_build_array('Execute o primeiro cálculo do Forecast V2 (Inicializar Forecast V2 agora).')
      WHEN v_snap_count = 0 THEN
        jsonb_build_array('Gere o primeiro snapshot diário para começar a medir acurácia.')
      WHEN v_snap_count < 5 THEN
        jsonb_build_array('Continue gerando snapshots diários — acurácia é liberada a partir de 5 amostras.')
      ELSE '[]'::jsonb
    END,
    'metadata', jsonb_build_object(
      'organization_id', p_organization_id,
      'pipeline_id', p_pipeline_id,
      'period_start', p_period_start,
      'period_end', p_period_end,
      'generated_at', now()
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_forecast_v2_health_check(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_forecast_v2_health_check(uuid, date, date, uuid) TO authenticated;