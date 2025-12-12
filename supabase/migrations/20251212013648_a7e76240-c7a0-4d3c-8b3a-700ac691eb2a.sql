
-- =============================================
-- PAINEL DE CONTROLE DE VENDAS - INFRAESTRUTURA
-- =============================================

-- 1. Tabela de Configurações de Vendas (taxas de conversão, ticket médio, etc.)
CREATE TABLE public.sales_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Metas globais
  monthly_revenue_target NUMERIC DEFAULT 0,
  average_ticket NUMERIC DEFAULT 0,
  working_days_per_month INTEGER DEFAULT 20,
  
  -- Taxas de conversão OUTBOUND
  outbound_call_to_lead NUMERIC DEFAULT 0.30,
  outbound_lead_to_mql NUMERIC DEFAULT 0.79,
  outbound_mql_to_proposal NUMERIC DEFAULT 0.90,
  outbound_proposal_to_sale NUMERIC DEFAULT 0.54,
  
  -- Taxas de conversão INBOUND
  inbound_lead_to_mql NUMERIC DEFAULT 0.87,
  inbound_mql_to_proposal NUMERIC DEFAULT 0.90,
  inbound_proposal_to_sale NUMERIC DEFAULT 0.58,
  
  -- Taxas de conversão INDICAÇÃO
  referral_request_to_lead NUMERIC DEFAULT 0.35,
  referral_lead_to_proposal NUMERIC DEFAULT 0.90,
  referral_proposal_to_sale NUMERIC DEFAULT 0.70,
  
  -- Distribuição de receita por canal (deve somar 1.0)
  revenue_share_outbound NUMERIC DEFAULT 0.23,
  revenue_share_inbound NUMERIC DEFAULT 0.72,
  revenue_share_referral NUMERIC DEFAULT 0.05,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- 2. Tabela de Metas por Vendedor
CREATE TABLE public.seller_targets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_month DATE NOT NULL, -- Primeiro dia do mês (ex: 2025-01-01)
  
  -- Metas de receita
  monthly_revenue_target NUMERIC DEFAULT 0,
  revenue_share NUMERIC DEFAULT 0.25, -- % do total que esse vendedor deve entregar
  
  -- Metas de atividades diárias
  daily_calls_target INTEGER DEFAULT 15,
  daily_leads_target INTEGER DEFAULT 4,
  daily_proposals_target INTEGER DEFAULT 3,
  daily_sales_target INTEGER DEFAULT 2,
  daily_revenue_target NUMERIC DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, user_id, period_month)
);

-- 3. Tabela de Feriados
CREATE TABLE public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  holiday_date DATE NOT NULL,
  name TEXT NOT NULL,
  is_national BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, holiday_date)
);

-- 4. Tabela de Registro de Atividades Diárias (PACE)
CREATE TABLE public.daily_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  log_date DATE NOT NULL,
  
  -- Métricas realizadas
  calls_made INTEGER DEFAULT 0,
  leads_generated INTEGER DEFAULT 0,
  proposals_sent INTEGER DEFAULT 0,
  sales_closed INTEGER DEFAULT 0,
  revenue_closed NUMERIC DEFAULT 0,
  
  -- Métricas por canal
  outbound_calls INTEGER DEFAULT 0,
  inbound_leads INTEGER DEFAULT 0,
  referral_requests INTEGER DEFAULT 0,
  
  -- Score calculado automaticamente
  pace_score TEXT DEFAULT 'pending', -- 'red', 'yellow', 'green', 'pending'
  pace_percentage NUMERIC DEFAULT 0,
  
  notes TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(organization_id, user_id, log_date)
);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.sales_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_activity_log ENABLE ROW LEVEL SECURITY;

-- Sales Config: Admins podem gerenciar, todos podem ver
CREATE POLICY "Admins can manage sales_config"
  ON public.sales_config FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org sales_config"
  ON public.sales_config FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Seller Targets: Admins/Managers podem gerenciar, todos podem ver
CREATE POLICY "Admins and managers can manage seller_targets"
  ON public.seller_targets FOR ALL
  USING (user_is_org_admin_or_manager(organization_id))
  WITH CHECK (user_is_org_admin_or_manager(organization_id));

CREATE POLICY "Users can view org seller_targets"
  ON public.seller_targets FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Holidays: Admins podem gerenciar, todos podem ver
CREATE POLICY "Admins can manage holidays"
  ON public.holidays FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org holidays"
  ON public.holidays FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Daily Activity Log: Users podem gerenciar próprio, managers/admins podem ver todos
CREATE POLICY "Users can manage own daily_activity_log"
  ON public.daily_activity_log FOR ALL
  USING (
    organization_id = get_user_organization_id() AND
    (user_id = auth.uid() OR user_is_org_admin_or_manager(organization_id))
  )
  WITH CHECK (
    organization_id = get_user_organization_id() AND
    (user_id = auth.uid() OR user_is_org_admin_or_manager(organization_id))
  );

CREATE POLICY "Managers can view team daily_activity_log"
  ON public.daily_activity_log FOR SELECT
  USING (
    organization_id = get_user_organization_id() AND
    (user_id = auth.uid() OR user_is_org_admin_or_manager(organization_id))
  );

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_sales_config_updated_at
  BEFORE UPDATE ON public.sales_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_seller_targets_updated_at
  BEFORE UPDATE ON public.seller_targets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_daily_activity_log_updated_at
  BEFORE UPDATE ON public.daily_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- ÍNDICES
-- =============================================

CREATE INDEX idx_seller_targets_user_period ON public.seller_targets(user_id, period_month);
CREATE INDEX idx_daily_activity_log_user_date ON public.daily_activity_log(user_id, log_date);
CREATE INDEX idx_holidays_date ON public.holidays(organization_id, holiday_date);
