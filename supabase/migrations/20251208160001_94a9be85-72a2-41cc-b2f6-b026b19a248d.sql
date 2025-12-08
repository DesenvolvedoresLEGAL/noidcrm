
-- =====================================================
-- SPRINT 1: FUNDAMENTOS DE DADOS + RKG v0
-- =====================================================

-- 1. REVENUE EVENTS - Log unificado de todos eventos de receita
CREATE TABLE IF NOT EXISTS public.revenue_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Classificação do evento
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'call', 'email', 'meeting', 'system', 'web', 'chat', 'sms', 'social')),
  event_type TEXT NOT NULL, -- activity, message, win, loss, churn, upsell, stage_change, proposal_sent, etc.
  event_subtype TEXT, -- Subtipo específico (e.g., 'call_inbound', 'email_sent', 'meeting_scheduled')
  
  -- Dados do evento
  payload JSONB DEFAULT '{}'::jsonb,
  
  -- Métricas derivadas
  sentiment_score NUMERIC(3,2), -- -1.00 a 1.00
  engagement_value INTEGER DEFAULT 0, -- Peso do engajamento (0-100)
  revenue_impact NUMERIC(15,2), -- Impacto em receita (pode ser positivo ou negativo)
  
  -- Metadados
  source TEXT DEFAULT 'manual', -- manual, automation, integration, ai
  external_id TEXT, -- ID de sistema externo
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ, -- Quando foi processado por IA
  
  -- Índices para queries frequentes
  CONSTRAINT revenue_events_valid_sentiment CHECK (sentiment_score IS NULL OR (sentiment_score >= -1 AND sentiment_score <= 1))
);

-- Índices para performance
CREATE INDEX idx_revenue_events_org_created ON public.revenue_events(organization_id, created_at DESC);
CREATE INDEX idx_revenue_events_account ON public.revenue_events(account_id, created_at DESC) WHERE account_id IS NOT NULL;
CREATE INDEX idx_revenue_events_opportunity ON public.revenue_events(opportunity_id, created_at DESC) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_revenue_events_type ON public.revenue_events(event_type, created_at DESC);
CREATE INDEX idx_revenue_events_channel ON public.revenue_events(channel, created_at DESC);

-- RLS
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org revenue events"
  ON public.revenue_events FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org revenue events"
  ON public.revenue_events FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "System can manage revenue events"
  ON public.revenue_events FOR ALL
  USING (true)
  WITH CHECK (true);

-- 2. CONVERSATION LOGS - Logs de conversas (chamadas, WhatsApp, email)
CREATE TABLE IF NOT EXISTS public.conversation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Tipo de conversa
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'call', 'email', 'meeting', 'chat', 'sms', 'social')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound', 'internal')),
  
  -- Conteúdo
  subject TEXT,
  content TEXT, -- Texto da mensagem ou transcrição
  summary TEXT, -- Resumo gerado por IA
  
  -- Metadados de chamada
  duration_seconds INTEGER,
  recording_url TEXT,
  transcription TEXT,
  
  -- Análise de IA
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(3,2),
  topics JSONB DEFAULT '[]'::jsonb, -- Tópicos identificados
  action_items JSONB DEFAULT '[]'::jsonb, -- Próximos passos identificados
  objections JSONB DEFAULT '[]'::jsonb, -- Objeções identificadas
  
  -- Metadados
  external_id TEXT,
  external_thread_id TEXT, -- Para agrupar threads de email/whatsapp
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_conversation_logs_org ON public.conversation_logs(organization_id, created_at DESC);
CREATE INDEX idx_conversation_logs_account ON public.conversation_logs(account_id, created_at DESC) WHERE account_id IS NOT NULL;
CREATE INDEX idx_conversation_logs_opportunity ON public.conversation_logs(opportunity_id, created_at DESC) WHERE opportunity_id IS NOT NULL;
CREATE INDEX idx_conversation_logs_channel ON public.conversation_logs(channel, created_at DESC);

-- RLS
ALTER TABLE public.conversation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org conversation logs"
  ON public.conversation_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can manage org conversation logs"
  ON public.conversation_logs FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- 3. WIN LOSS RECORDS - Registros detalhados de ganho/perda
