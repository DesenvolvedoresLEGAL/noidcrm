-- =====================================================
-- FUNDAÇÃO DE OBSERVABILIDADE - NOID RevenueOS
-- =====================================================

-- 1. CRIAR TABELA system_events (eventos unificados)
CREATE TABLE IF NOT EXISTS public.system_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  
  -- Quem
  actor_type TEXT NOT NULL CHECK (actor_type IN ('user', 'system', 'automation', 'ai_agent')),
  actor_id UUID,
  actor_name TEXT,
  
  -- O que
  event_type TEXT NOT NULL,
  event_category TEXT NOT NULL CHECK (event_category IN ('crm', 'ai', 'automation', 'system', 'security')),
  action TEXT NOT NULL,
  
  -- Onde
  entity_type TEXT,
  entity_id UUID,
  
  -- Contexto
  payload JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX idx_system_events_trace_id ON public.system_events(trace_id);
CREATE INDEX idx_system_events_entity ON public.system_events(entity_type, entity_id);
CREATE INDEX idx_system_events_created ON public.system_events(created_at DESC);
CREATE INDEX idx_system_events_org ON public.system_events(organization_id);
CREATE INDEX idx_system_events_category ON public.system_events(event_category);
CREATE INDEX idx_system_events_event_type ON public.system_events(event_type);

-- 2. CRIAR TABELA ai_runs (execuções de IA)
CREATE TABLE IF NOT EXISTS public.ai_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trace_id UUID NOT NULL,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  
  -- Contexto
  run_type TEXT NOT NULL CHECK (run_type IN ('scoring', 'suggestion', 'analysis', 'playbook', 'forecast', 'coaching')),
  model_used TEXT NOT NULL,
  feature TEXT NOT NULL,
  
  -- Entidade processada
  entity_type TEXT,
  entity_id UUID,
  
  -- Input/Output
  input_context JSONB NOT NULL DEFAULT '{}',
  output_result JSONB,
  
  -- Performance
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  latency_ms INTEGER,
  volts_consumed NUMERIC(10,4) DEFAULT 0,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para ai_runs
CREATE INDEX idx_ai_runs_trace ON public.ai_runs(trace_id);
CREATE INDEX idx_ai_runs_entity ON public.ai_runs(entity_type, entity_id);
CREATE INDEX idx_ai_runs_status ON public.ai_runs(status);
CREATE INDEX idx_ai_runs_org ON public.ai_runs(organization_id);
CREATE INDEX idx_ai_runs_created ON public.ai_runs(created_at DESC);
CREATE INDEX idx_ai_runs_feature ON public.ai_runs(feature);

-- 3. ADICIONAR trace_id às tabelas existentes
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS trace_id UUID;
CREATE INDEX IF NOT EXISTS idx_audit_log_trace ON public.audit_log(trace_id);

ALTER TABLE public.workflow_executions ADD COLUMN IF NOT EXISTS trace_id UUID;
CREATE INDEX IF NOT EXISTS idx_workflow_executions_trace ON public.workflow_executions(trace_id);

ALTER TABLE public.revenue_events ADD COLUMN IF NOT EXISTS trace_id UUID;
CREATE INDEX IF NOT EXISTS idx_revenue_events_trace ON public.revenue_events(trace_id);

-- 4. FUNÇÃO para gerar trace_id
CREATE OR REPLACE FUNCTION public.generate_trace_id()
RETURNS UUID
LANGUAGE sql
STABLE
AS $$
  SELECT gen_random_uuid();
$$;

-- 5. TRIGGER para popular trace_id automaticamente
CREATE OR REPLACE FUNCTION public.set_default_trace_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.trace_id IS NULL THEN
    NEW.trace_id := gen_random_uuid();
  END IF;
  RETURN NEW;
END;
$$;

-- Aplicar trigger nas tabelas
DROP TRIGGER IF EXISTS set_audit_log_trace_id ON public.audit_log;
CREATE TRIGGER set_audit_log_trace_id
  BEFORE INSERT ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_trace_id();

DROP TRIGGER IF EXISTS set_system_events_trace_id ON public.system_events;
CREATE TRIGGER set_system_events_trace_id
  BEFORE INSERT ON public.system_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_trace_id();

DROP TRIGGER IF EXISTS set_ai_runs_trace_id ON public.ai_runs;
CREATE TRIGGER set_ai_runs_trace_id
  BEFORE INSERT ON public.ai_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_trace_id();

DROP TRIGGER IF EXISTS set_workflow_executions_trace_id ON public.workflow_executions;
CREATE TRIGGER set_workflow_executions_trace_id
  BEFORE INSERT ON public.workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_trace_id();

DROP TRIGGER IF EXISTS set_revenue_events_trace_id ON public.revenue_events;
CREATE TRIGGER set_revenue_events_trace_id
  BEFORE INSERT ON public.revenue_events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_trace_id();

