
-- ===========================================
-- NOID Performance Engine V2 - Fase 1
-- ===========================================

-- 1. Tabela de Cadastro Padrão de Atividades
CREATE TABLE public.performance_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  activity_type TEXT NOT NULL CHECK (activity_type IN ('INDIVIDUAL', 'COLETIVO', 'COMPANHIA')),
  scores_impacted TEXT[] NOT NULL DEFAULT '{}',
  weight INTEGER NOT NULL CHECK (weight BETWEEN 1 AND 4),
  is_active BOOLEAN DEFAULT true,
  is_configurable BOOLEAN DEFAULT true,
  is_system_default BOOLEAN DEFAULT false,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(code, organization_id)
);

ALTER TABLE public.performance_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perf_act_select" ON public.performance_activities FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "perf_act_insert" ON public.performance_activities FOR INSERT
WITH CHECK (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE POLICY "perf_act_update" ON public.performance_activities FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE POLICY "perf_act_delete" ON public.performance_activities FOR DELETE
USING (is_system_default = false AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE INDEX idx_perf_act_org ON public.performance_activities(organization_id);
CREATE INDEX idx_perf_act_type ON public.performance_activities(activity_type);

-- 2. Tabela de Metas por Atividade/Cargo
CREATE TABLE public.activity_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES public.performance_activities(id) ON DELETE CASCADE,
  ote_level_id UUID REFERENCES public.ote_levels(id) ON DELETE SET NULL,
  role_name TEXT,
  daily_target INTEGER,
  weekly_target INTEGER,
  monthly_target INTEGER,
  weight_override INTEGER CHECK (weight_override IS NULL OR weight_override BETWEEN 1 AND 4),
  calculation_window INTEGER DEFAULT 30,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, ote_level_id, organization_id)
);

ALTER TABLE public.activity_targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "act_tgt_select" ON public.activity_targets FOR SELECT
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "act_tgt_all" ON public.activity_targets FOR ALL
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE INDEX idx_act_tgt_activity ON public.activity_targets(activity_id);
CREATE INDEX idx_act_tgt_org ON public.activity_targets(organization_id);

-- 3. Tabela de Registro de Execução
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  seller_id UUID REFERENCES public.sellers(id) ON DELETE SET NULL,
  activity_id UUID NOT NULL REFERENCES public.performance_activities(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'automatic', 'integration', 'ai_detected')),
  validated BOOLEAN DEFAULT false,
  validation_method TEXT,
  metadata JSONB DEFAULT '{}',
  entity_type TEXT,
  entity_id UUID,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  logged_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "act_log_select" ON public.activity_logs FOR SELECT
USING (user_id = auth.uid() OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'manager', 'owner')));

CREATE POLICY "act_log_insert" ON public.activity_logs FOR INSERT
WITH CHECK (user_id = auth.uid() AND organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()));

CREATE POLICY "act_log_update" ON public.activity_logs FOR UPDATE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE POLICY "act_log_delete" ON public.activity_logs FOR DELETE
USING (organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid() AND role IN ('admin', 'owner')));

CREATE INDEX idx_act_log_user ON public.activity_logs(user_id);
CREATE INDEX idx_act_log_seller ON public.activity_logs(seller_id);
CREATE INDEX idx_act_log_activity ON public.activity_logs(activity_id);
CREATE INDEX idx_act_log_org ON public.activity_logs(organization_id);
CREATE INDEX idx_act_log_logged_at ON public.activity_logs(logged_at DESC);