CREATE TABLE IF NOT EXISTS public.win_loss_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  
  -- Resultado
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'abandoned')),
  
  -- Motivos estruturados
  reason_id UUID REFERENCES public.loss_reasons(id) ON DELETE SET NULL, -- Motivo principal (tabela existente)
  reason_seller TEXT, -- Motivo selecionado pelo vendedor
  reason_free_text TEXT, -- Texto livre
  
  -- Fatores de decisão
  competitor TEXT, -- Concorrente envolvido
  competitor_product TEXT, -- Produto do concorrente
  price_factor BOOLEAN DEFAULT false, -- Preço foi fator decisivo?
  timing_factor BOOLEAN DEFAULT false, -- Timing foi fator?
  feature_factor BOOLEAN DEFAULT false, -- Features foram fator?
  relationship_factor BOOLEAN DEFAULT false, -- Relacionamento foi fator?
  
  -- Análise detalhada
  decision_makers JSONB DEFAULT '[]'::jsonb, -- Quem participou da decisão
  objections_faced JSONB DEFAULT '[]'::jsonb, -- Objeções enfrentadas
  strengths_mentioned JSONB DEFAULT '[]'::jsonb, -- Pontos fortes mencionados
  weaknesses_mentioned JSONB DEFAULT '[]'::jsonb, -- Pontos fracos mencionados
  
  -- Valores
  final_value NUMERIC(15,2), -- Valor final (ganho ou perdido)
  original_value NUMERIC(15,2), -- Valor original da proposta
  discount_given NUMERIC(5,2), -- Desconto dado (%)
  
  -- Contexto
  sales_cycle_days INTEGER, -- Duração do ciclo de venda
  stages_visited JSONB DEFAULT '[]'::jsonb, -- Estágios visitados
  activities_count INTEGER DEFAULT 0, -- Quantidade de atividades
  proposals_count INTEGER DEFAULT 0, -- Quantidade de propostas
  
  -- IA
  ai_analysis TEXT, -- Análise gerada por IA
  lessons_learned JSONB DEFAULT '[]'::jsonb, -- Lições aprendidas (IA)
  
  -- Metadados
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  analyzed_at TIMESTAMPTZ
);

-- Índices
CREATE INDEX idx_win_loss_org ON public.win_loss_records(organization_id, created_at DESC);
CREATE INDEX idx_win_loss_outcome ON public.win_loss_records(outcome, created_at DESC);
CREATE INDEX idx_win_loss_competitor ON public.win_loss_records(competitor) WHERE competitor IS NOT NULL;

-- RLS
ALTER TABLE public.win_loss_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org win loss records"
  ON public.win_loss_records FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can manage org win loss records"
  ON public.win_loss_records FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- 4. AI USAGE LOGS - Tracking de uso de IA (VOLTS)
CREATE TABLE IF NOT EXISTS public.ai_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Contexto
  feature TEXT NOT NULL, -- Nome da feature (lead_prioritization, deal_health, forecast, etc.)
  action TEXT NOT NULL, -- Ação específica (generate, analyze, predict, suggest)
  entity_type TEXT, -- Tipo de entidade (opportunity, account, lead, etc.)
  entity_id UUID, -- ID da entidade
  
  -- Consumo
  model_used TEXT NOT NULL, -- Modelo de IA usado
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  tokens_total INTEGER DEFAULT 0,
  
  -- VOLTS
  volts_used NUMERIC(10,4) DEFAULT 0, -- Custo em VOLTS
  volts_rate NUMERIC(10,6), -- Taxa de conversão tokens → VOLTS no momento
  
  -- Resultado
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  latency_ms INTEGER, -- Latência da chamada
  
  -- Metadados
  request_metadata JSONB DEFAULT '{}'::jsonb,
  response_metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_ai_usage_org ON public.ai_usage_logs(organization_id, created_at DESC);
CREATE INDEX idx_ai_usage_feature ON public.ai_usage_logs(feature, created_at DESC);
CREATE INDEX idx_ai_usage_user ON public.ai_usage_logs(user_id, created_at DESC) WHERE user_id IS NOT NULL;

