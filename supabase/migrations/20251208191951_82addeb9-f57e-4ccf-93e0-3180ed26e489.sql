-- Create sales_goals table for configurable targets
CREATE TABLE public.sales_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  pipeline_id TEXT DEFAULT NULL,
  period_type TEXT NOT NULL DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  target_value NUMERIC NOT NULL DEFAULT 0,
  target_deals INTEGER DEFAULT NULL,
  target_mrr NUMERIC DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sales_goals ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org sales goals"
  ON public.sales_goals FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can manage sales goals"
  ON public.sales_goals FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

-- Index for performance
CREATE INDEX idx_sales_goals_org_period ON public.sales_goals(organization_id, period_start, period_end);
CREATE INDEX idx_sales_goals_user ON public.sales_goals(user_id) WHERE user_id IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER update_sales_goals_updated_at
  BEFORE UPDATE ON public.sales_goals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();