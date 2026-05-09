
-- ============================================================
-- SPRINT B — Audit unificado + Approval router
-- ============================================================

-- ------------------------------------------------------------
-- 1) approval_requests (genérica: humano + agente)
-- ------------------------------------------------------------
CREATE TABLE public.approval_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  action_key TEXT NOT NULL REFERENCES public.action_registry(action_key),
  requester_type TEXT NOT NULL CHECK (requester_type IN ('human','agent','system')),
  requester_user_id UUID,
  requester_agent_id UUID,
  execution_id UUID REFERENCES public.action_executions(id) ON DELETE SET NULL,
  entity_type TEXT,
  entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_level public.action_risk_level NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected','expired','cancelled')),
  approver_user_id UUID,
  decision_reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_approval_requests_org_status
  ON public.approval_requests(organization_id, status, requested_at DESC);
CREATE INDEX idx_approval_requests_execution
  ON public.approval_requests(execution_id) WHERE execution_id IS NOT NULL;
CREATE INDEX idx_approval_requests_entity
  ON public.approval_requests(entity_type, entity_id);

ALTER TABLE public.approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read org approvals"
ON public.approval_requests FOR SELECT
TO authenticated
USING (public.user_is_org_member(organization_id) OR public.is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Members create org approvals"
ON public.approval_requests FOR INSERT
TO authenticated
WITH CHECK (public.user_is_org_member(organization_id));

CREATE POLICY "Admins decide org approvals"
ON public.approval_requests FOR UPDATE
TO authenticated
USING (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()))
WITH CHECK (public.user_is_org_admin(organization_id) OR public.can_view_all(auth.uid()));

-- ------------------------------------------------------------
-- 2) RPC: request_approval
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.request_approval(
  p_action_key TEXT,
  p_payload JSONB DEFAULT '{}'::jsonb,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_execution_id UUID DEFAULT NULL,
  p_expires_in_hours INTEGER DEFAULT 72
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_org UUID;
  v_action public.action_registry%ROWTYPE;
  v_id UUID;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_action FROM public.action_registry
  WHERE action_key = p_action_key AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'action_not_found');
  END IF;

  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_organization');
  END IF;

  INSERT INTO public.approval_requests(
    organization_id, action_key, requester_type, requester_user_id,
    execution_id, entity_type, entity_id, payload, risk_level,
    expires_at
  ) VALUES (
    v_org, p_action_key, 'human', v_user,
    p_execution_id, p_entity_type, p_entity_id, p_payload, v_action.risk_level,
    now() + make_interval(hours => GREATEST(p_expires_in_hours, 1))
  ) RETURNING id INTO v_id;

  -- Liga a execução à aprovação (se houver)
  IF p_execution_id IS NOT NULL THEN
    UPDATE public.action_executions
    SET approval_id = v_id, status = 'awaiting_approval'
    WHERE id = p_execution_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'approval_id', v_id, 'risk_level', v_action.risk_level);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_approval TO authenticated;

-- ------------------------------------------------------------
-- 3) RPC: decide_approval (approve | reject)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.decide_approval(
  p_approval_id UUID,
  p_decision TEXT,            -- 'approved' | 'rejected'
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
  v_req public.approval_requests%ROWTYPE;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;
  IF p_decision NOT IN ('approved','rejected') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_decision');
  END IF;

  SELECT * INTO v_req FROM public.approval_requests
  WHERE id = p_approval_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;
  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_decided', 'status', v_req.status);
  END IF;

  -- Apenas admins/managers da org (ou platform admin) decidem
  IF NOT (public.user_is_org_admin(v_req.organization_id)
          OR public.can_view_all(v_user)
          OR public.is_platform_admin_for_rls(v_user)) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'insufficient_permission');
  END IF;

  UPDATE public.approval_requests
  SET status = p_decision,
      approver_user_id = v_user,
      decision_reason = p_reason,
      decided_at = now()
  WHERE id = p_approval_id;

  -- Atualiza execução ligada
  IF v_req.execution_id IS NOT NULL THEN
    IF p_decision = 'approved' THEN
      UPDATE public.action_executions
      SET status = 'pending'  -- liberada para o executor real rodar
      WHERE id = v_req.execution_id;
    ELSE
      UPDATE public.action_executions
      SET status = 'blocked',
          error_message = COALESCE('rejected: ' || p_reason, 'rejected'),
          completed_at = now()
      WHERE id = v_req.execution_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', true, 'status', p_decision);
END;
$$;

GRANT EXECUTE ON FUNCTION public.decide_approval TO authenticated;

