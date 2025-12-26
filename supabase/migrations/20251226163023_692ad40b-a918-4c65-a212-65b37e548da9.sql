
-- ===========================================
-- NOID Performance Engine V2 - Fase 3: Gates Automáticos
-- ===========================================

-- 1. Tabela de Gates de Performance
CREATE TABLE public.performance_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  gate_type TEXT NOT NULL CHECK (gate_type IN ('commission', 'leads', 'promotion', 'high_value_deals', 'acceleration', 'coaching')),
  condition_score TEXT NOT NULL CHECK (condition_score IN ('CS', 'BS', 'DS', 'RAS')),
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('<', '<=', '>=', '>')),
  condition_value NUMERIC(5,2) NOT NULL,
  condition_duration_days INTEGER DEFAULT 0, -- 0 = instantâneo, >0 = deve manter por X dias
  action_type TEXT NOT NULL CHECK (action_type IN ('multiplier', 'block', 'alert', 'suggest', 'unlock')),
  action_value JSONB NOT NULL,
  priority INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.performance_gates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pg_select" ON public.performance_gates FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "pg_insert" ON public.performance_gates FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "pg_update" ON public.performance_gates FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "pg_delete" ON public.performance_gates FOR DELETE
USING (is_system_default = false AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE INDEX idx_pg_org ON public.performance_gates(organization_id);
CREATE INDEX idx_pg_type ON public.performance_gates(gate_type);
CREATE INDEX idx_pg_active ON public.performance_gates(is_active) WHERE is_active = true;

-- 2. Tabela de Execuções de Gates (histórico)
CREATE TABLE public.gate_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gate_id UUID NOT NULL REFERENCES public.performance_gates(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
  triggered_at TIMESTAMPTZ DEFAULT now(),
  score_at_trigger NUMERIC(5,2),
  action_applied JSONB NOT NULL,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  resolution_notes TEXT,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE public.gate_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ge_select" ON public.gate_executions FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "ge_insert" ON public.gate_executions FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "ge_update" ON public.gate_executions FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE INDEX idx_ge_gate ON public.gate_executions(gate_id);
CREATE INDEX idx_ge_seller ON public.gate_executions(seller_id);
CREATE INDEX idx_ge_org ON public.gate_executions(organization_id);
CREATE INDEX idx_ge_triggered ON public.gate_executions(triggered_at DESC);

-- 3. Função para carregar gates padrão NOID
CREATE OR REPLACE FUNCTION public.load_noid_performance_gates(p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM performance_gates WHERE organization_id = p_organization_id AND is_system_default = true) THEN
    RETURN;
  END IF;

  INSERT INTO performance_gates (name, description, gate_type, condition_score, condition_operator, condition_value, condition_duration_days, action_type, action_value, priority, is_system_default, organization_id) VALUES
    -- Comissão
    ('BS Baixo - Penalidade Comissão', 'Aplica multiplicador 0.90 na comissão quando BS < 60', 'commission', 'BS', '<', 60, 0, 'multiplier', '{"multiplier": 0.90, "reason": "Behavior Score abaixo do mínimo"}', 100, true, p_organization_id),
    ('DS Baixo - Penalidade Comissão', 'Aplica multiplicador 0.85 na comissão quando DS < 50', 'commission', 'DS', '<', 50, 0, 'multiplier', '{"multiplier": 0.85, "reason": "Delivery Score abaixo do mínimo"}', 90, true, p_organization_id),
    
    -- Aceleração
    ('CS Baixo - Bloqueia Aceleração', 'Bloqueia aceleração de OTE quando CS < 65', 'acceleration', 'CS', '<', 65, 0, 'block', '{"block": true, "reason": "Capability Score insuficiente para aceleração"}', 100, true, p_organization_id),
    ('BS Baixo - Bloqueia Aceleração', 'Bloqueia aceleração de OTE quando BS < 60', 'acceleration', 'BS', '<', 60, 0, 'block', '{"block": true, "reason": "Behavior Score insuficiente para aceleração"}', 90, true, p_organization_id),
    
    -- Alertas
    ('DS Crítico - Alerta Gestor', 'Alerta gestor quando DS < 50', 'coaching', 'DS', '<', 50, 7, 'alert', '{"alert_type": "manager", "severity": "high", "message": "Vendedor com Delivery Score crítico por 7+ dias"}', 80, true, p_organization_id),
    ('RAS Baixo - Coaching Intensivo', 'Sugere coaching intensivo quando RAS < 70 por 30 dias', 'coaching', 'RAS', '<', 70, 30, 'suggest', '{"suggestion": "intensive_coaching", "message": "Vendedor desalinhado com cargo há 30+ dias - coaching intensivo recomendado"}', 70, true, p_organization_id),
    
    -- Promoção
    ('RAS Alto - Sugerir Promoção', 'Sugere promoção quando RAS >= 115 por 60 dias', 'promotion', 'RAS', '>=', 115, 60, 'suggest', '{"suggestion": "promotion", "message": "Vendedor consistentemente acima das expectativas do cargo - considerar promoção"}', 50, true, p_organization_id),
    
    -- Leads
    ('BS Alto - Prioridade Leads', 'Desbloqueia prioridade em distribuição de leads quando BS >= 80', 'leads', 'BS', '>=', 80, 0, 'unlock', '{"unlock": "lead_priority", "priority_boost": 1.5}', 60, true, p_organization_id),
    ('DS Alto - High Value Deals', 'Desbloqueia acesso a deals high-value quando DS >= 80', 'high_value_deals', 'DS', '>=', 80, 0, 'unlock', '{"unlock": "high_value_access", "min_deal_value_multiplier": 2}', 60, true, p_organization_id);

END;
$$;

-- 4. Atualizar trigger de onboarding para incluir gates
CREATE OR REPLACE FUNCTION public.trigger_load_performance_preset()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM load_noid_performance_preset(NEW.id);
  PERFORM load_noid_performance_gates(NEW.id);
  RETURN NEW;
END;
$$;

-- Trigger updated_at
CREATE TRIGGER upd_performance_gates_at BEFORE UPDATE ON public.performance_gates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
