
-- Sprint HH 0.5.1 — Governance fix for Headless Humanoid Lab

-- 1) Lock down sensitive actions
UPDATE public.action_registry
SET approval_required = true,
    risk_level = 'high',
    available_surfaces = COALESCE(available_surfaces, ARRAY['web']::action_surface[]),
    updated_at = now()
WHERE action_key IN ('opportunity.mark_won','proposal.accept_internally');

-- 2) Recreate health RPC with allowlist + current_blockers + legacy_warnings
--    + list of risky action_keys.
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
  v_risky_action_keys jsonb;
  v_no_surface int;
  v_no_role int;
  v_no_risk int;
  v_audit_24h int;
  v_orphan_approvals_new int;
  v_orphan_approvals_legacy int;
  v_legacy_ai_queue int;
  v_blockers jsonb := '[]'::jsonb;
  v_warnings jsonb := '[]'::jsonb;
  -- Lab install boundary; everything before is treated as legacy.
  v_lab_install timestamptz := '2026-05-09 16:49:26+00';
  -- Safe allowlist: actions explicitly allowed to be high/critical without approval.
  v_allowlist text[] := ARRAY['sandbox.noop'];
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
    'by_executor_type', COALESCE((SELECT jsonb_object_agg(executor_type, c) FROM (
        SELECT executor_type::text, COUNT(*) c FROM action_registry WHERE is_active GROUP BY executor_type) t), '{}'::jsonb),
    'by_risk_level', COALESCE((SELECT jsonb_object_agg(risk_level, c) FROM (
        SELECT risk_level::text, COUNT(*) c FROM action_registry WHERE is_active GROUP BY risk_level) t), '{}'::jsonb),
    'by_surface', COALESCE((SELECT jsonb_object_agg(surface, c) FROM (
        SELECT unnest(available_surfaces)::text AS surface, COUNT(*) c
        FROM action_registry WHERE is_active GROUP BY surface) t), '{}'::jsonb)
  ) INTO v_registry FROM action_registry;

  -- Executions
  SELECT jsonb_build_object(
    'last_24h', COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours'),
    'failed_24h', COUNT(*) FILTER (WHERE status = 'failed' AND created_at >= now() - interval '24 hours'),
    'awaiting_approval', COUNT(*) FILTER (WHERE status = 'awaiting_approval'),
    'pending_over_5min', COUNT(*) FILTER (WHERE status IN ('pending','running') AND created_at < now() - interval '5 minutes'),
    'by_status', COALESCE((SELECT jsonb_object_agg(status, c) FROM (
        SELECT status, COUNT(*) c FROM action_executions
        WHERE organization_id = v_org AND created_at >= now() - interval '7 days'
        GROUP BY status) t), '{}'::jsonb)
  ) INTO v_executions
  FROM action_executions WHERE organization_id = v_org;

  v_orphans := COALESCE((v_executions->>'pending_over_5min')::int, 0);
  v_failed_24h := COALESCE((v_executions->>'failed_24h')::int, 0);

  -- Approvals
  SELECT jsonb_build_object(
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'approved_24h', COUNT(*) FILTER (WHERE status = 'approved' AND COALESCE(decided_at, requested_at) >= now() - interval '24 hours'),
    'rejected_24h', COUNT(*) FILTER (WHERE status = 'rejected' AND COALESCE(decided_at, requested_at) >= now() - interval '24 hours'),
    'expired', COUNT(*) FILTER (WHERE status = 'expired')
  ) INTO v_approvals FROM approval_requests WHERE organization_id = v_org;

  -- Orphan approvals split: post-Lab = blocker, pre-Lab = legacy warning
  SELECT
    COUNT(*) FILTER (WHERE requested_at >= v_lab_install),
    COUNT(*) FILTER (WHERE requested_at <  v_lab_install)
  INTO v_orphan_approvals_new, v_orphan_approvals_legacy
  FROM approval_requests
  WHERE organization_id = v_org AND execution_id IS NULL;

  -- Legacy AI agent queue (parallel system, not headless humanoid)
  SELECT COUNT(*) INTO v_legacy_ai_queue
  FROM ai_agent_approval_queue WHERE organization_id = v_org;

  -- Risky actions without approval, excluding allowlist
  SELECT COUNT(*), COALESCE(jsonb_agg(action_key ORDER BY action_key), '[]'::jsonb)
  INTO v_risky_no_approval, v_risky_action_keys
  FROM action_registry
  WHERE is_active
    AND risk_level IN ('high','critical')
    AND COALESCE(approval_required, false) = false
    AND NOT (action_key = ANY(v_allowlist));

  SELECT COUNT(*) INTO v_no_surface
  FROM action_registry WHERE is_active AND (available_surfaces IS NULL OR cardinality(available_surfaces) = 0);

  SELECT COUNT(*) INTO v_no_role
  FROM action_registry WHERE is_active AND required_role IS NULL AND risk_level IN ('high','critical');

  SELECT COUNT(*) INTO v_no_risk
  FROM action_registry WHERE is_active AND risk_level IS NULL;

  SELECT COUNT(*) INTO v_audit_24h
  FROM unified_audit_view WHERE organization_id = v_org AND occurred_at >= now() - interval '24 hours';

  -- CURRENT BLOCKERS
  IF v_orphans > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','orphan_executions','count',v_orphans,
      'message','Há execuções pendentes/em execução há mais de 5 minutos.');
  END IF;
  IF v_orphan_approvals_new > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','approvals_without_execution','count',v_orphan_approvals_new,
      'message','Aprovações novas (pós-Lab) sem execution_id.');
  END IF;
  IF v_risky_no_approval > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','risky_actions_without_approval','count',v_risky_no_approval,
      'message','Ações de risco alto/crítico sem approval_required = true.',
      'action_keys', v_risky_action_keys);
  END IF;
  IF v_no_surface > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','actions_without_surface','count',v_no_surface,
      'message','Existem ações ativas sem available_surfaces definido.');
  END IF;
  IF v_no_risk > 0 THEN
    v_blockers := v_blockers || jsonb_build_object('code','actions_without_risk_level','count',v_no_risk,
      'message','Existem ações ativas sem risk_level definido.');
  END IF;

  -- LEGACY WARNINGS (not blockers)
  IF v_orphan_approvals_legacy > 0 THEN
    v_warnings := v_warnings || jsonb_build_object('code','legacy_approvals_without_execution',
      'count', v_orphan_approvals_legacy,
      'message','Aprovações antigas (pré-Lab) sem execution_id. Saneamento opcional.');
  END IF;
  IF v_legacy_ai_queue > 0 THEN
    v_warnings := v_warnings || jsonb_build_object('code','legacy_ai_agent_queue',
      'count', v_legacy_ai_queue,
      'message','Fila legada ai_agent_approval_queue (sistema paralelo, não governado pelo HH Lab).');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'organization_id', v_org,
    'generated_at', now(),
    'lab_install_at', v_lab_install,
    'safe_allowlist', to_jsonb(v_allowlist),
    'registry_summary', v_registry,
    'executions_summary', v_executions,
    'approvals_summary', v_approvals,
    'orphan_executions', v_orphans,
    'failed_executions', v_failed_24h,
    'risky_actions_without_approval', v_risky_no_approval,
    'risky_action_keys', v_risky_action_keys,
    'actions_without_surface', v_no_surface,
    'actions_without_role_high_risk', v_no_role,
    'actions_without_risk_level', v_no_risk,
    'orphan_approvals', v_orphan_approvals_new + v_orphan_approvals_legacy,
    'orphan_approvals_new', v_orphan_approvals_new,
    'orphan_approvals_legacy', v_orphan_approvals_legacy,
    'legacy_ai_agent_queue', v_legacy_ai_queue,
    'audit_events_24h', v_audit_24h,
    'go_no_go_status', CASE WHEN jsonb_array_length(v_blockers) = 0 THEN 'GO' ELSE 'NO_GO' END,
    'blockers', v_blockers,
    'current_blockers', v_blockers,
    'legacy_warnings', v_warnings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_headless_humanoid_health(uuid) TO authenticated;

