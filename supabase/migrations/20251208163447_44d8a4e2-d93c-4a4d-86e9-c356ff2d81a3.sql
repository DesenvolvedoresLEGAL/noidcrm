-- Create ai_playbooks table for storing playbook templates
CREATE TABLE public.ai_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_conditions JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  target_persona TEXT,
  target_stage TEXT,
  target_temperature TEXT,
  success_metrics JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  is_ai_generated BOOLEAN DEFAULT false,
  usage_count INTEGER DEFAULT 0,
  success_rate NUMERIC DEFAULT 0,
  avg_deal_value NUMERIC DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create playbook_executions table to track when playbooks are used
CREATE TABLE public.playbook_executions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  playbook_id UUID NOT NULL REFERENCES public.ai_playbooks(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'in_progress',
  current_step INTEGER DEFAULT 0,
  steps_completed JSONB DEFAULT '[]'::jsonb,
  outcome TEXT,
  outcome_value NUMERIC,
  notes TEXT,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.ai_playbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_executions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_playbooks
CREATE POLICY "Users can view org playbooks"
  ON public.ai_playbooks FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org playbooks"
  ON public.ai_playbooks FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org playbooks"
  ON public.ai_playbooks FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org playbooks"
  ON public.ai_playbooks FOR DELETE
  USING (user_is_org_admin(organization_id));

-- RLS Policies for playbook_executions
CREATE POLICY "Users can view org executions"
  ON public.playbook_executions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create executions"
  ON public.playbook_executions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update own executions"
  ON public.playbook_executions FOR UPDATE
  USING (user_id = auth.uid() OR user_is_org_admin(organization_id));

-- Indexes
CREATE INDEX idx_ai_playbooks_org ON public.ai_playbooks(organization_id);
CREATE INDEX idx_ai_playbooks_active ON public.ai_playbooks(organization_id, is_active);
CREATE INDEX idx_playbook_executions_playbook ON public.playbook_executions(playbook_id);
CREATE INDEX idx_playbook_executions_opportunity ON public.playbook_executions(opportunity_id);

-- Trigger for updated_at
CREATE TRIGGER update_ai_playbooks_updated_at
  BEFORE UPDATE ON public.ai_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();