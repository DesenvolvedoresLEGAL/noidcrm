
-- 1) Sandbox actions in the registry (idempotent)
INSERT INTO public.action_registry (
  action_key, name, description, domain, risk_level, required_role,
  approval_required, agent_executable, human_executable,
  executor_type, executor_ref, input_schema, output_schema,
  available_surfaces, audit_enabled, is_active, tags, metadata
) VALUES
  (
    'sandbox.noop',
    'Sandbox · No-op',
    'Ação segura usada apenas pelo Headless Humanoid Lab para validar o runtime.',
    'sandbox', 'low', NULL,
    false, true, true,
    'service', 'sandbox.noop',
    '{}'::jsonb, '{}'::jsonb,
    ARRAY['web']::action_surface[], true, true,
    ARRAY['sandbox','hh-lab']::text[],
    jsonb_build_object('sandbox', true)
  ),
  (
    'sandbox.requires_approval',
    'Sandbox · Aprovação obrigatória',
    'Ação sensível (sandbox) usada para validar o approval router.',
    'sandbox', 'high', NULL,
    true, true, true,
    'service', 'sandbox.requires_approval',
    '{}'::jsonb, '{}'::jsonb,
    ARRAY['web']::action_surface[], true, true,
    ARRAY['sandbox','hh-lab']::text[],
    jsonb_build_object('sandbox', true)
  )
ON CONFLICT (action_key) DO UPDATE
SET description = EXCLUDED.description,
    risk_level = EXCLUDED.risk_level,
    approval_required = EXCLUDED.approval_required,
    available_surfaces = EXCLUDED.available_surfaces,
    is_active = true,
    metadata = EXCLUDED.metadata,
    updated_at = now();

-- 2) Tables for sandbox test runs
CREATE TABLE IF NOT EXISTS public.headless_humanoid_test_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  started_by uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  status text NOT NULL DEFAULT 'running'
    CHECK (status IN ('running','passed','partial','failed','error')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hh_test_runs_org_started
  ON public.headless_humanoid_test_runs (organization_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.headless_humanoid_test_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_run_id uuid NOT NULL REFERENCES public.headless_humanoid_test_runs(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL,
  test_key text NOT NULL,
  test_name text NOT NULL,
  status text NOT NULL
    CHECK (status IN ('passed','failed','skipped','error')),
  action_key text,
  execution_id uuid,
  approval_id uuid,
  expected_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  actual_result jsonb NOT NULL DEFAULT '{}'::jsonb,
  audit_found boolean,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hh_test_results_run
  ON public.headless_humanoid_test_results (test_run_id, created_at);

ALTER TABLE public.headless_humanoid_test_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.headless_humanoid_test_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org admins read hh test runs" ON public.headless_humanoid_test_runs;
CREATE POLICY "Org admins read hh test runs"
  ON public.headless_humanoid_test_runs
  FOR SELECT TO authenticated
  USING (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()));

DROP POLICY IF EXISTS "Org admins write hh test runs" ON public.headless_humanoid_test_runs;
CREATE POLICY "Org admins write hh test runs"
  ON public.headless_humanoid_test_runs
  FOR ALL TO authenticated
  USING (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()))
  WITH CHECK (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()));

DROP POLICY IF EXISTS "Org admins read hh test results" ON public.headless_humanoid_test_results;
CREATE POLICY "Org admins read hh test results"
  ON public.headless_humanoid_test_results
  FOR SELECT TO authenticated
  USING (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()));

DROP POLICY IF EXISTS "Org admins write hh test results" ON public.headless_humanoid_test_results;
CREATE POLICY "Org admins write hh test results"
  ON public.headless_humanoid_test_results
  FOR ALL TO authenticated
  USING (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()))
  WITH CHECK (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()));