-- 3) Extend test runner with governance tests 6/7/8.
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
  v_count int;
  v_keys jsonb;
  v_appr_required boolean;
  v_allowlist text[] := ARRAY['sandbox.noop'];
BEGIN
  SELECT organization_id INTO v_org FROM headless_humanoid_test_runs WHERE id = p_run_id;
  IF v_org IS NULL THEN RAISE EXCEPTION 'run_not_found'; END IF;
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
        v_status := 'failed'; v_actual := v_register; v_error := COALESCE(v_register->>'error', 'register failed');
      ELSE
        v_exec := (v_register->>'execution_id')::uuid;
        v_complete := public.complete_action_execution(v_exec, 'succeeded',
          jsonb_build_object('sandbox', true), NULL, NULL, 50);
        SELECT to_jsonb(ae) INTO v_actual FROM action_executions ae WHERE id = v_exec;
        v_status := CASE WHEN (v_actual->>'status') = 'succeeded' THEN 'passed' ELSE 'failed' END;
      END IF;

    ELSIF p_test_key = 'sensitive_awaits_approval' THEN
      v_test_name := 'Ação sensível entra em awaiting_approval e cria approval pending';
      v_action := 'sandbox.requires_approval';
      v_expected := jsonb_build_object('execution_status','awaiting_approval','approval_status','pending');
      v_register := public.register_action_execution(v_action, jsonb_build_object('sandbox',true), NULL, NULL, 'web');
      IF (v_register->>'ok')::boolean IS NOT TRUE THEN
        v_status := 'failed'; v_actual := v_register; v_error := COALESCE(v_register->>'error', 'register failed');
      ELSE
        v_exec := (v_register->>'execution_id')::uuid;
        v_request_appr := public.request_approval(v_action, jsonb_build_object('sandbox',true), NULL, NULL, v_exec, 1);
        v_approval := NULLIF(v_request_appr->>'approval_id','')::uuid;
        v_actual := jsonb_build_object(
          'execution_status', (SELECT status FROM action_executions WHERE id = v_exec),
          'approval_status', (SELECT status FROM approval_requests WHERE id = v_approval),
          'approval_has_execution_id', (SELECT execution_id IS NOT NULL FROM approval_requests WHERE id = v_approval));
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
        'execution_status', (SELECT status FROM action_executions WHERE id = v_exec));
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
        'execution_status', (SELECT status FROM action_executions WHERE id = v_exec));
      v_status := CASE WHEN v_actual->>'approval_status' = 'rejected'
                        AND v_actual->>'execution_status' = 'blocked'
                   THEN 'passed' ELSE 'failed' END;

    ELSIF p_test_key = 'insufficient_role' THEN
      v_test_name := 'Tentativa com role insuficiente é bloqueada pelo registry';
      v_action := 'opportunity.delete';
      v_expected := jsonb_build_object('result','insufficient_role_or_admin_bypass');
      IF public.can_view_all(v_user) THEN
        v_status := 'skipped';
        v_actual := jsonb_build_object('reason','admin/owner bypass via can_view_all; teste exige usuário sem can_view_all');
      ELSE
        v_register := public.register_action_execution(v_action, '{}'::jsonb, NULL, NULL, 'web');
        v_actual := v_register;
        v_status := CASE WHEN v_register->>'error' = 'insufficient_role' THEN 'passed' ELSE 'failed' END;
      END IF;

    ELSIF p_test_key = 'governance_no_risky_without_approval' THEN
      v_test_name := 'Nenhuma ação high/critical ativa sem approval_required (excluindo allowlist)';
      v_expected := jsonb_build_object('risky_actions_without_approval', 0);
      SELECT COUNT(*), COALESCE(jsonb_agg(action_key ORDER BY action_key), '[]'::jsonb)
      INTO v_count, v_keys
      FROM action_registry
      WHERE is_active AND risk_level IN ('high','critical')
        AND COALESCE(approval_required, false) = false
        AND NOT (action_key = ANY(v_allowlist));
      v_actual := jsonb_build_object('risky_actions_without_approval', v_count, 'action_keys', v_keys);
      v_status := CASE WHEN v_count = 0 THEN 'passed' ELSE 'failed' END;

    ELSIF p_test_key = 'governance_mark_won_requires_approval' THEN
      v_test_name := 'opportunity.mark_won exige aprovação';
      v_action := 'opportunity.mark_won';
      v_expected := jsonb_build_object('approval_required', true);
      SELECT approval_required INTO v_appr_required
      FROM action_registry WHERE action_key = 'opportunity.mark_won';
      v_actual := jsonb_build_object('approval_required', v_appr_required);
      v_status := CASE WHEN v_appr_required IS TRUE THEN 'passed' ELSE 'failed' END;

    ELSIF p_test_key = 'governance_accept_internally_requires_approval' THEN
      v_test_name := 'proposal.accept_internally exige aprovação';
      v_action := 'proposal.accept_internally';
      v_expected := jsonb_build_object('approval_required', true);
      SELECT approval_required INTO v_appr_required
      FROM action_registry WHERE action_key = 'proposal.accept_internally';
      v_actual := jsonb_build_object('approval_required', v_appr_required);
      v_status := CASE WHEN v_appr_required IS TRUE THEN 'passed' ELSE 'failed' END;

    ELSE
      v_test_name := p_test_key;
      v_status := 'error';
      v_error := 'unknown_test_key';
    END IF;

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