-- 6. FUNÇÃO para registrar eventos no sistema
CREATE OR REPLACE FUNCTION public.log_system_event(
  p_trace_id UUID,
  p_org_id UUID,
  p_actor_type TEXT,
  p_actor_id UUID,
  p_event_type TEXT,
  p_event_category TEXT,
  p_action TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_payload JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_event_id UUID;
  v_actor_name TEXT;
BEGIN
  -- Buscar nome do ator se for usuário
  IF p_actor_id IS NOT NULL THEN
    SELECT full_name INTO v_actor_name FROM profiles WHERE user_id = p_actor_id;
  END IF;

  INSERT INTO system_events (
    trace_id, organization_id, actor_type, actor_id, actor_name,
    event_type, event_category, action,
    entity_type, entity_id, payload
  ) VALUES (
    COALESCE(p_trace_id, gen_random_uuid()),
    p_org_id, p_actor_type, p_actor_id, v_actor_name,
    p_event_type, p_event_category, p_action,
    p_entity_type, p_entity_id, p_payload
  )
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- 7. TRIGGER para logging automático de oportunidades
CREATE OR REPLACE FUNCTION public.log_opportunity_system_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_trace_id UUID;
  v_actor_type TEXT;
BEGIN
  v_trace_id := gen_random_uuid();
  v_actor_type := CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'system' END;
  
  IF TG_OP = 'INSERT' THEN
    PERFORM log_system_event(
      v_trace_id, NEW.organization_id, 
      v_actor_type, auth.uid(),
      'opportunity.created', 'crm', 'create',
      'opportunity', NEW.id,
      jsonb_build_object(
        'title', NEW.title, 
        'valor_previsto', NEW.valor_previsto,
        'stage_id', NEW.stage_id,
        'pipeline_id', NEW.pipeline_id
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Stage change
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      PERFORM log_system_event(
        v_trace_id, NEW.organization_id,
        CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'automation' END,
        auth.uid(),
        'opportunity.stage_changed', 'crm', 'stage_move',
        'opportunity', NEW.id,
        jsonb_build_object(
          'old_stage_id', OLD.stage_id, 
          'new_stage_id', NEW.stage_id,
          'pipeline_id', NEW.pipeline_id
        )
      );
    END IF;
    
    -- Status change
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_system_event(
        v_trace_id, NEW.organization_id,
        CASE WHEN auth.uid() IS NOT NULL THEN 'user' ELSE 'automation' END,
        auth.uid(),
        'opportunity.status_changed', 'crm', 'status_update',
        'opportunity', NEW.id,
        jsonb_build_object(
          'old_status', OLD.status, 
          'new_status', NEW.status
        )
      );
    END IF;
    
    -- Value change
    IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN
      PERFORM log_system_event(
        v_trace_id, NEW.organization_id,
        v_actor_type, auth.uid(),
        'opportunity.value_changed', 'crm', 'value_update',
        'opportunity', NEW.id,
        jsonb_build_object(
          'old_value', OLD.valor_previsto, 
          'new_value', NEW.valor_previsto
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Aplicar trigger de eventos em oportunidades
DROP TRIGGER IF EXISTS log_opportunity_events_trigger ON public.opportunities;
CREATE TRIGGER log_opportunity_events_trigger
  AFTER INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.log_opportunity_system_events();

-- 8. TRIGGER para logging de workflows
CREATE OR REPLACE FUNCTION public.log_workflow_system_events()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM log_system_event(
      NEW.trace_id, NEW.organization_id,
      'automation', NULL,
      'workflow.triggered', 'automation', 'trigger',
      'opportunity', NEW.opportunity_id,
      jsonb_build_object(
        'workflow_rule_id', NEW.workflow_rule_id,
        'trigger_type', NEW.trigger_type,
        'trigger_data', NEW.trigger_data
      )
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      PERFORM log_system_event(
        NEW.trace_id, NEW.organization_id,
        'automation', NULL,
        'workflow.' || NEW.status, 'automation', NEW.status,
        'opportunity', NEW.opportunity_id,
        jsonb_build_object(
          'workflow_rule_id', NEW.workflow_rule_id,
          'execution_id', NEW.id,
          'result_data', NEW.result_data
        )
      );
    END IF;
  END IF;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS log_workflow_events_trigger ON public.workflow_executions;
CREATE TRIGGER log_workflow_events_trigger
  AFTER INSERT OR UPDATE ON public.workflow_executions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_workflow_system_events();

-- 9. RLS POLICIES para system_events
ALTER TABLE public.system_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all system_events"
  ON public.system_events FOR SELECT
  USING (is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Org members can view their org system_events"
  ON public.system_events FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert system_events"
  ON public.system_events FOR INSERT
  WITH CHECK (true);

-- 10. RLS POLICIES para ai_runs
ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins can view all ai_runs"
  ON public.ai_runs FOR SELECT
  USING (is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Org members can view their org ai_runs"
  ON public.ai_runs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert ai_runs"
  ON public.ai_runs FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update ai_runs"
  ON public.ai_runs FOR UPDATE
  USING (true);