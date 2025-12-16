-- =====================================================
-- GTM CANONICAL MODEL - Complete Database Migration
-- =====================================================

-- 1. Create interaction_channel enum for normalized channels
CREATE TYPE interaction_channel AS ENUM (
  'email', 'phone', 'whatsapp', 'linkedin', 'meeting', 'form', 'chat', 'website', 'proposal', 'contract', 'other'
);

-- 2. Create interaction_type enum for normalized types
CREATE TYPE interaction_type_enum AS ENUM (
  'call_made', 'call_received', 'call_missed',
  'email_sent', 'email_received', 'email_opened', 'email_clicked',
  'meeting_scheduled', 'meeting_held', 'meeting_canceled', 'meeting_no_show',
  'message_sent', 'message_received',
  'form_submitted', 'chat_started',
  'proposal_sent', 'proposal_viewed', 'proposal_accepted', 'proposal_rejected',
  'contract_sent', 'contract_signed',
  'linkedin_connection', 'linkedin_message',
  'website_visit', 'demo_requested',
  'note_added', 'task_completed',
  'other'
);

-- 3. Create interactions table (canonical GTM touchpoints)
CREATE TABLE public.interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Related entities
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  
  -- Actor
  actor_user_id UUID,
  actor_type TEXT NOT NULL DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'automation', 'external')),
  
  -- Normalized channel and type
  channel interaction_channel NOT NULL DEFAULT 'other',
  direction TEXT NOT NULL DEFAULT 'outbound' CHECK (direction IN ('inbound', 'outbound', 'bidirectional')),
  interaction_type interaction_type_enum NOT NULL DEFAULT 'other',
  
  -- Content
  subject TEXT,
  content TEXT,
  summary TEXT,
  duration_seconds INTEGER,
  
  -- Sentiment analysis
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'unknown')),
  sentiment_score NUMERIC(4,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
  
  -- Engagement
  engagement_score INTEGER DEFAULT 0 CHECK (engagement_score >= 0 AND engagement_score <= 100),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  external_id TEXT,
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'gmail_sync', 'calendar_sync', 'form', 'automation', 'migration', 'api', 'whatsapp_sync')),
  
  -- Correlation with activity
  activity_id UUID REFERENCES activities(id) ON DELETE SET NULL,
  
  -- Timestamps
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Observability
  trace_id UUID
);

-- Indexes for interactions
CREATE INDEX idx_interactions_org ON interactions(organization_id);
CREATE INDEX idx_interactions_account ON interactions(account_id);
CREATE INDEX idx_interactions_contact ON interactions(contact_id);
CREATE INDEX idx_interactions_opportunity ON interactions(opportunity_id);
CREATE INDEX idx_interactions_channel ON interactions(channel);
CREATE INDEX idx_interactions_type ON interactions(interaction_type);
CREATE INDEX idx_interactions_occurred ON interactions(occurred_at DESC);
CREATE INDEX idx_interactions_sentiment ON interactions(sentiment);
CREATE INDEX idx_interactions_activity ON interactions(activity_id);

-- Enable RLS on interactions
ALTER TABLE interactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for interactions
CREATE POLICY "interactions_select_by_org" ON interactions
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "interactions_insert_by_org" ON interactions
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "interactions_update_by_org" ON interactions
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "interactions_delete_admin" ON interactions
  FOR DELETE USING (
    organization_id = get_user_organization_id() 
    AND user_is_org_admin_or_manager(organization_id)
  );

-- 4. Create win_reasons table
CREATE TABLE public.win_reasons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT CHECK (category IN ('price', 'product', 'service', 'brand', 'relationship', 'timing', 'other')),
  is_active BOOLEAN DEFAULT true,
  pipeline_ids UUID[] DEFAULT NULL,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, name)
);

-- Indexes for win_reasons
CREATE INDEX idx_win_reasons_org ON win_reasons(organization_id);
CREATE INDEX idx_win_reasons_active ON win_reasons(is_active);

-- Enable RLS on win_reasons
ALTER TABLE win_reasons ENABLE ROW LEVEL SECURITY;

