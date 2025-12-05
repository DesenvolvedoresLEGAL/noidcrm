-- Create AI Actions table for tracking all AI decisions with confidence
CREATE TABLE public.ai_actions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'lead_routing', 'stage_change', 'follow_up', 'email_send', 'task_create', 'score_update'
  entity_type TEXT, -- 'opportunity', 'account', 'contact', 'activity'
  entity_id UUID,
  confidence_score NUMERIC(3,2) NOT NULL DEFAULT 0.5, -- 0.00 to 1.00
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'auto_executed', 'executed_notified', 'awaiting_approval', 'approved', 'rejected', 'overridden'
  decision_data JSONB NOT NULL DEFAULT '{}', -- What the AI decided
  context_data JSONB DEFAULT '{}', -- Why the AI made this decision
  executed_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID,
  approved_at TIMESTAMP WITH TIME ZONE,
  override_data JSONB, -- Human correction data
  override_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Feedback table for learning from overrides
CREATE TABLE public.ai_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  ai_action_id UUID REFERENCES public.ai_actions(id) ON DELETE SET NULL,
  feedback_type TEXT NOT NULL, -- 'correction', 'approval', 'rejection', 'rating'
  original_decision JSONB NOT NULL,
  corrected_decision JSONB,
  feedback_reason TEXT,
  feedback_rating INTEGER, -- 1-5 scale
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create AI Alerts table for intelligent alerts
CREATE TABLE public.ai_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL, -- Who should see this alert
  alert_type TEXT NOT NULL, -- 'high_value_risk', 'exception', 'imminent_close', 'performance_below', 'escalation'
  priority TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  metadata JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ai_actions
CREATE POLICY "Users can view org ai_actions" ON public.ai_actions
  FOR SELECT USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert org ai_actions" ON public.ai_actions
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update org ai_actions" ON public.ai_actions
  FOR UPDATE USING (organization_id = public.get_user_organization_id());

-- RLS Policies for ai_feedback
CREATE POLICY "Users can view org ai_feedback" ON public.ai_feedback
  FOR SELECT USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert org ai_feedback" ON public.ai_feedback
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- RLS Policies for ai_alerts
CREATE POLICY "Users can view own ai_alerts" ON public.ai_alerts
  FOR SELECT USING (user_id = auth.uid() OR organization_id = public.get_user_organization_id());

CREATE POLICY "System can insert ai_alerts" ON public.ai_alerts
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own ai_alerts" ON public.ai_alerts
  FOR UPDATE USING (user_id = auth.uid());

-- Indexes for performance
CREATE INDEX idx_ai_actions_org_status ON public.ai_actions(organization_id, status);
CREATE INDEX idx_ai_actions_confidence ON public.ai_actions(confidence_score);
CREATE INDEX idx_ai_actions_created ON public.ai_actions(created_at DESC);
CREATE INDEX idx_ai_alerts_user_status ON public.ai_alerts(user_id, status);
CREATE INDEX idx_ai_alerts_priority ON public.ai_alerts(priority, created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_ai_actions_updated_at
  BEFORE UPDATE ON public.ai_actions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();