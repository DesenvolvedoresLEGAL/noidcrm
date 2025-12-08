-- Create cs_health_metrics table for NPS, CSAT, CES tracking
CREATE TABLE public.cs_health_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('nps', 'csat', 'ces')),
  score NUMERIC NOT NULL,
  survey_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  survey_channel TEXT,
  respondent_contact_id UUID REFERENCES public.contacts(id),
  feedback_text TEXT,
  follow_up_required BOOLEAN DEFAULT false,
  follow_up_completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create success_plans table
CREATE TABLE public.success_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  cs_owner_id UUID,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'paused', 'cancelled')),
  start_date DATE,
  target_completion_date DATE,
  completed_at TIMESTAMPTZ,
  goals JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb,
  success_criteria JSONB DEFAULT '[]'::jsonb,
  health_score NUMERIC,
  churn_risk_score NUMERIC,
  last_health_check_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create churn_predictions table
CREATE TABLE public.churn_predictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  prediction_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  churn_probability NUMERIC NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  risk_factors JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  model_version TEXT,
  confidence_score NUMERIC,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.cs_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.success_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.churn_predictions ENABLE ROW LEVEL SECURITY;

-- RLS policies for cs_health_metrics
CREATE POLICY "cs_health_metrics_select" ON public.cs_health_metrics
  FOR SELECT USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "cs_health_metrics_insert" ON public.cs_health_metrics
  FOR INSERT WITH CHECK (organization_id IS NOT NULL AND auth.uid() IS NOT NULL);

CREATE POLICY "cs_health_metrics_update" ON public.cs_health_metrics
  FOR UPDATE USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "cs_health_metrics_delete" ON public.cs_health_metrics
  FOR DELETE USING (organization_id = (SELECT get_user_organization_id()));

-- RLS policies for success_plans
CREATE POLICY "success_plans_select" ON public.success_plans
  FOR SELECT USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "success_plans_insert" ON public.success_plans
  FOR INSERT WITH CHECK (organization_id IS NOT NULL AND auth.uid() IS NOT NULL);

CREATE POLICY "success_plans_update" ON public.success_plans
  FOR UPDATE USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "success_plans_delete" ON public.success_plans
  FOR DELETE USING (organization_id = (SELECT get_user_organization_id()));

-- RLS policies for churn_predictions
CREATE POLICY "churn_predictions_select" ON public.churn_predictions
  FOR SELECT USING (organization_id = (SELECT get_user_organization_id()));

CREATE POLICY "churn_predictions_insert" ON public.churn_predictions
  FOR INSERT WITH CHECK (organization_id IS NOT NULL);

-- Indexes
CREATE INDEX idx_cs_health_metrics_account ON public.cs_health_metrics(account_id);
CREATE INDEX idx_cs_health_metrics_org_date ON public.cs_health_metrics(organization_id, survey_date DESC);
CREATE INDEX idx_success_plans_account ON public.success_plans(account_id);
CREATE INDEX idx_success_plans_org_status ON public.success_plans(organization_id, status);
CREATE INDEX idx_churn_predictions_account ON public.churn_predictions(account_id);
CREATE INDEX idx_churn_predictions_org_risk ON public.churn_predictions(organization_id, risk_level);