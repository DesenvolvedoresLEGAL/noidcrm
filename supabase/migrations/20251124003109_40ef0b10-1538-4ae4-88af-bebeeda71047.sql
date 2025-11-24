-- Sprint 2: AI-Powered Sequences & Stage Progression

-- ============================================
-- 1. Extend sequences table for AI features
-- ============================================
ALTER TABLE sequences 
ADD COLUMN IF NOT EXISTS ai_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ai_variations jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS ab_test_results jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS auto_pause_rules jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS entry_criteria jsonb DEFAULT '{}'::jsonb;

COMMENT ON COLUMN sequences.ai_enabled IS 'Enable AI-powered variations and smart orchestration';
COMMENT ON COLUMN sequences.ai_variations IS 'AI-generated message variations for A/B testing';
COMMENT ON COLUMN sequences.ab_test_results IS 'A/B test performance metrics';
COMMENT ON COLUMN sequences.auto_pause_rules IS 'Rules for auto-pausing sequence (e.g., on reply, meeting booked)';
COMMENT ON COLUMN sequences.entry_criteria IS 'Criteria for entering sequence (stage, temperature, engagement)';

-- ============================================
-- 2. Create sequence_enrollments table
-- ============================================
CREATE TABLE IF NOT EXISTS sequence_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id uuid NOT NULL REFERENCES sequences(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  current_step_index integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'exited')),
  
  enrolled_at timestamp with time zone NOT NULL DEFAULT now(),
  last_step_executed_at timestamp with time zone,
  next_step_scheduled_at timestamp with time zone,
  paused_at timestamp with time zone,
  completed_at timestamp with time zone,
  
  pause_reason text,
  exit_reason text,
  
  engagement_data jsonb DEFAULT '{}'::jsonb,
  ab_variant text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  UNIQUE(sequence_id, opportunity_id)
);

COMMENT ON TABLE sequence_enrollments IS 'Tracks which opportunities are enrolled in which sequences';

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_sequence ON sequence_enrollments(sequence_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_opportunity ON sequence_enrollments(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_org ON sequence_enrollments(organization_id);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_status ON sequence_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_next_step ON sequence_enrollments(next_step_scheduled_at) WHERE status = 'active';

-- RLS Policies
ALTER TABLE sequence_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view enrollments in their org"
  ON sequence_enrollments FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "System can manage enrollments"
  ON sequence_enrollments FOR ALL
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

-- Trigger for updated_at
CREATE TRIGGER update_sequence_enrollments_updated_at
  BEFORE UPDATE ON sequence_enrollments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 3. Create stage_progression_suggestions table
-- ============================================
CREATE TABLE IF NOT EXISTS stage_progression_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  current_stage_id text,
  suggested_stage_id text,
  
  confidence_score numeric(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
  reasoning text NOT NULL,
  
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  
  created_at timestamp with time zone DEFAULT now(),
  action_taken_at timestamp with time zone,
  expires_at timestamp with time zone DEFAULT (now() + interval '7 days'),
  
  metadata jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE stage_progression_suggestions IS 'AI suggestions for advancing opportunities through pipeline stages';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_stage_suggestions_opportunity ON stage_progression_suggestions(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_stage_suggestions_org ON stage_progression_suggestions(organization_id);
CREATE INDEX IF NOT EXISTS idx_stage_suggestions_status ON stage_progression_suggestions(status);

-- RLS Policies
ALTER TABLE stage_progression_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view stage suggestions in their org"
  ON stage_progression_suggestions FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can update stage suggestions"
  ON stage_progression_suggestions FOR UPDATE
  USING (organization_id = get_user_organization_id())
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "System can manage stage suggestions"
  ON stage_progression_suggestions FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());