-- Table for configurable auto task rules
CREATE TABLE IF NOT EXISTS public.auto_tasks_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  rule_type TEXT NOT NULL, -- 'stale_opportunity', 'high_score_lead', 'meeting_prep', 'proposal_reminder', 'custom'
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Trigger conditions
  trigger_conditions JSONB NOT NULL DEFAULT '{}',
  -- Example: { "days_without_contact": 3, "min_score": 80, "temperature": ["cold", "warm"] }
  
  -- Task template
  task_template JSONB NOT NULL DEFAULT '{}',
  -- Example: { "type": "call", "title_pattern": "Follow-up: {opportunity_title}", "description": "..." }
  
  -- Execution settings
  execution_frequency TEXT DEFAULT 'daily', -- 'realtime', 'hourly', 'daily'
  max_tasks_per_day INTEGER DEFAULT 10,
  last_executed_at TIMESTAMPTZ,
  executions_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.auto_tasks_rules ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage auto task rules"
  ON public.auto_tasks_rules FOR ALL
  USING (user_is_org_admin(organization_id))
  WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Users can view org auto task rules"
  ON public.auto_tasks_rules FOR SELECT
  USING (organization_id = get_user_organization_id());

-- Insert default rules
INSERT INTO public.auto_tasks_rules (organization_id, name, description, rule_type, trigger_conditions, task_template)
SELECT 
  o.id,
  'Follow-up Leads Inativos',
  'Cria tarefa de follow-up para oportunidades sem contato há mais de 3 dias',
  'stale_opportunity',
  '{"days_without_contact": 3, "status": ["open", "in_progress"]}',
  '{"type": "call", "title_pattern": "Follow-up: {opportunity_title}", "description": "Oportunidade sem contato há {days} dias. Fazer follow-up urgente."}'
FROM organizations o
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_tasks_rules (organization_id, name, description, rule_type, trigger_conditions, task_template)
SELECT 
  o.id,
  'Contato Prioritário Lead A/B',
  'Cria tarefa de contato imediato para leads grade A ou B sem atividade',
  'high_score_lead',
  '{"min_lead_score": 70, "lead_grades": ["A", "B"], "no_activity": true}',
  '{"type": "call", "title_pattern": "Contato prioritário: {account_name}", "description": "Lead de alta qualidade sem atividade. Contatar imediatamente."}'
FROM organizations o
ON CONFLICT DO NOTHING;

INSERT INTO public.auto_tasks_rules (organization_id, name, description, rule_type, trigger_conditions, task_template)
SELECT 
  o.id,
  'Preparação de Reunião',
  'Cria tarefa de preparação 2h antes de reuniões agendadas',
  'meeting_prep',
  '{"hours_before": 2}',
  '{"type": "task", "title_pattern": "Preparar reunião: {activity_title}", "description": "Revisar histórico, preparar pontos de discussão e materiais."}'
FROM organizations o
ON CONFLICT DO NOTHING;

-- Add trigger for updated_at
CREATE TRIGGER update_auto_tasks_rules_updated_at
  BEFORE UPDATE ON public.auto_tasks_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();