-- 4. Função para carregar preset NOID
CREATE OR REPLACE FUNCTION public.load_noid_performance_preset(p_organization_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM performance_activities WHERE organization_id = p_organization_id AND is_system_default = true) THEN
    RETURN;
  END IF;

  INSERT INTO performance_activities (code, name, description, activity_type, scores_impacted, weight, is_system_default, organization_id) VALUES
    ('IND-01', 'Prospecção ativa qualificada', 'Contato com leads qualificados através de ligação, email ou social selling', 'INDIVIDUAL', ARRAY['BS', 'DS'], 4, true, p_organization_id),
    ('IND-02', 'Follow-up dentro do SLA', 'Acompanhamento de leads/oportunidades dentro do prazo estabelecido', 'INDIVIDUAL', ARRAY['BS', 'DS'], 4, true, p_organization_id),
    ('IND-03', 'Atualização de pipeline', 'Manter oportunidades com informações atualizadas no CRM', 'INDIVIDUAL', ARRAY['BS'], 3, true, p_organization_id),
    ('IND-04', 'Registro de atividades', 'Documentar todas as interações com clientes e leads', 'INDIVIDUAL', ARRAY['BS'], 3, true, p_organization_id),
    ('IND-05', 'Qualificação de leads', 'Avaliar e classificar leads conforme critérios de qualificação', 'INDIVIDUAL', ARRAY['CS', 'DS'], 3, true, p_organization_id),
    ('IND-06', 'Envio de propostas', 'Elaborar e enviar propostas comerciais', 'INDIVIDUAL', ARRAY['DS'], 4, true, p_organization_id),
    ('IND-07', 'Roleplay de vendas', 'Participação em sessões de prática de vendas', 'INDIVIDUAL', ARRAY['CS'], 3, true, p_organization_id),
    ('IND-08', 'Aprovação em roleplay', 'Obter aprovação em avaliações de roleplay', 'INDIVIDUAL', ARRAY['CS'], 4, true, p_organization_id),
    ('IND-09', 'Reuniões realizadas', 'Conduzir reuniões com prospects e clientes', 'INDIVIDUAL', ARRAY['BS', 'DS'], 4, true, p_organization_id),
    ('IND-10', 'Deals avançados de stage', 'Mover oportunidades para próximos estágios do pipeline', 'INDIVIDUAL', ARRAY['DS'], 3, true, p_organization_id),
    ('COL-01', 'Atualização correta do CRM', 'Manter dados precisos e completos no sistema', 'COLETIVO', ARRAY['BS'], 4, true, p_organization_id),
    ('COL-02', 'Participação em reuniões de time', 'Presença ativa em reuniões de equipe', 'COLETIVO', ARRAY['BS'], 2, true, p_organization_id),
    ('COL-03', 'Colaboração com colegas', 'Apoiar outros membros do time em deals', 'COLETIVO', ARRAY['BS', 'RAS'], 2, true, p_organization_id),
    ('COL-04', 'Compartilhamento de conhecimento', 'Contribuir com insights e aprendizados para o time', 'COLETIVO', ARRAY['CS', 'RAS'], 3, true, p_organization_id),
    ('CO-01', 'Cumprimento de meta', 'Atingir as metas estabelecidas de vendas', 'COMPANHIA', ARRAY['DS'], 4, true, p_organization_id),
    ('CO-02', 'Disciplina de forecast', 'Manter previsões de vendas precisas', 'COMPANHIA', ARRAY['DS'], 3, true, p_organization_id),
    ('CO-03', 'Tempo de resposta a leads', 'Responder a novos leads dentro do SLA', 'COMPANHIA', ARRAY['BS', 'DS'], 4, true, p_organization_id),
    ('CO-04', 'Taxa de conversão', 'Converter leads em clientes de forma eficiente', 'COMPANHIA', ARRAY['DS'], 4, true, p_organization_id),
    ('CO-05', 'Postura ética com clientes', 'Manter conduta profissional e ética', 'COMPANHIA', ARRAY['RAS'], 4, true, p_organization_id),
    ('CO-06', 'Presença em treinamentos', 'Participar dos treinamentos obrigatórios', 'COMPANHIA', ARRAY['CS', 'RAS'], 3, true, p_organization_id);
END;
$$;

-- 5. Trigger para novas organizações
CREATE OR REPLACE FUNCTION public.trigger_load_performance_preset()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM load_noid_performance_preset(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_org_created_load_perf_preset
AFTER INSERT ON public.organizations
FOR EACH ROW EXECUTE FUNCTION public.trigger_load_performance_preset();

-- 6. Updated_at triggers
CREATE TRIGGER upd_perf_activities_at BEFORE UPDATE ON public.performance_activities
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER upd_activity_targets_at BEFORE UPDATE ON public.activity_targets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