-- ------------------------------------------------------------
-- 4) View unificada de auditoria (security_invoker = caller's RLS)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.unified_audit_view
WITH (security_invoker = true)
AS
-- 4.1 audit_log (CRM)
SELECT
  id,
  'audit_log'::text                           AS source,
  created_at                                  AS occurred_at,
  organization_id,
  CASE WHEN actor_user_id IS NULL THEN 'system' ELSE 'human' END AS actor_type,
  actor_user_id,
  NULL::uuid                                  AS actor_agent_id,
  action                                      AS action_key,
  entity_type,
  entity_id,
  old_value                                   AS before_state,
  new_value                                   AS after_state,
  NULL::text                                  AS status,
  COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('field_name', field_name, 'trace_id', trace_id) AS metadata
FROM public.audit_log

UNION ALL

-- 4.2 action_executions (Sprint A)
SELECT
  id,
  'action_execution'::text                    AS source,
  created_at                                  AS occurred_at,
  organization_id,
  actor_type,
  actor_user_id,
  actor_agent_id,
  action_key,
  entity_type,
  entity_id,
  before_state,
  after_state,
  status,
  jsonb_build_object(
    'surface', surface,
    'duration_ms', duration_ms,
    'error', error_message,
    'approval_id', approval_id,
    'input', input_payload,
    'output', output_payload
  )                                           AS metadata
FROM public.action_executions

UNION ALL

-- 4.3 ai_agent_audit
SELECT
  id,
  'ai_agent_audit'::text                      AS source,
  created_at                                  AS occurred_at,
  organization_id,
  'agent'::text                               AS actor_type,
  actor_id                                    AS actor_user_id,
  agent_id                                    AS actor_agent_id,
  action_type                                 AS action_key,
  NULL::text                                  AS entity_type,
  NULL::uuid                                  AS entity_id,
  NULL::jsonb                                 AS before_state,
  NULL::jsonb                                 AS after_state,
  NULL::text                                  AS status,
  COALESCE(payload_json, '{}'::jsonb)         AS metadata
FROM public.ai_agent_audit

UNION ALL

-- 4.4 mcp_audit_logs
SELECT
  id,
  'mcp_audit_logs'::text                      AS source,
  created_at                                  AS occurred_at,
  organization_id,
  CASE WHEN agent_id IS NOT NULL THEN 'agent' ELSE 'human' END AS actor_type,
  user_id                                     AS actor_user_id,
  agent_id                                    AS actor_agent_id,
  action                                      AS action_key,
  entity_type,
  entity_id,
  before_json                                 AS before_state,
  after_json                                  AS after_state,
  NULL::text                                  AS status,
  COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object('ip', ip_address, 'ua', user_agent) AS metadata
FROM public.mcp_audit_logs

UNION ALL

-- 4.5 auth_audit_log (sem org; RLS dessa tabela já filtra)
SELECT
  id,
  'auth_audit_log'::text                      AS source,
  created_at                                  AS occurred_at,
  NULL::uuid                                  AS organization_id,
  'human'::text                               AS actor_type,
  user_id                                     AS actor_user_id,
  NULL::uuid                                  AS actor_agent_id,
  event_type                                  AS action_key,
  resource_type                               AS entity_type,
  resource_id                                 AS entity_id,
  NULL::jsonb                                 AS before_state,
  NULL::jsonb                                 AS after_state,
  CASE WHEN success THEN 'succeeded' ELSE 'failed' END AS status,
  COALESCE(metadata, '{}'::jsonb)
    || jsonb_build_object(
      'email', email, 'ip', ip_address::text, 'country', country_code,
      'device', device_type, 'error', error_message
    )                                          AS metadata
FROM public.auth_audit_log;

GRANT SELECT ON public.unified_audit_view TO authenticated;

-- ------------------------------------------------------------
-- 5) View unificada da fila de aprovação
--    (approval_requests + ai_agent_approval_queue legado)
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.unified_approval_queue_view
WITH (security_invoker = true)
AS
SELECT
  id,
  'approval_requests'::text                   AS source,
  organization_id,
  action_key,
  requester_type,
  requester_user_id,
  requester_agent_id,
  entity_type,
  entity_id,
  status,
  risk_level::text                            AS risk_level,
  approver_user_id                            AS decided_by,
  decision_reason,
  requested_at,
  decided_at,
  expires_at,
  payload                                     AS payload,
  execution_id
FROM public.approval_requests

UNION ALL

SELECT
  id,
  'ai_agent_approval_queue'::text             AS source,
  organization_id,
  approval_type                               AS action_key,
  'agent'::text                               AS requester_type,
  requested_by                                AS requester_user_id,
  agent_id                                    AS requester_agent_id,
  entity_type,
  entity_id,
  status,
  'medium'::text                              AS risk_level,
  COALESCE(approved_by, rejected_by)          AS decided_by,
  COALESCE(approval_reason, rejection_reason) AS decision_reason,
  requested_at,
  decided_at,
  NULL::timestamptz                           AS expires_at,
  '{}'::jsonb                                 AS payload,
  NULL::uuid                                  AS execution_id
FROM public.ai_agent_approval_queue;

GRANT SELECT ON public.unified_approval_queue_view TO authenticated;
