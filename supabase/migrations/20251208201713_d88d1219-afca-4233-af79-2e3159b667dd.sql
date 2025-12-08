
-- =============================================
-- SISTEMA OTE (On Target Earnings) - Tabelas
-- =============================================

-- 1. Tabela de Níveis OTE (Cargos)
CREATE TABLE public.ote_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  level_name TEXT NOT NULL,
  level_code TEXT NOT NULL,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  variable_target NUMERIC NOT NULL DEFAULT 0,
  monthly_goal NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, level_code)
);

-- 2. Tabela de Multiplicadores OTE
CREATE TABLE public.ote_multipliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  min_percentage NUMERIC NOT NULL,
  max_percentage NUMERIC NOT NULL,
  multiplier NUMERIC NOT NULL,
  description TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Configuração OTE por Vendedor
CREATE TABLE public.ote_seller_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  ote_level_id UUID REFERENCES public.ote_levels(id) ON DELETE SET NULL,
  custom_goal_override NUMERIC,
  custom_variable_override NUMERIC,
  effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Resultados Mensais OTE
CREATE TABLE public.ote_monthly_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_month TEXT NOT NULL, -- Format: 2025-01
  ote_level_id UUID REFERENCES public.ote_levels(id) ON DELETE SET NULL,
  level_name_snapshot TEXT,
  
  -- Valores de Vendas
  total_sales NUMERIC NOT NULL DEFAULT 0,
  goal_amount NUMERIC NOT NULL DEFAULT 0,
  achievement_percentage NUMERIC NOT NULL DEFAULT 0,
  
  -- Multiplicador OTE
  ote_multiplier NUMERIC NOT NULL DEFAULT 0,
  base_variable NUMERIC NOT NULL DEFAULT 0,
  
  -- Flags
  flag_color TEXT CHECK (flag_color IN ('blue', 'yellow', 'red')),
  flag_reason TEXT,
  
  -- Aceleradores/Desaceleradores
  roleplay_score NUMERIC,
  roleplay_accelerator NUMERIC DEFAULT 0,
  crm_completion_score NUMERIC,
  crm_accelerator NUMERIC DEFAULT 0,
  fitscore_avg NUMERIC,
  fitscore_accelerator NUMERIC DEFAULT 0,
  training_score NUMERIC,
  training_accelerator NUMERIC DEFAULT 0,
  
  -- Totais
  total_accelerator_percentage NUMERIC DEFAULT 0,
  total_decelerator_percentage NUMERIC DEFAULT 0,
  final_adjustment_percentage NUMERIC DEFAULT 0,
  final_variable_amount NUMERIC NOT NULL DEFAULT 0,
  
  -- Auditoria
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  calculated_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'paid', 'disputed')),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, period_month)
);

-- 5. Registro de Vendas para OTE
CREATE TABLE public.ote_sales_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ote_result_id UUID NOT NULL REFERENCES public.ote_monthly_results(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  proposal_id UUID REFERENCES public.proposals(id) ON DELETE SET NULL,
  proposal_number TEXT,
  client_name TEXT NOT NULL,
  sale_value NUMERIC NOT NULL,
  sale_date DATE NOT NULL,
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partial', 'cancelled')),
  payment_date DATE,
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 6. Configurações de Regras OTE
CREATE TABLE public.ote_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  rule_type TEXT NOT NULL CHECK (rule_type IN ('flag', 'accelerator', 'decelerator')),
  rule_name TEXT NOT NULL,
  condition_field TEXT NOT NULL,
  condition_operator TEXT NOT NULL CHECK (condition_operator IN ('>=', '<=', '>', '<', '=', 'between')),
  condition_value NUMERIC,
  condition_value_max NUMERIC,
  effect_type TEXT CHECK (effect_type IN ('percentage', 'fixed', 'flag_color')),
  effect_value NUMERIC,
  effect_flag_color TEXT,
  priority INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ote_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_multipliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_seller_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_monthly_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_sales_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ote_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org ote_levels" ON public.ote_levels FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage ote_levels" ON public.ote_levels FOR ALL USING (user_is_org_admin(organization_id)) WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org ote_multipliers" ON public.ote_multipliers FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage ote_multipliers" ON public.ote_multipliers FOR ALL USING (user_is_org_admin(organization_id)) WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org ote_seller_config" ON public.ote_seller_config FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage ote_seller_config" ON public.ote_seller_config FOR ALL USING (user_is_org_admin(organization_id)) WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view own or admin can view all ote_monthly_results" ON public.ote_monthly_results FOR SELECT USING (organization_id = get_user_organization_id() AND (user_id = auth.uid() OR user_is_org_admin(organization_id)));
CREATE POLICY "System can manage ote_monthly_results" ON public.ote_monthly_results FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can view ote_sales_records" ON public.ote_sales_records FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "System can manage ote_sales_records" ON public.ote_sales_records FOR ALL USING (organization_id = get_user_organization_id()) WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can view org ote_rules" ON public.ote_rules FOR SELECT USING (organization_id = get_user_organization_id());
CREATE POLICY "Admins can manage ote_rules" ON public.ote_rules FOR ALL USING (user_is_org_admin(organization_id)) WITH CHECK (user_is_org_admin(organization_id));

-- Indexes
CREATE INDEX idx_ote_levels_org ON public.ote_levels(organization_id);
CREATE INDEX idx_ote_multipliers_org ON public.ote_multipliers(organization_id);
CREATE INDEX idx_ote_seller_config_user ON public.ote_seller_config(user_id);
CREATE INDEX idx_ote_monthly_results_period ON public.ote_monthly_results(organization_id, period_month);
CREATE INDEX idx_ote_monthly_results_user ON public.ote_monthly_results(user_id, period_month);
CREATE INDEX idx_ote_sales_records_result ON public.ote_sales_records(ote_result_id);

-- Triggers for updated_at
CREATE TRIGGER update_ote_levels_updated_at BEFORE UPDATE ON public.ote_levels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ote_multipliers_updated_at BEFORE UPDATE ON public.ote_multipliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ote_seller_config_updated_at BEFORE UPDATE ON public.ote_seller_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ote_monthly_results_updated_at BEFORE UPDATE ON public.ote_monthly_results FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ote_sales_records_updated_at BEFORE UPDATE ON public.ote_sales_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_ote_rules_updated_at BEFORE UPDATE ON public.ote_rules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
