-- ========================================
-- PLG SCORE ENGINE - DATABASE STRUCTURE
-- ========================================

-- 1. Create plg_events table to track product events
CREATE TABLE public.plg_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  event_type TEXT NOT NULL CHECK (event_type IN ('activation', 'engagement', 'adoption', 'intent')),
  event_name TEXT NOT NULL,
  event_category TEXT CHECK (event_category IN ('core', 'advanced', 'premium')),
  
  points INTEGER NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plg_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plg_events
CREATE POLICY "Users can view their organization plg_events" 
ON public.plg_events FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert plg_events for their organization" 
ON public.plg_events FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Indexes for performance
CREATE INDEX idx_plg_events_org ON public.plg_events(organization_id);
CREATE INDEX idx_plg_events_opp ON public.plg_events(opportunity_id);
CREATE INDEX idx_plg_events_type ON public.plg_events(event_type);
CREATE INDEX idx_plg_events_created ON public.plg_events(created_at);

-- 2. Create plg_score_config table for configurable weights
CREATE TABLE public.plg_score_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  
  -- Category weights (should sum to 100)
  activation_weight INTEGER DEFAULT 25 CHECK (activation_weight >= 0 AND activation_weight <= 100),
  engagement_weight INTEGER DEFAULT 30 CHECK (engagement_weight >= 0 AND engagement_weight <= 100),
  adoption_weight INTEGER DEFAULT 25 CHECK (adoption_weight >= 0 AND adoption_weight <= 100),
  intent_weight INTEGER DEFAULT 20 CHECK (intent_weight >= 0 AND intent_weight <= 100),
  
  -- Scoring rules per category
  scoring_rules JSONB DEFAULT '{
    "activation": {
      "org_created": 5,
      "user_invited": 10,
      "first_core_action": 10
    },
    "engagement": {
      "max_dau_wau": 10,
      "max_active_days": 10,
      "max_sessions": 10
    },
    "adoption": {
      "core_feature": 5,
      "advanced_feature": 8,
      "premium_feature": 12
    },
    "intent": {
      "pricing_viewed": 5,
      "upgrade_clicked": 8,
      "contact_requested": 7
    }
  }'::jsonb,
  
  -- Features categorization
  feature_categories JSONB DEFAULT '{
    "core": ["opportunities", "activities", "contacts", "proposals", "accounts"],
    "advanced": ["automation", "scoring", "reports", "territories", "workflows"],
    "premium": ["ai_coach", "roleplay", "forecast", "integrations", "playbooks"]
  }'::jsonb,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(organization_id)
);

-- Enable RLS
ALTER TABLE public.plg_score_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plg_score_config
CREATE POLICY "Users can view their organization plg_score_config" 
ON public.plg_score_config FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can manage their organization plg_score_config" 
ON public.plg_score_config FOR ALL 
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- 3. Create plg_score_history table for score tracking
CREATE TABLE public.plg_score_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE SET NULL,
  
  score_current INTEGER NOT NULL DEFAULT 0 CHECK (score_current >= 0 AND score_current <= 100),
  score_max INTEGER NOT NULL DEFAULT 0 CHECK (score_max >= 0 AND score_max <= 100),
  score_avg NUMERIC(5,2) NOT NULL DEFAULT 0,
  
  -- Category breakdown
  activation_score INTEGER DEFAULT 0 CHECK (activation_score >= 0),
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0),
  adoption_score INTEGER DEFAULT 0 CHECK (adoption_score >= 0),
  intent_score INTEGER DEFAULT 0 CHECK (intent_score >= 0),
  
  classification TEXT CHECK (classification IN ('hot', 'warm', 'cold')),
  
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plg_score_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plg_score_history
CREATE POLICY "Users can view their organization plg_score_history" 
ON public.plg_score_history FOR SELECT 
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

CREATE POLICY "Users can insert plg_score_history for their organization" 
ON public.plg_score_history FOR INSERT 
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE user_id = auth.uid()
));

-- Indexes for plg_score_history
CREATE INDEX idx_plg_history_org ON public.plg_score_history(organization_id);
CREATE INDEX idx_plg_history_opp ON public.plg_score_history(opportunity_id);
CREATE INDEX idx_plg_history_date ON public.plg_score_history(calculated_at);

-- 4. Add PLG fields to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS plg_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plg_score_max INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS plg_score_avg NUMERIC(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS plg_classification TEXT CHECK (plg_classification IN ('hot', 'warm', 'cold')),
ADD COLUMN IF NOT EXISTS plg_score_updated_at TIMESTAMPTZ;

-- Create index for PLG classification
CREATE INDEX IF NOT EXISTS idx_organizations_plg_class ON public.organizations(plg_classification);

-- 5. Create trigger to update updated_at on plg_score_config
CREATE TRIGGER update_plg_score_config_updated_at
BEFORE UPDATE ON public.plg_score_config
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();