-- RLS policies for win_reasons
CREATE POLICY "win_reasons_select_by_org" ON win_reasons
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "win_reasons_insert_admin" ON win_reasons
  FOR INSERT WITH CHECK (
    organization_id = get_user_organization_id() 
    AND user_is_org_admin_or_manager(organization_id)
  );

CREATE POLICY "win_reasons_update_admin" ON win_reasons
  FOR UPDATE USING (
    organization_id = get_user_organization_id() 
    AND user_is_org_admin_or_manager(organization_id)
  );

CREATE POLICY "win_reasons_delete_admin" ON win_reasons
  FOR DELETE USING (
    organization_id = get_user_organization_id() 
    AND user_is_org_admin_or_manager(organization_id)
  );

-- 5. Expand win_loss_records for WIN data
ALTER TABLE win_loss_records 
  ADD COLUMN IF NOT EXISTS win_reason_id UUID REFERENCES win_reasons(id),
  ADD COLUMN IF NOT EXISTS champion_contact_id UUID REFERENCES contacts(id),
  ADD COLUMN IF NOT EXISTS negotiation_rounds INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS closed_by_proposal_id UUID,
  ADD COLUMN IF NOT EXISTS key_differentiator TEXT,
  ADD COLUMN IF NOT EXISTS customer_feedback TEXT,
  ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS total_interactions INTEGER DEFAULT 0;

-- Index for new columns
CREATE INDEX IF NOT EXISTS idx_win_loss_win_reason ON win_loss_records(win_reason_id);
CREATE INDEX IF NOT EXISTS idx_win_loss_champion ON win_loss_records(champion_contact_id);

-- 6. Function to auto-calculate sales_cycle_days
CREATE OR REPLACE FUNCTION calculate_win_loss_metrics()
RETURNS TRIGGER AS $$
DECLARE
  v_opp RECORD;
  v_interactions_count INTEGER;
BEGIN
  -- Get opportunity details
  SELECT * INTO v_opp FROM opportunities WHERE id = NEW.opportunity_id;
  
  IF v_opp IS NOT NULL THEN
    -- Calculate sales_cycle_days
    NEW.sales_cycle_days := GREATEST(1, EXTRACT(DAY FROM (NOW() - v_opp.created_at))::INTEGER);
    
    -- Count interactions
    SELECT COUNT(*) INTO v_interactions_count
    FROM interactions
    WHERE opportunity_id = NEW.opportunity_id;
    
    NEW.total_interactions := COALESCE(v_interactions_count, 0);
    
    -- Set final_value from opportunity if not provided
    IF NEW.final_value IS NULL THEN
      NEW.final_value := v_opp.valor_previsto;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-calculation
DROP TRIGGER IF EXISTS trg_calculate_win_loss_metrics ON win_loss_records;
CREATE TRIGGER trg_calculate_win_loss_metrics
  BEFORE INSERT OR UPDATE ON win_loss_records
  FOR EACH ROW
  EXECUTE FUNCTION calculate_win_loss_metrics();

-- 7. Function to create interaction from activity
CREATE OR REPLACE FUNCTION log_activity_as_interaction()
RETURNS TRIGGER AS $$
DECLARE
  v_channel interaction_channel;
  v_interaction_type interaction_type_enum;
