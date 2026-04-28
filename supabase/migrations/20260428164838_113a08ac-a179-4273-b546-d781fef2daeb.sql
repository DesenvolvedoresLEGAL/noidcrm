-- =====================================================================
-- SPRINT 6.3: Piloto Controlado do Dashboard Closer + Pace Diário
-- =====================================================================

-- 1) Tabela de auditoria do piloto
CREATE TABLE IF NOT EXISTS public.crm_dynamic_dashboard_pilot_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  action text NOT NULL CHECK (action IN (
    'enable_pilot','disable_user_pilot','disable_tenant_dynamic_dashboard','rollback'
  )),
  previous_global_flag boolean,
  new_global_flag boolean,
  previous_user_flag boolean,
  new_user_flag boolean,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pilot_logs_tenant_created
  ON public.crm_dynamic_dashboard_pilot_logs (tenant_id, created_at DESC);

ALTER TABLE public.crm_dynamic_dashboard_pilot_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners/Admins can read pilot logs"
  ON public.crm_dynamic_dashboard_pilot_logs;
CREATE POLICY "Owners/Admins can read pilot logs"
  ON public.crm_dynamic_dashboard_pilot_logs
  FOR SELECT
  TO authenticated
  USING (public.is_tenant_admin_or_owner(tenant_id));

-- INSERT/UPDATE/DELETE only via SECURITY DEFINER RPCs (no client policy)