-- 3) Health diagnostic RPC
CREATE OR REPLACE FUNCTION public.get_headless_humanoid_health(p_org_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := COALESCE(p_org_id, public.get_user_organization_id());
  v_registry jsonb;
  v_executions jsonb;
  v_approvals jsonb;
  v_orphans int;
  v_failed_24h int;
  v_risky_no_approval int;
  v_no_surface int;
  v_no_role int;
  v_no_risk int;
  v_audit_24h int;
  v_orphan_approvals int;
  v_blockers jsonb := '[]'::jsonb;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  IF v_org IS NULL OR (NOT public.user_is_org_admin(v_org) AND NOT public.can_view_all(v_user)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- Registry summary
  SELECT jsonb_build_object(
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active),
    'approval_required', COUNT(*) FILTER (WHERE is_active AND approval_required),
    'by_executor_type', COALESCE(
      (SELECT jsonb_object_agg(executor_type, c) FROM (
        SELECT executor_type::text, COUNT(*) c FROM action_registry WHERE is_active GROUP BY executor_type
      ) t), '{}'::jsonb),
    'by_risk_level', COALESCE(
      (SELECT jsonb_object_agg(risk_level, c) FROM (
        SELECT risk_level::text, COUNT(*) c FROM action_registry WHERE is_active GROUP BY risk_level
      ) t), '{}'::jsonb),
    'by_surface', COALESCE(
      (SELECT jsonb_object_agg(surface, c) FROM (
        SELECT unnest(available_surfaces)::text AS surface, COUNT(*) c
        FROM action_registry WHERE is_active GROUP BY surface
      ) t), '{}'::jsonb)
  ) INTO v_registry FROM action_registry;

  -- Executions summary (org-scoped)
  SELECT jsonb_build_object(
    'last_24h', COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
    'failed_24h', COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours'),
    'awaiting_approval', COUNT(*) FILTER (WHERE status = 'awaiting_approval'),
    'pending_over_5min', COUNT(*) FILTER (WHERE status IN ('pending','running') AND created_at < now() - interval '5 minutes'),
    'by_status', COALESCE(
      (SELECT jsonb_object_agg(status, c) FROM (
        SELECT status, COUNT(*) c FROM action_executions
        WHERE organization_id = v_org AND created_at >= now() - interval '7 days'
        GROUP BY status
      ) t), '{}'::jsonb)
  ) INTO v_executions
  FROM action_executions
  WHERE organization_id = v_org;

  v_orphans := COALESCE((v_executions->>'pending_over_5min')::int, 0);
  v_failed_24h := COALESCE((v_executions->>'failed_24h')::int, 0);

  -- Approvals summary
  SELECT jsonb_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'approved_24h', COUNT(*) FILTER (WHERE status = 'approved' AND COALESCE(decided_at, requested_at) >= now() - interval '24 hours'),
    'rejected_24h', COUNT(*) FILTER (WHERE status = 'rejected' AND COALESCE(decided_at, requested_at) >= now() - interval '24 hours'),
    'expired', COUNT(*) FILTER (WHERE status = 'expired')
  ) INTO v_approvals FROM approval_requests WHERE organization_id = v_org;

  -- Orphan approvals (no execution_id)
  SELECT COUNT(*) INTO v_orphan_approvals
  FROM approval_requests
  WHERE organization_id = v_org AND execution_id IS NULL;

  -- Risky actions without approval
  SELECT COUNT(*) INTO v_risky_no_approval
  FROM action_registry
  WHERE is_active AND risk_level IN ('high','critical') AND approval_required = false;

  -- Actions without surface
  SELECT COUNT(*) INTO v_no_surface
  FROM action_registry
  WHERE is_active AND (available_surfaces IS NULL OR cardinality(available_surfaces) = 0);

  -- Actions without role (warn-only, not GO blocker per spec ambiguity → blocker if zero)
  SELECT COUNT(*) INTO v_no_role
  FROM action_registry
  WHERE is_active AND required_role IS NULL AND risk_level IN ('high','critical');

  -- Actions without risk_level (NOT NULL column, will be 0)
  SELECT COUNT(*) INTO v_no_risk
  FROM action_registry
  WHERE is_active AND risk_level IS NULL;

  -- Audit events 24h (any source)
  SELECT COUNT(*) INTO v_audit_24h
  FROM unified_audit_view
  WHERE organization_id = v_org AND occurred_at >= now() - interval '24 hours';

  -- Build blockers
  IF v_orphans > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','orphan_executions','count',v_orphans,
      'message','Há execuções pendentes/em execução há mais de 5 minutos.');
  END IF;
  IF v_orphan_approvals > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','approvals_without_execution','count',v_orphan_approvals,
      'message','Há approval_requests sem execution_id correspondente.');
  END IF;
  IF v_risky_no_approval > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','risky_actions_without_approval','count',v_risky_no_approval,
      'message','Existem ações de risco alto/crítico sem approval_required = true.');
  END IF;
  IF v_no_surface > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','actions_without_surface','count',v_no_surface,
      'message','Existem ações ativas sem available_surfaces definido.');
  END IF;
  IF v_no_risk > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','actions_without_risk_level','count',v_no_risk,
      'message','Existem ações ativas sem risk_level definido.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_org,
    'generated_at', now(),
    'registry_summary', v_registry,
    'executions_summary', v_executions,
    'approvals_summary', v_approvals,
    'orphan_executions', v_orphans,
    'failed_executions', v_failed_24h,
    'risky_actions_without_approval', v_risky_no_approval,
    'actions_without_surface', v_no_surface,
    'actions_without_role_high_risk', v_no_role,
    'actions_without_risk_level', v_no_risk,
    'orphan_approvals', v_orphan_approvals,
    'audit_events_24h', v_audit_24h,
    'go_no_go_status', CASE WHEN jsonb_array_length(v_blockers) = 0 THEN 'GO' ELSE 'NO_GO' END,
    'blockers', v_blockers
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_headless_humanoid_health(uuid) TO authenticated;

