-- =====================================================================
-- SPRINT 6.5: Observabilidade, Feedback e Rollout Controlado (até 3 Closers)
-- =====================================================================

-- 1) Atualizar constraint de "action" no log de piloto
ALTER TABLE public.crm_dynamic_dashboard_pilot_logs
  DROP CONSTRAINT IF EXISTS crm_dynamic_dashboard_pilot_logs_action_check;

ALTER TABLE public.crm_dynamic_dashboard_pilot_logs
  ADD CONSTRAINT crm_dynamic_dashboard_pilot_logs_action_check
  CHECK (action IN (
    'enable_pilot',
    'disable_user_pilot',
    'disable_tenant_dynamic_dashboard',
    'rollback',
    'bulk_disable_closer_pilots'
  ));

-- 2) Tabela de feedback
CREATE TABLE IF NOT EXISTS public.crm_dynamic_dashboard_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dashboard_type text NOT NULL,
  rating int NOT NULL,
  is_useful boolean,
  is_confusing boolean,
  is_slow boolean,
  missing_info text,
  comment text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_dynamic_dashboard_feedback_dashboard_type_valid CHECK (
    dashboard_type IN ('closer')
  ),
  CONSTRAINT crm_dynamic_dashboard_feedback_rating_valid CHECK (
    rating >= 1 AND rating <= 5
  )
);