-- =====================================================================
-- 2) RPC: enable_closer_dashboard_pilot
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_enable_closer_dashboard_pilot(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_bf_key text;
  v_perm_key text;
  v_dept_key text;
  v_requires_review boolean;
  v_member_active boolean;
  v_prev_global boolean;
  v_prev_user boolean;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT public.is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins can enable pilot';
  END IF;

  -- Target must belong to tenant and be active
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_tenant_id
      AND om.user_id = p_target_user_id
      AND om.status = 'active'
  ) INTO v_member_active;

  IF NOT v_member_active THEN
    RAISE EXCEPTION 'target user is not active in this tenant';
  END IF;

  -- Read context
  SELECT business_function_key, permission_key, department_key,
         COALESCE((metadata->>'requires_review')::boolean, false),
         COALESCE(is_dashboard_dynamic_enabled, false)
    INTO v_bf_key, v_perm_key, v_dept_key, v_requires_review, v_prev_user
  FROM public.crm_user_context_view
  WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id
  LIMIT 1;

  IF v_bf_key IS NULL OR v_perm_key IS NULL OR v_dept_key IS NULL THEN
    RAISE EXCEPTION 'incomplete user context (permission/department/function required)';
  END IF;

  IF v_bf_key <> 'closer' THEN
    RAISE EXCEPTION 'pilot only allowed for closer business function';
  END IF;

  IF v_requires_review THEN
    RAISE EXCEPTION 'user context requires review before enabling pilot';
  END IF;

  -- Previous global flag
  SELECT COALESCE(enabled, false) INTO v_prev_global
  FROM public.crm_feature_flags
  WHERE tenant_id = p_tenant_id AND key = 'dynamic_dashboards_enabled'
  LIMIT 1;
  v_prev_global := COALESCE(v_prev_global, false);

  -- Update user context flag
  UPDATE public.crm_user_contexts
     SET is_dashboard_dynamic_enabled = true,
         updated_at = now()
   WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id;

  -- Upsert tenant global flag
  INSERT INTO public.crm_feature_flags (tenant_id, key, enabled, updated_at)
  VALUES (p_tenant_id, 'dynamic_dashboards_enabled', true, now())
  ON CONFLICT (tenant_id, key)
  DO UPDATE SET enabled = true, updated_at = now();

  -- Audit log
  INSERT INTO public.crm_dynamic_dashboard_pilot_logs (
    tenant_id, target_user_id, changed_by, action,
    previous_global_flag, new_global_flag,
    previous_user_flag, new_user_flag, reason, metadata
  ) VALUES (
    p_tenant_id, p_target_user_id, v_caller, 'enable_pilot',
    v_prev_global, true,
    v_prev_user, true, p_reason,
    jsonb_build_object('sprint','6.3','business_function_key', v_bf_key)
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'flags', jsonb_build_object(
      'global_dynamic_dashboards', true,
      'user_is_dashboard_dynamic_enabled', true
    ),
    'rollback_hint', 'Use crm_disable_closer_dashboard_pilot or crm_disable_tenant_dynamic_dashboards to revert immediately.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_enable_closer_dashboard_pilot(uuid, uuid, text) TO authenticated;

-- =====================================================================
-- 3) RPC: disable_closer_dashboard_pilot (per user)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_disable_closer_dashboard_pilot(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_prev_user boolean;
  v_prev_global boolean;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT public.is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins';
  END IF;

  SELECT COALESCE(is_dashboard_dynamic_enabled, false) INTO v_prev_user
  FROM public.crm_user_contexts
  WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id;

  SELECT COALESCE(enabled, false) INTO v_prev_global
  FROM public.crm_feature_flags
  WHERE tenant_id = p_tenant_id AND key = 'dynamic_dashboards_enabled';

  UPDATE public.crm_user_contexts
     SET is_dashboard_dynamic_enabled = false,
         updated_at = now()
   WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id;

  INSERT INTO public.crm_dynamic_dashboard_pilot_logs (
    tenant_id, target_user_id, changed_by, action,
    previous_global_flag, new_global_flag,
    previous_user_flag, new_user_flag, reason, metadata
  ) VALUES (
    p_tenant_id, p_target_user_id, v_caller, 'disable_user_pilot',
    COALESCE(v_prev_global,false), COALESCE(v_prev_global,false),
    COALESCE(v_prev_user,false), false, p_reason,
    jsonb_build_object('sprint','6.3')
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'user_flag', false,
    'global_flag_unchanged', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_disable_closer_dashboard_pilot(uuid, uuid, text) TO authenticated;

-- =====================================================================
-- 4) RPC: disable_tenant_dynamic_dashboards
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_disable_tenant_dynamic_dashboards(
  p_tenant_id uuid,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_prev_global boolean;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins';
  END IF;

  SELECT COALESCE(enabled, false) INTO v_prev_global
  FROM public.crm_feature_flags
  WHERE tenant_id = p_tenant_id AND key = 'dynamic_dashboards_enabled';

  INSERT INTO public.crm_feature_flags (tenant_id, key, enabled, updated_at)
  VALUES (p_tenant_id, 'dynamic_dashboards_enabled', false, now())
  ON CONFLICT (tenant_id, key)
  DO UPDATE SET enabled = false, updated_at = now();

  INSERT INTO public.crm_dynamic_dashboard_pilot_logs (
    tenant_id, target_user_id, changed_by, action,
    previous_global_flag, new_global_flag,
    previous_user_flag, new_user_flag, reason, metadata
  ) VALUES (
    p_tenant_id, v_caller, v_caller, 'disable_tenant_dynamic_dashboard',
    COALESCE(v_prev_global,false), false,
    NULL, NULL, p_reason,
    jsonb_build_object('sprint','6.3','scope','tenant')
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'global_flag', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_disable_tenant_dynamic_dashboards(uuid, text) TO authenticated;

-- =====================================================================
-- 5) RPC: crm_get_closer_pace_data
--    Pace diário SEMPRE para o mês corrente, independente do filtro.
-- =====================================================================
CREATE OR REPLACE FUNCTION public.crm_get_closer_pace_data(
  p_tenant_id uuid,
  p_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_in_tenant boolean;
  v_caller_is_admin boolean := false;
  v_today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
  v_month_start date := date_trunc('month', v_today)::date;
  v_month_end date := (date_trunc('month', v_today) + interval '1 month - 1 day')::date;
  v_goal numeric;
  v_goal_source text := 'sales_goals';
  v_realized numeric := 0;
  v_total int := 0;
  v_elapsed int := 0;
  v_remaining int := 0;
  v_d date;
  v_expected numeric;
  v_gap numeric;
  v_remaining_to_goal numeric;
  v_required_daily numeric;
  v_current_avg numeric;
  v_pace_pct numeric;
  v_status text;
  v_severity text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_tenant_id AND om.user_id = v_caller
      AND COALESCE(om.is_active,true) = true
  ) INTO v_caller_in_tenant;
  IF NOT v_caller_in_tenant THEN RAISE EXCEPTION 'forbidden_tenant'; END IF;

  BEGIN
    v_caller_is_admin := public.user_is_org_admin(p_tenant_id);
  EXCEPTION WHEN OTHERS THEN v_caller_is_admin := false;
  END;

  IF v_caller <> p_user_id AND NOT v_caller_is_admin THEN
    RAISE EXCEPTION 'forbidden_target';
  END IF;

  -- Goal: sales_goals -> seller_targets -> ote_seller_configs/ote_levels
  SELECT target_value INTO v_goal
  FROM public.sales_goals
  WHERE organization_id = p_tenant_id
    AND user_id = p_user_id
    AND period_type = 'monthly'
    AND v_today BETWEEN period_start AND period_end
  ORDER BY updated_at DESC LIMIT 1;

  IF v_goal IS NULL THEN
    SELECT monthly_revenue_target INTO v_goal
    FROM public.seller_targets
    WHERE organization_id = p_tenant_id
      AND user_id = p_user_id
      AND date_trunc('month', period_month) = date_trunc('month', now())
    ORDER BY updated_at DESC LIMIT 1;
    IF v_goal IS NOT NULL THEN v_goal_source := 'seller_targets'; END IF;
  END IF;

  IF v_goal IS NULL THEN
    -- Try OTE configs
    BEGIN
      SELECT COALESCE(osc.custom_goal_override, ol.monthly_goal)
        INTO v_goal
      FROM public.ote_seller_configs osc
      LEFT JOIN public.ote_levels ol ON ol.id = osc.ote_level_id
      WHERE osc.organization_id = p_tenant_id
        AND osc.user_id = p_user_id
      ORDER BY osc.updated_at DESC LIMIT 1;
      IF v_goal IS NOT NULL THEN v_goal_source := 'ote_config'; END IF;
    EXCEPTION WHEN OTHERS THEN
      -- tables may not exist in some environments
      NULL;
    END;
  END IF;

  -- Business days (Mon-Fri, no holidays v1)
  FOR v_d IN SELECT generate_series(v_month_start, v_month_end, '1 day'::interval)::date LOOP
    IF EXTRACT(ISODOW FROM v_d) < 6 THEN
      v_total := v_total + 1;
      IF v_d <= v_today THEN v_elapsed := v_elapsed + 1; END IF;
    END IF;
  END LOOP;
  v_remaining := GREATEST(v_total - v_elapsed, 0);

  -- Realized this month (won via closed_at)
  SELECT COALESCE(SUM(valor_previsto), 0) INTO v_realized
  FROM public.opportunities
  WHERE organization_id = p_tenant_id
    AND owner_user_id = p_user_id
    AND status = 'won'
    AND deleted_at IS NULL
    AND closed_at >= v_month_start::timestamptz
    AND closed_at < (v_month_end + 1)::timestamptz;

  -- Unavailable scenarios
  IF v_goal IS NULL OR v_goal <= 0 OR v_total = 0 THEN
    RETURN jsonb_build_object(
      'available', false,
      'reason', 'Meta mensal não configurada para este Closer.',
      'status', 'Meta não configurada',
      'severity', 'warning',
      'business_days_rule', 'monday_to_friday_no_holidays_v1',
      'pace_uses_current_month', true,
      'goal_source', v_goal_source
    );
  END IF;

  v_expected := v_goal::numeric / v_total * v_elapsed;
  v_gap := v_realized - v_expected;
  v_remaining_to_goal := GREATEST(v_goal - v_realized, 0);
  IF v_remaining > 0 THEN
    v_required_daily := v_remaining_to_goal / v_remaining;
  ELSE
    v_required_daily := v_remaining_to_goal;
  END IF;
  v_current_avg := v_realized / GREATEST(v_elapsed, 1);
  IF v_expected > 0 THEN
    v_pace_pct := (v_realized / v_expected) * 100;
  ELSE
    v_pace_pct := 100;
  END IF;

  IF v_pace_pct >= 105 THEN
    v_status := 'Acima do pace'; v_severity := 'success';
  ELSIF v_pace_pct >= 95 THEN
    v_status := 'No pace'; v_severity := 'info';
  ELSIF v_pace_pct >= 75 THEN
    v_status := 'Atrasado'; v_severity := 'attention';
  ELSE
    v_status := 'Crítico'; v_severity := 'critical';
  END IF;

  RETURN jsonb_build_object(
    'available', true,
    'goal_value', v_goal,
    'realized_value', v_realized,
    'goal_attainment_percent', ROUND((v_realized / v_goal) * 100, 2),
    'business_days_total', v_total,
    'business_days_elapsed', v_elapsed,
    'business_days_remaining', v_remaining,
    'expected_pace_today', ROUND(v_expected, 2),
    'pace_gap_value', ROUND(v_gap, 2),
    'remaining_to_goal', ROUND(v_remaining_to_goal, 2),
    'required_daily_rate', ROUND(v_required_daily, 2),
    'current_daily_average', ROUND(v_current_avg, 2),
    'pace_percent', ROUND(v_pace_pct, 2),
    'status', v_status,
    'severity', v_severity,
    'business_days_rule', 'monday_to_friday_no_holidays_v1',
    'pace_uses_current_month', true,
    'goal_source', v_goal_source,
    'why_here', 'Com base na meta mensal, dias úteis corridos e vendas realizadas até hoje.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_get_closer_pace_data(uuid, uuid) TO authenticated;