-- RLS
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view org ai usage"
  ON public.ai_usage_logs FOR SELECT
  USING (user_is_org_admin(organization_id) OR user_id = auth.uid());

CREATE POLICY "System can insert ai usage"
  ON public.ai_usage_logs FOR INSERT
  WITH CHECK (true);

-- 5. AI SCORES - Tabela genérica para scores de IA
CREATE TABLE IF NOT EXISTS public.ai_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Entidade
  entity_type TEXT NOT NULL, -- lead, account, opportunity, contact
  entity_id UUID NOT NULL,
  
  -- Tipo de score
  score_type TEXT NOT NULL, -- lead_prioritization, deal_health, churn_risk, upsell_potential, etc.
  
  -- Score e status
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  status TEXT, -- healthy, attention, critical, high, medium, low
  grade TEXT, -- A, B, C, D, F
  
  -- Explicação
  reasons JSONB DEFAULT '[]'::jsonb, -- Lista de motivos
  factors JSONB DEFAULT '{}'::jsonb, -- Fatores detalhados com pesos
  explanation TEXT, -- Explicação em texto
  
  -- Recomendações
  recommendations JSONB DEFAULT '[]'::jsonb,
  next_actions JSONB DEFAULT '[]'::jsonb,
  
  -- Metadados
  model_version TEXT,
  confidence NUMERIC(3,2), -- 0.00 a 1.00
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ, -- Quando o score expira e precisa ser recalculado
  
  UNIQUE(entity_type, entity_id, score_type)
);

-- Índices
CREATE INDEX idx_ai_scores_entity ON public.ai_scores(entity_type, entity_id);
CREATE INDEX idx_ai_scores_type ON public.ai_scores(score_type, score DESC);
CREATE INDEX idx_ai_scores_org ON public.ai_scores(organization_id, score_type);

-- RLS
ALTER TABLE public.ai_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org ai scores"
  ON public.ai_scores FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage ai scores"
  ON public.ai_scores FOR ALL
  USING (true)
  WITH CHECK (true);