CREATE INDEX IF NOT EXISTS idx_crm_dynamic_dashboard_feedback_tenant_user_created
  ON public.crm_dynamic_dashboard_feedback (tenant_id, user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_dynamic_dashboard_feedback_tenant_created
  ON public.crm_dynamic_dashboard_feedback (tenant_id, created_at DESC);

ALTER TABLE public.crm_dynamic_dashboard_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can insert own dynamic dashboard feedback"
  ON public.crm_dynamic_dashboard_feedback;
CREATE POLICY "users can insert own dynamic dashboard feedback"
  ON public.crm_dynamic_dashboard_feedback
  FOR INSERT
  WITH CHECK (
    public.user_belongs_to_tenant(tenant_id)
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "admins and owners can read dynamic dashboard feedback"
  ON public.crm_dynamic_dashboard_feedback;
CREATE POLICY "admins and owners can read dynamic dashboard feedback"
  ON public.crm_dynamic_dashboard_feedback
  FOR SELECT
  USING (
    public.is_tenant_admin_or_owner(tenant_id)
    OR user_id = auth.uid()
  );

-- 3) RPC: submit feedback
CREATE OR REPLACE FUNCTION public.crm_submit_dynamic_dashboard_feedback(
  p_tenant_id uuid,
  p_dashboard_type text,
  p_rating int,
  p_is_useful boolean DEFAULT NULL,
  p_is_confusing boolean DEFAULT NULL,
  p_is_slow boolean DEFAULT NULL,
  p_missing_info text DEFAULT NULL,
  p_comment text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_bf_key text;
  v_feedback_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT public.user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: user does not belong to tenant';
  END IF;

  IF p_dashboard_type IS DISTINCT FROM 'closer' THEN
    RAISE EXCEPTION 'invalid dashboard_type: only closer is supported in this sprint';
  END IF;

  IF p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'rating must be between 1 and 5';
  END IF;

  SELECT business_function_key INTO v_bf_key
  FROM public.crm_user_context_view
  WHERE tenant_id = p_tenant_id AND user_id = v_caller
  LIMIT 1;

  IF v_bf_key IS DISTINCT FROM 'closer' THEN
    RAISE EXCEPTION 'feedback restricted to users with business_function_key = closer';
  END IF;

  INSERT INTO public.crm_dynamic_dashboard_feedback (
    tenant_id, user_id, dashboard_type, rating,
    is_useful, is_confusing, is_slow,
    missing_info, comment, metadata
  ) VALUES (
    p_tenant_id, v_caller, p_dashboard_type, p_rating,
    p_is_useful, p_is_confusing, p_is_slow,
    LEFT(COALESCE(p_missing_info, ''), 500),
    LEFT(COALESCE(p_comment, ''), 1000),
    COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_feedback_id;

  RETURN jsonb_build_object(
    'success', true,
    'feedback_id', v_feedback_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_submit_dynamic_dashboard_feedback(uuid, text, int, boolean, boolean, boolean, text, text, jsonb) TO authenticated;

-- 4) RPC: rollback em massa de Closers
CREATE OR REPLACE FUNCTION public.crm_disable_all_closer_dashboard_pilots(
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
  v_disabled int := 0;
  v_user record;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;
  IF NOT public.is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins';
  END IF;

  FOR v_user IN
    SELECT v.user_id
    FROM public.crm_user_context_view v
    WHERE v.tenant_id = p_tenant_id
      AND v.business_function_key = 'closer'
      AND COALESCE(v.is_dashboard_dynamic_enabled, false) = true
  LOOP
    UPDATE public.crm_user_contexts
       SET is_dashboard_dynamic_enabled = false,
           updated_at = now()
     WHERE tenant_id = p_tenant_id AND user_id = v_user.user_id;

    INSERT INTO public.crm_dynamic_dashboard_pilot_logs (
      tenant_id, target_user_id, changed_by, action,
      previous_global_flag, new_global_flag,
      previous_user_flag, new_user_flag, reason, metadata
    ) VALUES (
      p_tenant_id, v_user.user_id, v_caller, 'bulk_disable_closer_pilots',
      NULL, NULL, true, false, p_reason,
      jsonb_build_object('sprint','6.5','source','bulk_rollback')
    );

    v_disabled := v_disabled + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'disabled_count', v_disabled
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_disable_all_closer_dashboard_pilots(uuid, text) TO authenticated;

-- 5) Atualizar enable_closer_dashboard_pilot para enforçar limite de 3
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
  v_member_active boolean;
  v_bf_key text;
  v_perm_key text;
  v_dept_key text;
  v_requires_review boolean;
  v_prev_user boolean;
  v_prev_global boolean;
  v_active_count int;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  IF NOT public.is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins can enable pilot';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = p_tenant_id
      AND om.user_id = p_target_user_id
      AND om.status = 'active'
  ) INTO v_member_active;

  IF NOT v_member_active THEN
    RAISE EXCEPTION 'target user is not active in this tenant';
  END IF;

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

  -- Já habilitado: idempotente
  IF v_prev_user THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_enabled', true,
      'tenant_id', p_tenant_id,
      'target_user_id', p_target_user_id
    );
  END IF;

  -- Sprint 6.5: limite de 3 Closers pilotos ativos por tenant
  SELECT COUNT(*) INTO v_active_count
  FROM public.crm_user_context_view
  WHERE tenant_id = p_tenant_id
    AND business_function_key = 'closer'
    AND COALESCE(is_dashboard_dynamic_enabled, false) = true;

  IF v_active_count >= 3 THEN
    RAISE EXCEPTION 'pilot_limit_reached: max 3 closer pilots per tenant';
  END IF;

  SELECT COALESCE(enabled, false) INTO v_prev_global
  FROM public.crm_feature_flags
  WHERE tenant_id = p_tenant_id AND key = 'dynamic_dashboards_enabled'
  LIMIT 1;
  v_prev_global := COALESCE(v_prev_global, false);

  UPDATE public.crm_user_contexts
     SET is_dashboard_dynamic_enabled = true,
         updated_at = now()
   WHERE tenant_id = p_tenant_id AND user_id = p_target_user_id;

  INSERT INTO public.crm_feature_flags (tenant_id, key, enabled, updated_at)
  VALUES (p_tenant_id, 'dynamic_dashboards_enabled', true, now())
  ON CONFLICT (tenant_id, key)
  DO UPDATE SET enabled = true, updated_at = now();

  INSERT INTO public.crm_dynamic_dashboard_pilot_logs (
    tenant_id, target_user_id, changed_by, action,
    previous_global_flag, new_global_flag,
    previous_user_flag, new_user_flag, reason, metadata
  ) VALUES (
    p_tenant_id, p_target_user_id, v_caller, 'enable_pilot',
    v_prev_global, true,
    v_prev_user, true, p_reason,
    jsonb_build_object('sprint','6.5','business_function_key', v_bf_key, 'active_count_after', v_active_count + 1)
  );

  RETURN jsonb_build_object(
    'success', true,
    'tenant_id', p_tenant_id,
    'target_user_id', p_target_user_id,
    'active_count', v_active_count + 1,
    'flags', jsonb_build_object(
      'global_dynamic_dashboards', true,
      'user_is_dashboard_dynamic_enabled', true
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_enable_closer_dashboard_pilot(uuid, uuid, text) TO authenticated;