-- Sprint 1: Daily AI Briefing, Auto Task Creation, AI Form Fill, Pipeline Cleanup

-- Tabela para histórico de briefings diários
CREATE TABLE IF NOT EXISTS public.daily_briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  briefing_date DATE NOT NULL,
  priority_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  hot_opportunities JSONB NOT NULL DEFAULT '[]'::jsonb,
  at_risk_deals JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary TEXT,
  tasks_created INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, user_id, briefing_date)
);

-- Tabela para sugestões da AI (form fill, stage progression, cleanup)
CREATE TABLE IF NOT EXISTS public.ai_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  suggestion_type TEXT NOT NULL, -- 'field_update', 'stage_progression', 'pipeline_cleanup'
  entity_type TEXT, -- 'opportunity', 'activity', etc
  entity_id UUID,
  field_name TEXT,
  current_value JSONB,
  suggested_value JSONB,
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00
  reasoning TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
  action_taken_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_daily_briefings_user_date ON public.daily_briefings(user_id, briefing_date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_briefings_org ON public.daily_briefings(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_status ON public.ai_suggestions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_opportunity ON public.ai_suggestions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_type_status ON public.ai_suggestions(suggestion_type, status);
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_expires ON public.ai_suggestions(expires_at) WHERE status = 'pending';

-- Enable RLS
ALTER TABLE public.daily_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies para daily_briefings
CREATE POLICY "Users can view own briefings"
  ON public.daily_briefings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert briefings"
  ON public.daily_briefings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view org briefings"
  ON public.daily_briefings FOR SELECT
  USING (user_is_org_admin(organization_id));

-- RLS Policies para ai_suggestions
CREATE POLICY "Users can view own suggestions"
  ON public.ai_suggestions FOR SELECT
  USING (auth.uid() = user_id OR user_is_org_admin(organization_id));

CREATE POLICY "Users can update own suggestions"
  ON public.ai_suggestions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert suggestions"
  ON public.ai_suggestions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "System can update suggestions"
  ON public.ai_suggestions FOR UPDATE
  USING (true);

-- Trigger para updated_at em ai_suggestions
CREATE TRIGGER update_ai_suggestions_updated_at
  BEFORE UPDATE ON public.ai_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();