-- 6. FUNÇÃO get_revenue_context - RKG v0
CREATE OR REPLACE FUNCTION public.get_revenue_context(p_opportunity_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_opportunity RECORD;
  v_account RECORD;
  v_contacts JSONB;
  v_activities JSONB;
  v_proposals JSONB;
  v_conversations JSONB;
  v_scores JSONB;
  v_events JSONB;
BEGIN
  -- Buscar oportunidade
  SELECT 
    o.*,
    s.name as stage_name,
    s.probability as stage_probability,
    p.name as pipeline_name,
    p.pipeline_type,
    prof.full_name as owner_name
  INTO v_opportunity
  FROM opportunities o
  LEFT JOIN stages s ON o.stage_id = s.id
  LEFT JOIN pipelines p ON o.pipeline_id = p.id
  LEFT JOIN profiles prof ON o.owner_user_id = prof.user_id
  WHERE o.id = p_opportunity_id;
  
  IF v_opportunity IS NULL THEN
    RETURN jsonb_build_object('error', 'Opportunity not found');
  END IF;
  
  -- Buscar conta
  SELECT 
    a.id,
    a.razao_social,
    a.nome_fantasia,
    a.cnpj,
    a.segmento,
    a.porte,
    a.cidade,
    a.uf,
    a.fit_score,
    a.intent_score,
    a.lead_score,
    a.lead_grade,
    a.lifecycle_stage
  INTO v_account
  FROM accounts a
  WHERE a.id = v_opportunity.account_id;
  
  -- Buscar contatos relacionados
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'cargo', c.cargo,
    'emails', c.emails,
    'telefones', c.telefones
  )), '[]'::jsonb)
  INTO v_contacts
  FROM contacts c
  WHERE c.account_id = v_opportunity.account_id;
  
  -- Últimas 10 atividades
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id,
    'type', a.type,
    'title', a.title,
    'status', a.status,
    'scheduled_date', a.scheduled_date,
    'completed_at', a.completed_at,
    'sentiment', a.sentiment
  ) ORDER BY COALESCE(a.completed_at, a.scheduled_date) DESC), '[]'::jsonb)
  INTO v_activities
  FROM (
    SELECT * FROM activities 
    WHERE opportunity_id = p_opportunity_id 
    ORDER BY COALESCE(completed_at, scheduled_date) DESC 
    LIMIT 10
  ) a;
  
  -- Propostas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'title', p.title,
    'status', p.status,
    'value', p.total_amount,
    'created_at', p.created_at,
    'sent_at', p.sent_at,
    'viewed_at', p.viewed_at,
    'views_count', p.views_count
  ) ORDER BY p.created_at DESC), '[]'::jsonb)
  INTO v_proposals
  FROM proposals p
  WHERE p.opportunity_id = p_opportunity_id;
  
  -- Últimas conversas
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', cl.id,
    'channel', cl.channel,
    'direction', cl.direction,
    'subject', cl.subject,
    'summary', cl.summary,
    'sentiment', cl.sentiment,
    'created_at', cl.created_at
  ) ORDER BY cl.created_at DESC), '[]'::jsonb)
  INTO v_conversations
  FROM (
    SELECT * FROM conversation_logs 
    WHERE opportunity_id = p_opportunity_id 
    ORDER BY created_at DESC 
    LIMIT 10
  ) cl;
  
  -- Scores de IA
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'score_type', s.score_type,
    'score', s.score,
    'status', s.status,
    'grade', s.grade,
    'reasons', s.reasons,
    'created_at', s.created_at
  )), '[]'::jsonb)
  INTO v_scores
  FROM ai_scores s
  WHERE s.entity_type = 'opportunity' AND s.entity_id = p_opportunity_id;
  
  -- Últimos eventos de receita
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_type', re.event_type,
    'channel', re.channel,
    'payload', re.payload,
    'sentiment_score', re.sentiment_score,
    'created_at', re.created_at
  ) ORDER BY re.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT * FROM revenue_events 
    WHERE opportunity_id = p_opportunity_id 
    ORDER BY created_at DESC 
    LIMIT 20
  ) re;
  
  -- Montar resultado
  v_result := jsonb_build_object(
    'opportunity', jsonb_build_object(
      'id', v_opportunity.id,
      'title', v_opportunity.title,
      'status', v_opportunity.status,
      'stage', v_opportunity.stage_name,
      'stage_probability', v_opportunity.stage_probability,
      'pipeline', v_opportunity.pipeline_name,
      'pipeline_type', v_opportunity.pipeline_type,
      'value', v_opportunity.valor_previsto,
      'mrr', v_opportunity.mrr,
      'close_date', v_opportunity.close_date_prevista,
      'temperature', v_opportunity.temperature,
      'probability', v_opportunity.prob,
      'win_probability_ai', v_opportunity.win_probability_ai,
      'engagement_score', v_opportunity.engagement_score,
      'velocity_score', v_opportunity.velocity_score,
      'risk_score', v_opportunity.risk_score,
      'opportunity_score', v_opportunity.opportunity_score,
      'owner', v_opportunity.owner_name,
      'created_at', v_opportunity.created_at,
      'days_in_stage', v_opportunity.days_in_stage,
      'last_contact_date', v_opportunity.last_contact_date
    ),
    'account', CASE WHEN v_account IS NOT NULL THEN jsonb_build_object(
      'id', v_account.id,
      'name', COALESCE(v_account.nome_fantasia, v_account.razao_social),
      'cnpj', v_account.cnpj,
      'segment', v_account.segmento,
      'size', v_account.porte,
      'location', v_account.cidade || ' - ' || v_account.uf,
      'fit_score', v_account.fit_score,
      'intent_score', v_account.intent_score,
      'lead_score', v_account.lead_score,
      'lead_grade', v_account.lead_grade,
      'lifecycle_stage', v_account.lifecycle_stage
    ) ELSE NULL END,
    'contacts', v_contacts,
    'recent_activities', v_activities,
    'proposals', v_proposals,
    'conversations', v_conversations,
    'ai_scores', v_scores,
    'revenue_events', v_events,
    'summary', jsonb_build_object(
      'total_activities', (SELECT COUNT(*) FROM activities WHERE opportunity_id = p_opportunity_id),
      'completed_activities', (SELECT COUNT(*) FROM activities WHERE opportunity_id = p_opportunity_id AND status = 'completed'),
      'total_proposals', (SELECT COUNT(*) FROM proposals WHERE opportunity_id = p_opportunity_id),
      'sent_proposals', (SELECT COUNT(*) FROM proposals WHERE opportunity_id = p_opportunity_id AND status IN ('sent', 'viewed', 'accepted')),
      'days_since_creation', EXTRACT(DAY FROM (now() - v_opportunity.created_at)),
      'days_since_last_contact', CASE WHEN v_opportunity.last_contact_date IS NOT NULL 
        THEN EXTRACT(DAY FROM (now() - v_opportunity.last_contact_date))::INTEGER 
        ELSE NULL END,
      'avg_sentiment', (SELECT AVG(sentiment_score) FROM revenue_events WHERE opportunity_id = p_opportunity_id AND sentiment_score IS NOT NULL)
    ),
    'generated_at', now()
  );
  
  RETURN v_result;
