
-- ============================================================
-- SPRINT A — ACTION REGISTRY (Headless Humanoid foundation)
-- Catálogo canônico de ações executáveis (humanos + agentes)
-- ============================================================

CREATE TYPE public.action_risk_level AS ENUM ('low', 'medium', 'high', 'critical');
CREATE TYPE public.action_executor_type AS ENUM ('edge_function', 'rpc', 'service', 'manual');
CREATE TYPE public.action_surface AS ENUM ('web', 'slack', 'whatsapp', 'email', 'agent', 'api');

CREATE TABLE public.action_registry (
  action_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  domain TEXT NOT NULL,                          -- 'opportunity', 'proposal', 'inventory', etc.
  risk_level public.action_risk_level NOT NULL DEFAULT 'low',
  required_role TEXT,                            -- 'owner','admin','manager','closer','sdr', NULL = any auth
  required_permission TEXT,                      -- key in permission_sets, optional
  approval_required BOOLEAN NOT NULL DEFAULT false,
  approval_threshold JSONB,                      -- e.g. {"discount_pct_gt": 15}
  agent_executable BOOLEAN NOT NULL DEFAULT false,
  human_executable BOOLEAN NOT NULL DEFAULT true,
  executor_type public.action_executor_type NOT NULL,
  executor_ref TEXT NOT NULL,                    -- function/rpc/service identifier
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  available_surfaces public.action_surface[] NOT NULL DEFAULT ARRAY['web']::public.action_surface[],
  audit_enabled BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_action_registry_domain ON public.action_registry(domain) WHERE is_active;
CREATE INDEX idx_action_registry_risk ON public.action_registry(risk_level) WHERE is_active;
CREATE INDEX idx_action_registry_agent ON public.action_registry(agent_executable) WHERE is_active AND agent_executable;

CREATE TRIGGER trg_action_registry_updated_at
BEFORE UPDATE ON public.action_registry
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.action_registry ENABLE ROW LEVEL SECURITY;

-- Catálogo é global (não por org) e legível por qualquer usuário autenticado
CREATE POLICY "Anyone authenticated can read action registry"
ON public.action_registry FOR SELECT
TO authenticated
USING (is_active = true);

-- Apenas platform admins podem mutar o catálogo
CREATE POLICY "Platform admins can manage action registry"
ON public.action_registry FOR ALL
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()))
WITH CHECK (public.is_platform_admin_for_rls(auth.uid()));

-- ============================================================
-- ACTION EXECUTIONS — log de TODA tentativa de execução
-- ============================================================
CREATE TABLE public.action_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_key TEXT NOT NULL REFERENCES public.action_registry(action_key),
  organization_id UUID,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('human','agent','system')),
  actor_user_id UUID,
  actor_agent_id UUID,
  surface public.action_surface NOT NULL DEFAULT 'web',
  entity_type TEXT,
  entity_id UUID,
  input_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_payload JSONB,
  before_state JSONB,
  after_state JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','succeeded','failed','blocked','awaiting_approval')),
  approval_id UUID,                             -- ai_agent_approval_queue.id quando aplicável
  error_message TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_action_executions_org_created ON public.action_executions(organization_id, created_at DESC);
CREATE INDEX idx_action_executions_action_key ON public.action_executions(action_key, created_at DESC);
CREATE INDEX idx_action_executions_actor_user ON public.action_executions(actor_user_id, created_at DESC);
CREATE INDEX idx_action_executions_entity ON public.action_executions(entity_type, entity_id);
CREATE INDEX idx_action_executions_status ON public.action_executions(status) WHERE status IN ('pending','running','awaiting_approval');

ALTER TABLE public.action_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read their org executions"
ON public.action_executions FOR SELECT
TO authenticated
USING (
  organization_id IS NULL
  OR public.user_is_org_member(organization_id)
  OR public.is_platform_admin_for_rls(auth.uid())
);

CREATE POLICY "Members can insert their org executions"
ON public.action_executions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NULL
  OR public.user_is_org_member(organization_id)
);

