-- =============================================
-- Win/Loss Advanced Tables
-- =============================================

-- Tabela para entrevistas Win/Loss
CREATE TABLE public.winloss_interviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  win_loss_record_id UUID REFERENCES public.win_loss_records(id) ON DELETE SET NULL,
  interview_type TEXT NOT NULL CHECK (interview_type IN ('win', 'loss', 'churn')),
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp', 'audio', 'voip', 'form', 'email')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'in_progress', 'completed', 'declined', 'expired')),
  questions JSONB DEFAULT '[]'::jsonb,
  responses JSONB DEFAULT '[]'::jsonb,
  sentiment_score NUMERIC,
  transcript TEXT,
  ai_summary TEXT,
  ai_insights JSONB DEFAULT '[]'::jsonb,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para fatores de Win/Loss (ranking)
CREATE TABLE public.winloss_factors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  factor_type TEXT NOT NULL CHECK (factor_type IN ('win', 'loss')),
  category TEXT NOT NULL CHECK (category IN ('price', 'timing', 'feature', 'relationship', 'support', 'brand', 'integration', 'other')),
  name TEXT NOT NULL,
  description TEXT,
  frequency INTEGER NOT NULL DEFAULT 0,
  impact_score NUMERIC DEFAULT 0,
  revenue_impact NUMERIC DEFAULT 0,
  win_rate_impact NUMERIC DEFAULT 0,
  is_ai_generated BOOLEAN DEFAULT false,
  last_calculated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para simulações de impacto em receita
CREATE TABLE public.winloss_revenue_simulations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  simulation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  current_win_rate NUMERIC NOT NULL,
  projected_win_rate NUMERIC NOT NULL,
  current_revenue NUMERIC NOT NULL,
  projected_revenue NUMERIC NOT NULL,
  revenue_increment NUMERIC NOT NULL,
  improvements JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  ai_analysis TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.winloss_interviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winloss_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winloss_revenue_simulations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for winloss_interviews
CREATE POLICY "Users can view org interviews"
  ON public.winloss_interviews FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org interviews"
  ON public.winloss_interviews FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org interviews"
  ON public.winloss_interviews FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org interviews"
  ON public.winloss_interviews FOR DELETE
  USING (user_is_org_admin(organization_id));

-- RLS Policies for winloss_factors
CREATE POLICY "Users can view org factors"
  ON public.winloss_factors FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage factors"
  ON public.winloss_factors FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for winloss_revenue_simulations
CREATE POLICY "Users can view org simulations"
  ON public.winloss_revenue_simulations FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org simulations"
  ON public.winloss_revenue_simulations FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

-- Indexes
CREATE INDEX idx_winloss_interviews_org ON public.winloss_interviews(organization_id);
CREATE INDEX idx_winloss_interviews_status ON public.winloss_interviews(status);
CREATE INDEX idx_winloss_interviews_type ON public.winloss_interviews(interview_type);
CREATE INDEX idx_winloss_factors_org ON public.winloss_factors(organization_id);
CREATE INDEX idx_winloss_factors_type ON public.winloss_factors(factor_type);
CREATE INDEX idx_winloss_simulations_org ON public.winloss_revenue_simulations(organization_id);

-- Updated at trigger
CREATE TRIGGER update_winloss_interviews_updated_at
  BEFORE UPDATE ON public.winloss_interviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_winloss_factors_updated_at
  BEFORE UPDATE ON public.winloss_factors
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();