END;
$$;

-- 7. TRIGGERS DE INSTRUMENTAÇÃO - Registrar eventos automaticamente

-- Trigger para mudanças de oportunidade
CREATE OR REPLACE FUNCTION public.log_opportunity_revenue_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criação de oportunidade
  IF TG_OP = 'INSERT' THEN
    INSERT INTO revenue_events (
      organization_id, account_id, contact_id, opportunity_id, user_id,
      channel, event_type, event_subtype, payload, source
    ) VALUES (
      NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, NEW.owner_user_id,
      'system', 'opportunity_created', NULL,
      jsonb_build_object('title', NEW.title, 'value', NEW.valor_previsto, 'stage_id', NEW.stage_id),
      'automation'
    );
    RETURN NEW;
  END IF;
  
  -- Atualização de oportunidade
  IF TG_OP = 'UPDATE' THEN
    -- Mudança de estágio
    IF OLD.stage_id IS DISTINCT FROM NEW.stage_id THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'stage_change', NULL,
        jsonb_build_object('old_stage', OLD.stage_id, 'new_stage', NEW.stage_id),
        'automation'
      );
    END IF;
    
    -- Ganho
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'won' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'win', NULL,
        jsonb_build_object('value', NEW.valor_previsto, 'mrr', NEW.mrr),
        NEW.valor_previsto,
        'automation'
      );
    END IF;
    
    -- Perda
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'lost' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'loss', NULL,
        jsonb_build_object('value', NEW.valor_previsto, 'loss_reason', NEW.loss_reason_id),
        -NEW.valor_previsto,
        'automation'
      );
    END IF;
    
    -- Mudança de valor
    IF OLD.valor_previsto IS DISTINCT FROM NEW.valor_previsto THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, source
      ) VALUES (
        NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.id, auth.uid(),
        'system', 'value_change', NULL,
        jsonb_build_object('old_value', OLD.valor_previsto, 'new_value', NEW.valor_previsto),
        COALESCE(NEW.valor_previsto, 0) - COALESCE(OLD.valor_previsto, 0),
        'automation'
      );
    END IF;
    
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_opportunity_revenue_event ON opportunities;
CREATE TRIGGER tr_opportunity_revenue_event
  AFTER INSERT OR UPDATE ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION log_opportunity_revenue_event();