-- ============================================================
-- RPC: execute_action — gateway único
-- Valida role, decide approval, dispara executor (server-side dispatch
-- para edge functions é feito pelo client; o RPC só REGISTRA + VALIDA).
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_action_execution(
  p_action_key TEXT,
  p_input JSONB DEFAULT '{}'::jsonb,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_surface public.action_surface DEFAULT 'web'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.action_registry%ROWTYPE;
  v_user UUID;
  v_org UUID;
  v_exec_id UUID;
  v_needs_approval BOOLEAN;
  v_status TEXT;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'unauthenticated');
  END IF;

  SELECT * INTO v_action FROM public.action_registry
  WHERE action_key = p_action_key AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'action_not_found');
  END IF;

  IF NOT v_action.human_executable THEN
    RETURN jsonb_build_object('ok', false, 'error', 'action_not_human_executable');
  END IF;

  -- Role check (best-effort: usa user_roles; se vazio, permite)
  IF v_action.required_role IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_user AND role::text = v_action.required_role
    ) AND NOT public.can_view_all(v_user) THEN
      RETURN jsonb_build_object('ok', false, 'error', 'insufficient_role',
        'required_role', v_action.required_role);
    END IF;
  END IF;

  v_org := public.get_user_organization_id();
  v_needs_approval := v_action.approval_required;
  v_status := CASE WHEN v_needs_approval THEN 'awaiting_approval' ELSE 'pending' END;

  INSERT INTO public.action_executions (
    action_key, organization_id, actor_type, actor_user_id,
    surface, entity_type, entity_id, input_payload, status
  ) VALUES (
    p_action_key, v_org, 'human', v_user,
    p_surface, p_entity_type, p_entity_id, p_input, v_status
  ) RETURNING id INTO v_exec_id;

  RETURN jsonb_build_object(
    'ok', true,
    'execution_id', v_exec_id,
    'status', v_status,
    'approval_required', v_needs_approval,
    'risk_level', v_action.risk_level,
    'executor_type', v_action.executor_type,
    'executor_ref', v_action.executor_ref
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_action_execution TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_action_execution(
  p_execution_id UUID,
  p_status TEXT,
  p_output JSONB DEFAULT NULL,
  p_after_state JSONB DEFAULT NULL,
  p_error TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN false; END IF;
  IF p_status NOT IN ('succeeded','failed','blocked') THEN RETURN false; END IF;

  UPDATE public.action_executions
  SET status = p_status,
      output_payload = COALESCE(p_output, output_payload),
      after_state = COALESCE(p_after_state, after_state),
      error_message = p_error,
      duration_ms = p_duration_ms,
      completed_at = now()
  WHERE id = p_execution_id
    AND actor_user_id = v_user;

  RETURN FOUND;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_action_execution TO authenticated;

-- ============================================================
-- SEED — 20 ações operacionais críticas já existentes no sistema
-- ============================================================
INSERT INTO public.action_registry
  (action_key, name, description, domain, risk_level, required_role, approval_required,
   agent_executable, human_executable, executor_type, executor_ref,
   available_surfaces, tags)
VALUES
  -- Opportunity domain
  ('opportunity.create', 'Criar Oportunidade', 'Cria nova oportunidade no pipeline', 'opportunity', 'low', NULL, false, true, true, 'service', 'src/services/supabase/opportunities.ts#createOpportunity', ARRAY['web','agent','api']::public.action_surface[], ARRAY['crm']),
  ('opportunity.update', 'Atualizar Oportunidade', 'Atualiza campos da oportunidade', 'opportunity', 'low', NULL, false, true, true, 'service', 'src/services/supabase/opportunities.ts#updateOpportunity', ARRAY['web','agent','api']::public.action_surface[], ARRAY['crm']),
  ('opportunity.change_stage', 'Mover Etapa', 'Move oportunidade entre etapas do pipeline', 'opportunity', 'medium', NULL, false, true, true, 'service', 'src/services/supabase/opportunities.ts#updateOpportunity', ARRAY['web','agent']::public.action_surface[], ARRAY['crm','pipeline']),
  ('opportunity.mark_won', 'Marcar como Ganha', 'Define oportunidade como won (closed_at imutável)', 'opportunity', 'high', 'closer', false, false, true, 'service', 'src/services/supabase/opportunities.ts#markWon', ARRAY['web']::public.action_surface[], ARRAY['crm','revenue']),
  ('opportunity.mark_lost', 'Marcar como Perdida', 'Define oportunidade como lost com motivo', 'opportunity', 'medium', NULL, false, true, true, 'service', 'src/services/supabase/opportunities.ts#markLost', ARRAY['web','agent']::public.action_surface[], ARRAY['crm']),
  ('opportunity.duplicate', 'Duplicar Oportunidade', 'Deep clone para handoff entre pipelines', 'opportunity', 'low', NULL, false, false, true, 'service', 'duplicateOpportunity', ARRAY['web']::public.action_surface[], ARRAY['crm','handoff']),
  ('opportunity.delete', 'Excluir Oportunidade', 'Soft-delete (deleted_at)', 'opportunity', 'critical', 'admin', true, false, true, 'service', 'softDeleteOpportunity', ARRAY['web']::public.action_surface[], ARRAY['crm','destructive']),

  -- Proposal domain
  ('proposal.create', 'Criar Proposta', 'Gera proposta a partir de oportunidade', 'proposal', 'low', NULL, false, true, true, 'service', 'src/services/proposals/proposalOrchestrator.ts#createProposal', ARRAY['web','agent']::public.action_surface[], ARRAY['proposals']),
  ('proposal.send', 'Enviar Proposta', 'Envia proposta ao cliente (email/link público)', 'proposal', 'medium', NULL, false, true, true, 'edge_function', 'send-proposal-email', ARRAY['web','agent','slack']::public.action_surface[], ARRAY['proposals','outbound']),
  ('proposal.apply_discount', 'Aplicar Desconto', 'Aplica desconto na proposta. Aprovação se > limite.', 'proposal', 'high', 'closer', true, false, true, 'service', 'updateProposalPaymentTerms', ARRAY['web']::public.action_surface[], ARRAY['proposals','approval']),
  ('proposal.accept_internally', 'Aceitar Proposta (Interno)', 'Marca aceite interno gerando efeitos pós-acceptance', 'proposal', 'high', 'admin', false, false, true, 'edge_function', 'post-acceptance-effects', ARRAY['web']::public.action_surface[], ARRAY['proposals','revenue']),
  ('proposal.cancel', 'Cancelar Proposta', 'Cancela proposta ativa', 'proposal', 'high', 'closer', true, false, true, 'service', 'cancelProposal', ARRAY['web']::public.action_surface[], ARRAY['proposals','approval']),

  -- Activity domain
  ('activity.create', 'Criar Atividade', 'Agenda atividade (call, email, whatsapp, task)', 'activity', 'low', NULL, false, true, true, 'service', 'src/services/supabase/activities.ts#createActivity', ARRAY['web','agent','slack','whatsapp']::public.action_surface[], ARRAY['crm']),
  ('activity.complete', 'Concluir Atividade', 'Marca atividade como concluída + dispara workflows', 'activity', 'low', NULL, false, true, true, 'service', 'completeActivity', ARRAY['web','agent']::public.action_surface[], ARRAY['crm','workflow']),
  ('activity.send_followup', 'Enviar Follow-up', 'Envia mensagem de follow-up via canal preferido', 'activity', 'medium', NULL, false, true, true, 'edge_function', 'send-followup-message', ARRAY['web','agent','slack','whatsapp']::public.action_surface[], ARRAY['outbound']),

  -- Inventory domain
  ('inventory.reserve', 'Reservar Inventário', 'Reserva itens de inventário para proposta', 'inventory', 'medium', NULL, false, true, true, 'service', 'reserveInventoryForProposal', ARRAY['web','agent']::public.action_surface[], ARRAY['inventory','proposals']),
  ('inventory.release', 'Liberar Reserva', 'Cancela reserva de inventário', 'inventory', 'medium', NULL, false, true, true, 'service', 'releaseInventoryReservation', ARRAY['web','agent']::public.action_surface[], ARRAY['inventory']),

  -- Contract domain
  ('contract.cancel', 'Cancelar Contrato', 'Cancela contrato vigente', 'contract', 'critical', 'admin', true, false, true, 'service', 'cancelContract', ARRAY['web']::public.action_surface[], ARRAY['contracts','destructive','approval']),

  -- AI / Suggestions
  ('ai.accept_suggestion', 'Aceitar Sugestão IA', 'Aplica sugestão da IA ao registro', 'ai', 'medium', NULL, false, false, true, 'edge_function', 'accept-ai-suggestion', ARRAY['web']::public.action_surface[], ARRAY['ai']),
  ('ai.reject_suggestion', 'Rejeitar Sugestão IA', 'Rejeita sugestão da IA', 'ai', 'low', NULL, false, false, true, 'service', 'rejectSuggestion', ARRAY['web']::public.action_surface[], ARRAY['ai']),

  -- Approval domain
  ('approval.request', 'Solicitar Aprovação', 'Cria item em fila de aprovação', 'approval', 'medium', NULL, false, true, true, 'service', 'createApprovalRequest', ARRAY['web','agent','slack','whatsapp']::public.action_surface[], ARRAY['governance'])
;