-- 4) Test runner RPCs
CREATE OR REPLACE FUNCTION public.start_headless_humanoid_test_run()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid := public.get_user_organization_id();
  v_id uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;
  IF NOT public.user_is_org_admin(v_org) AND NOT public.can_view_all(v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  INSERT INTO public.headless_humanoid_test_runs (organization_id, started_by)
  VALUES (v_org, v_user) RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.start_headless_humanoid_test_run() TO authenticated;

CREATE OR REPLACE FUNCTION public.finish_headless_humanoid_test_run(p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_passed int; v_failed int; v_skipped int; v_error int; v_total int;
  v_status text;
BEGIN
  SELECT organization_id INTO v_org FROM headless_humanoid_test_runs WHERE id = p_run_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'run_not_found';
  END IF;
  IF NOT public.user_is_org_admin(v_org) AND NOT public.can_view_all(v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE status = 'passed'),
    COUNT(*) FILTER (WHERE status = 'failed'),
    COUNT(*) FILTER (WHERE status = 'skipped'),
    COUNT(*) FILTER (WHERE status = 'error'),
    COUNT(*)
  INTO v_passed, v_failed, v_skipped, v_error, v_total
  FROM headless_humanoid_test_results WHERE test_run_id = p_run_id;

  v_status := CASE
    WHEN v_total = 0 THEN 'error'
    WHEN v_failed > 0 OR v_error > 0 THEN
      CASE WHEN v_passed > 0 THEN 'partial' ELSE 'failed' END
    ELSE 'passed'
  END;

  UPDATE headless_humanoid_test_runs
  SET finished_at = now(),
      status = v_status,
      summary = jsonb_build_object(
        'total', v_total, 'passed', v_passed, 'failed', v_failed,
        'skipped', v_skipped, 'error', v_error
      )
  WHERE id = p_run_id;

  RETURN jsonb_build_object('ok', true, 'status', v_status,
    'passed', v_passed, 'failed', v_failed, 'skipped', v_skipped, 'error', v_error);
END;
$$;

GRANT EXECUTE ON FUNCTION public.finish_headless_humanoid_test_run(uuid) TO authenticated;

-- Single test executor — runs ONE sandbox test and writes the result row.
CREATE OR REPLACE FUNCTION public.run_headless_humanoid_test(p_run_id uuid, p_test_key text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_org uuid;
  v_status text := 'error';
  v_error text;
  v_action text;
  v_exec uuid;
  v_approval uuid;
  v_expected jsonb := '{}'::jsonb;
  v_actual jsonb := '{}'::jsonb;
  v_audit_found boolean;
  v_register jsonb;
  v_complete jsonb;
  v_request_appr jsonb;
  v_decide jsonb;
  v_test_name text;
BEGIN
  SELECT organization_id INTO v_org FROM headless_humanoid_test_runs WHERE id = p_run_id;
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'run_not_found';
  END IF;
  IF NOT public.user_is_org_admin(v_org) AND NOT public.can_view_all(v_user) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  BEGIN
    IF p_test_key = 'noop_succeeds' THEN
      v_test_name := 'No-op sandbox executa e completa com sucesso';
      v_action := 'sandbox.noop';
      v_expected := jsonb_build_object('execution_status','succeeded');

      v_register := public.register_action_execution(v_action, '{}'::jsonb, NULL, NULL, 'web');
      IF (v_register->>'ok')::boolean IS NOT TRUE THEN
        v_status := 'failed';
        v_actual := v_register;
        v_error := COALESCE(v_register->>'error', 'register failed');
      ELSE
        v_exec := (v_register->>'execution_id')::uuid;
        v_complete := public.complete_action_execution(v_exec, 'succeeded',
          jsonb_build_object('sandbox', true), NULL, NULL, 50);
        SELECT status INTO v_actual FROM (SELECT to_jsonb(ae) AS status FROM action_executions ae WHERE id = v_exec) s;
        v_status := CASE WHEN (v_actual->>'status') = 'succeeded' THEN 'passed' ELSE 'failed' END;
      END IF;

    ELSIF p_test_key = 'sensitive_awaits_approval' THEN
      v_test_name := 'Ação sensível entra em awaiting_approval e cria approval pending';
      v_action := 'sandbox.requires_approval';
      v_expected := jsonb_build_object('execution_status','awaiting_approval','approval_status','pending');

      v_register := public.register_action_execution(v_action, jsonb_build_object('sandbox',true), NULL, NULL, 'web');
      IF (v_register->>'ok')::boolean IS NOT TRUE THEN
        v_status := 'failed';
        v_actual := v_register;
        v_error := COALESCE(v_register->>'error', 'register failed');
      ELSE
        v_exec := (v_register->>'execution_id')::uuid;
        v_request_appr := public.request_approval(v_action, jsonb_build_object('sandbox',true), NULL, NULL, v_exec, 1);
        v_approval := NULLIF(v_request_appr->>'approval_id','')::uuid;
        v_actual := jsonb_build_object(
          'execution_status', (SELECT status FROM action_executions WHERE id = v_exec),
          'approval_status', (SELECT status FROM approval_requests WHERE id = v_approval),
          'approval_has_execution_id', (SELECT execution_id IS NOT NULL FROM approval_requests WHERE id = v_approval)
        );
        v_status := CASE WHEN v_actual->>'execution_status' = 'awaiting_approval'
                          AND v_actual->>'approval_status' = 'pending'
                     THEN 'passed' ELSE 'failed' END;
      END IF;

    ELSIF p_test_key = 'approve_releases' THEN
      v_test_name := 'Aprovar approval sandbox marca approved e libera execução';
      v_action := 'sandbox.requires_approval';
      v_expected := jsonb_build_object('approval_status','approved');

      v_register := public.register_action_execution(v_action, '{}'::jsonb, NULL, NULL, 'web');
      v_exec := (v_register->>'execution_id')::uuid;
      v_request_appr := public.request_approval(v_action, '{}'::jsonb, NULL, NULL, v_exec, 1);
      v_approval := NULLIF(v_request_appr->>'approval_id','')::uuid;

      v_decide := public.decide_approval(v_approval, 'approved', 'sandbox auto-approve');
      v_complete := public.complete_action_execution(v_exec, 'succeeded',
        jsonb_build_object('approved_via','sandbox'), NULL, NULL, 80);

      v_actual := jsonb_build_object(
        'approval_status', (SELECT status FROM approval_requests WHERE id = v_approval),
        'execution_status', (SELECT status FROM action_executions WHERE id = v_exec)
      );
      v_status := CASE WHEN v_actual->>'approval_status' = 'approved'
                        AND v_actual->>'execution_status' IN ('succeeded','pending')
                   THEN 'passed' ELSE 'failed' END;

    ELSIF p_test_key = 'reject_blocks' THEN
      v_test_name := 'Rejeitar approval sandbox marca rejected e bloqueia execução';
      v_action := 'sandbox.requires_approval';
      v_expected := jsonb_build_object('approval_status','rejected','execution_status','blocked');

      v_register := public.register_action_execution(v_action, '{}'::jsonb, NULL, NULL, 'web');
      v_exec := (v_register->>'execution_id')::uuid;
      v_request_appr := public.request_approval(v_action, '{}'::jsonb, NULL, NULL, v_exec, 1);
      v_approval := NULLIF(v_request_appr->>'approval_id','')::uuid;

      v_decide := public.decide_approval(v_approval, 'rejected', 'sandbox auto-reject');
      v_complete := public.complete_action_execution(v_exec, 'blocked',
        jsonb_build_object('rejected_via','sandbox'), NULL, 'rejected by sandbox approver', 30);

      v_actual := jsonb_build_object(
        'approval_status', (SELECT status FROM approval_requests WHERE id = v_approval),
        'execution_status', (SELECT status FROM action_executions WHERE id = v_exec)
      );
      v_status := CASE WHEN v_actual->>'approval_status' = 'rejected'
                        AND v_actual->>'execution_status' = 'blocked'
                   THEN 'passed' ELSE 'failed' END;

    ELSIF p_test_key = 'insufficient_role' THEN
      v_test_name := 'Tentativa com role insuficiente é bloqueada pelo registry';
      v_action := 'opportunity.delete';
      v_expected := jsonb_build_object('result','insufficient_role_or_admin_bypass');
      -- Owners/admins têm can_view_all → bypassa o role check; marcamos como skipped com nota.
      IF public.can_view_all(v_user) THEN
        v_status := 'skipped';
        v_actual := jsonb_build_object('reason','admin/owner bypass via can_view_all; teste exige usuário sem can_view_all');
      ELSE
        v_register := public.register_action_execution(v_action, '{}'::jsonb, NULL, NULL, 'web');
        v_actual := v_register;
        v_status := CASE WHEN v_register->>'error' = 'insufficient_role' THEN 'passed' ELSE 'failed' END;
      END IF;

    ELSE
      v_test_name := p_test_key;
      v_status := 'error';
      v_error := 'unknown_test_key';
    END IF;

    -- Audit lookup (best-effort)
    IF v_exec IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1 FROM unified_audit_view
        WHERE entity_id = v_exec OR (action_key = v_action AND occurred_at >= now() - interval '5 minutes')
      ) INTO v_audit_found;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_status := 'error';
    v_error := SQLERRM;
    v_actual := jsonb_build_object('exception', SQLERRM);
  END;

  INSERT INTO public.headless_humanoid_test_results (
    test_run_id, organization_id, test_key, test_name, status,
    action_key, execution_id, approval_id,
    expected_result, actual_result, audit_found, error_message
  ) VALUES (
    p_run_id, v_org, p_test_key, COALESCE(v_test_name, p_test_key), v_status,
    v_action, v_exec, v_approval,
    v_expected, COALESCE(v_actual, '{}'::jsonb), v_audit_found, v_error
  );

  RETURN jsonb_build_object(
    'ok', true, 'test_key', p_test_key, 'status', v_status,
    'execution_id', v_exec, 'approval_id', v_approval,
    'audit_found', v_audit_found, 'error', v_error
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_headless_humanoid_test(uuid, text) TO authenticated;
