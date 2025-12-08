-- Create ai_forecast_logs table for tracking AI forecast predictions
CREATE TABLE public.ai_forecast_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  pipeline_id UUID,
  forecast_type TEXT NOT NULL DEFAULT 'quarterly',
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  pessimistic_value NUMERIC NOT NULL DEFAULT 0,
  realistic_value NUMERIC NOT NULL DEFAULT 0,
  optimistic_value NUMERIC NOT NULL DEFAULT 0,
  confidence_score NUMERIC DEFAULT 0,
  model_version TEXT DEFAULT 'v1',
  input_data JSONB DEFAULT '{}'::jsonb,
  ai_reasoning TEXT,
  factors JSONB DEFAULT '[]'::jsonb,
  recommendations JSONB DEFAULT '[]'::jsonb,
  accuracy_score NUMERIC,
  actual_value NUMERIC,
  evaluated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_forecast_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org forecast logs"
  ON public.ai_forecast_logs FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert forecast logs"
  ON public.ai_forecast_logs FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage forecast logs"
  ON public.ai_forecast_logs FOR ALL
  USING (user_is_org_admin(organization_id));

-- Index for performance
CREATE INDEX idx_ai_forecast_logs_org_period ON public.ai_forecast_logs(organization_id, period_start, period_end);
CREATE INDEX idx_ai_forecast_logs_pipeline ON public.ai_forecast_logs(pipeline_id);