BEGIN
  -- Map activity type to channel
  v_channel := CASE NEW.type
    WHEN 'call' THEN 'phone'::interaction_channel
    WHEN 'email' THEN 'email'::interaction_channel
    WHEN 'meeting' THEN 'meeting'::interaction_channel
    WHEN 'whatsapp' THEN 'whatsapp'::interaction_channel
    WHEN 'linkedin' THEN 'linkedin'::interaction_channel
    WHEN 'task' THEN 'other'::interaction_channel
    WHEN 'note' THEN 'other'::interaction_channel
    ELSE 'other'::interaction_channel
  END;
  
  -- Map to interaction type
  v_interaction_type := CASE NEW.type
    WHEN 'call' THEN 
      CASE NEW.status WHEN 'completed' THEN 'call_made'::interaction_type_enum ELSE 'call_made'::interaction_type_enum END
    WHEN 'email' THEN 'email_sent'::interaction_type_enum
    WHEN 'meeting' THEN 
      CASE NEW.status 
        WHEN 'completed' THEN 'meeting_held'::interaction_type_enum 
        WHEN 'cancelled' THEN 'meeting_canceled'::interaction_type_enum
        ELSE 'meeting_scheduled'::interaction_type_enum 
      END
    WHEN 'whatsapp' THEN 'message_sent'::interaction_type_enum
    WHEN 'linkedin' THEN 'linkedin_message'::interaction_type_enum
    WHEN 'note' THEN 'note_added'::interaction_type_enum
    WHEN 'task' THEN 'task_completed'::interaction_type_enum
    ELSE 'other'::interaction_type_enum
  END;
  
  -- Insert interaction
  INSERT INTO interactions (
    organization_id, account_id, contact_id, opportunity_id,
    actor_user_id, actor_type, channel, direction, interaction_type,
    subject, content, duration_seconds, sentiment,
    activity_id, occurred_at, source
  ) VALUES (
    NEW.organization_id, NEW.account_id, NEW.contact_id, NEW.opportunity_id,
    NEW.owner_user_id, 'user', v_channel, 'outbound', v_interaction_type,
    NEW.title, NEW.description, NEW.duration_minutes * 60, NEW.sentiment,
    NEW.id, COALESCE(NEW.completed_at, NEW.scheduled_date, NEW.created_at), 'manual'
  )
  ON CONFLICT DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for activities → interactions
DROP TRIGGER IF EXISTS trg_activity_to_interaction ON activities;
CREATE TRIGGER trg_activity_to_interaction
  AFTER INSERT ON activities
  FOR EACH ROW
  EXECUTE FUNCTION log_activity_as_interaction();

-- 8. Trigger to update interaction when activity is completed
CREATE OR REPLACE FUNCTION update_interaction_on_activity_complete()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    UPDATE interactions
    SET 
      interaction_type = CASE NEW.type
        WHEN 'meeting' THEN 'meeting_held'::interaction_type_enum
        WHEN 'call' THEN 'call_made'::interaction_type_enum
        WHEN 'task' THEN 'task_completed'::interaction_type_enum
        ELSE interaction_type
      END,
      occurred_at = COALESCE(NEW.completed_at, NOW()),
      duration_seconds = COALESCE(NEW.duration_minutes * 60, duration_seconds),
      sentiment = COALESCE(NEW.sentiment, sentiment),
      updated_at = NOW()
    WHERE activity_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_update_interaction_complete ON activities;
CREATE TRIGGER trg_update_interaction_complete
  AFTER UPDATE ON activities
  FOR EACH ROW
  EXECUTE FUNCTION update_interaction_on_activity_complete();

-- 9. Insert default win_reasons for each organization
INSERT INTO win_reasons (organization_id, name, category, display_order)
SELECT DISTINCT 
  org.id,
  reason.name,
  reason.category,
  reason.display_order
FROM organizations org
CROSS JOIN (VALUES 
  ('Melhor custo-benefício', 'price', 1),
  ('Produto/Serviço superior', 'product', 2),
  ('Melhor atendimento', 'service', 3),
  ('Confiança na marca', 'brand', 4),
  ('Relacionamento com vendedor', 'relationship', 5),
  ('Timing/Urgência', 'timing', 6),
  ('Indicação/Referência', 'other', 7),
  ('Sem concorrência', 'other', 8),
  ('Outro', 'other', 99)
) AS reason(name, category, display_order)
ON CONFLICT (organization_id, name) DO NOTHING;

-- 10. Update trigger for interactions updated_at
CREATE OR REPLACE FUNCTION update_interactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS trg_interactions_updated_at ON interactions;
CREATE TRIGGER trg_interactions_updated_at
  BEFORE UPDATE ON interactions
  FOR EACH ROW
  EXECUTE FUNCTION update_interactions_updated_at();

-- 11. Update trigger for win_reasons updated_at
DROP TRIGGER IF EXISTS trg_win_reasons_updated_at ON win_reasons;
CREATE TRIGGER trg_win_reasons_updated_at
  BEFORE UPDATE ON win_reasons
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();