-- Trigger para atividades
CREATE OR REPLACE FUNCTION public.log_activity_revenue_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_channel TEXT;
BEGIN
  -- Mapear tipo de atividade para canal
  v_channel := CASE NEW.type
    WHEN 'call' THEN 'call'
    WHEN 'email' THEN 'email'
    WHEN 'meeting' THEN 'meeting'
    WHEN 'whatsapp' THEN 'whatsapp'
    ELSE 'system'
  END;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO revenue_events (
      organization_id, account_id, contact_id, opportunity_id, user_id,
      channel, event_type, event_subtype, payload, engagement_value, source
    ) VALUES (
      NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.opportunity_id, NEW.owner_user_id,
      v_channel, 'activity', NEW.type,
      jsonb_build_object('title', NEW.title, 'status', NEW.status, 'scheduled_date', NEW.scheduled_date),
      CASE NEW.type WHEN 'meeting' THEN 30 WHEN 'call' THEN 20 WHEN 'email' THEN 10 ELSE 5 END,
      COALESCE(NEW.sync_source, 'manual')
    );
  END IF;
  
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'completed' THEN
    INSERT INTO revenue_events (
      organization_id, account_id, contact_id, opportunity_id, user_id,
      channel, event_type, event_subtype, payload, engagement_value, source
    ) VALUES (
      NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.opportunity_id, NEW.owner_user_id,
      v_channel, 'activity_completed', NEW.type,
      jsonb_build_object('title', NEW.title, 'duration_minutes', NEW.duration_minutes, 'sentiment', NEW.sentiment),
      CASE NEW.type WHEN 'meeting' THEN 50 WHEN 'call' THEN 40 WHEN 'email' THEN 15 ELSE 10 END,
      'automation'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_activity_revenue_event ON activities;
CREATE TRIGGER tr_activity_revenue_event
  AFTER INSERT OR UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION log_activity_revenue_event();

-- Trigger para propostas
CREATE OR REPLACE FUNCTION public.log_proposal_revenue_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp RECORD;
BEGIN
  -- Buscar dados da oportunidade
  SELECT account_id, contact_id INTO v_opp
  FROM opportunities WHERE id = NEW.opportunity_id;
  
  IF TG_OP = 'INSERT' THEN
    INSERT INTO revenue_events (
      organization_id, account_id, contact_id, opportunity_id, user_id,
      channel, event_type, event_subtype, payload, revenue_impact, source
    ) VALUES (
      NEW.organization_id, v_opp.account_id, v_opp.contact_id, NEW.opportunity_id, auth.uid(),
      'system', 'proposal_created', NULL,
      jsonb_build_object('title', NEW.title, 'value', NEW.total_amount),
      NEW.total_amount,
      'manual'
    );
  END IF;
  
  IF TG_OP = 'UPDATE' THEN
    -- Proposta enviada
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'sent' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, engagement_value, source
      ) VALUES (
        NEW.organization_id, v_opp.account_id, v_opp.contact_id, NEW.opportunity_id, auth.uid(),
        'email', 'proposal_sent', NULL,
        jsonb_build_object('title', NEW.title, 'value', NEW.total_amount),
        40,
        'automation'
      );
    END IF;
    
    -- Proposta visualizada
    IF OLD.views_count IS DISTINCT FROM NEW.views_count AND NEW.views_count > OLD.views_count THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, engagement_value, source
      ) VALUES (
        NEW.organization_id, v_opp.account_id, v_opp.contact_id, NEW.opportunity_id, NULL,
        'web', 'proposal_viewed', NULL,
        jsonb_build_object('title', NEW.title, 'views_count', NEW.views_count),
        25,
        'automation'
      );
    END IF;
    
    -- Proposta aceita
    IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'accepted' THEN
      INSERT INTO revenue_events (
        organization_id, account_id, contact_id, opportunity_id, user_id,
        channel, event_type, event_subtype, payload, revenue_impact, engagement_value, source
      ) VALUES (
        NEW.organization_id, v_opp.account_id, v_opp.contact_id, NEW.opportunity_id, NULL,
        'web', 'proposal_accepted', NULL,
        jsonb_build_object('title', NEW.title, 'value', NEW.total_amount, 'acceptor', NEW.acceptor_name),
        NEW.total_amount,
        100,
        'automation'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_proposal_revenue_event ON proposals;
CREATE TRIGGER tr_proposal_revenue_event
  AFTER INSERT OR UPDATE ON proposals
  FOR EACH ROW
  EXECUTE FUNCTION log_proposal_revenue_event();

-- 8. Habilitar realtime para tabelas críticas
ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_scores;
