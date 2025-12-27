-- =====================================================
-- Create timeline_events table for domain-specific events
-- =====================================================

CREATE TABLE IF NOT EXISTS public.timeline_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'system',
  activity_type TEXT NOT NULL,
  title TEXT NOT NULL,
  actor_user_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_timeline_events_opportunity ON timeline_events(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_account ON timeline_events(account_id);
CREATE INDEX IF NOT EXISTS idx_timeline_events_timestamp ON timeline_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_timeline_events_org ON timeline_events(organization_id);

-- Enable RLS
ALTER TABLE public.timeline_events ENABLE ROW LEVEL SECURITY;

-- RLS policies using organization_members table
CREATE POLICY "Users can view timeline events in their organization" ON timeline_events
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert timeline events in their organization" ON timeline_events
  FOR INSERT WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
    )
  );

-- Allow system/trigger inserts
CREATE POLICY "Allow system inserts for triggers" ON timeline_events
  FOR INSERT WITH CHECK (true);

-- =====================================================
-- Trigger function to log opportunity score changes
-- =====================================================
CREATE OR REPLACE FUNCTION log_opportunity_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes JSONB;
BEGIN
  v_changes := '{}'::jsonb;
  
  -- Check for opportunity_score change
  IF OLD.opportunity_score IS DISTINCT FROM NEW.opportunity_score THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'opportunity_score',
      'old_value', OLD.opportunity_score,
      'new_value', NEW.opportunity_score
    );
  END IF;
  
  -- Check for win_probability_ai change
  IF OLD.win_probability_ai IS DISTINCT FROM NEW.win_probability_ai THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'win_probability_ai',
      'old_value', OLD.win_probability_ai,
      'new_value', NEW.win_probability_ai
    );
  END IF;
  
  -- Check for nrhs fields changes
  IF OLD.nrhs_tier IS DISTINCT FROM NEW.nrhs_tier THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'nrhs_tier',
      'old_value', OLD.nrhs_tier,
      'new_value', NEW.nrhs_tier
    );
  END IF;
  
  IF OLD.nrhs_issues_count IS DISTINCT FROM NEW.nrhs_issues_count THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'nrhs_issues_count',
      'old_value', OLD.nrhs_issues_count,
      'new_value', NEW.nrhs_issues_count
    );
  END IF;
  
  -- Only insert if there are changes
  IF v_changes != '{}'::jsonb THEN
    INSERT INTO timeline_events (
      organization_id,
      opportunity_id,
      type,
      activity_type,
      title,
      actor_user_id,
      metadata,
      timestamp
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      'score',
      'score_updated',
      'Score atualizado',
      NULL,
      v_changes,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for opportunity score changes
DROP TRIGGER IF EXISTS trg_log_opportunity_score_change ON opportunities;
CREATE TRIGGER trg_log_opportunity_score_change
  AFTER UPDATE OF opportunity_score, win_probability_ai, nrhs_tier, nrhs_issues_count
  ON opportunities
  FOR EACH ROW
  EXECUTE FUNCTION log_opportunity_score_change();

-- =====================================================
-- Trigger function to log account lead score changes
-- =====================================================
CREATE OR REPLACE FUNCTION log_account_score_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_changes JSONB;
BEGIN
  v_changes := '{}'::jsonb;
  
  -- Check for lead_score change
  IF OLD.lead_score IS DISTINCT FROM NEW.lead_score THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'lead_score',
      'old_value', OLD.lead_score,
      'new_value', NEW.lead_score
    );
  END IF;
  
  -- Check for fit_score change
  IF OLD.fit_score IS DISTINCT FROM NEW.fit_score THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'fit_score',
      'old_value', OLD.fit_score,
      'new_value', NEW.fit_score
    );
  END IF;
  
  -- Check for intent_score change
  IF OLD.intent_score IS DISTINCT FROM NEW.intent_score THEN
    v_changes := v_changes || jsonb_build_object(
      'field', 'intent_score',
      'old_value', OLD.intent_score,
      'new_value', NEW.intent_score
    );
  END IF;
  
  -- Only insert if there are changes
  IF v_changes != '{}'::jsonb THEN
    INSERT INTO timeline_events (
      organization_id,
      account_id,
      type,
      activity_type,
      title,
      actor_user_id,
      metadata,
      timestamp
    ) VALUES (
      NEW.organization_id,
      NEW.id,
      'score',
      'lead_score_updated',
      'Lead score atualizado',
      NULL,
      v_changes,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for account score changes
DROP TRIGGER IF EXISTS trg_log_account_score_change ON accounts;
CREATE TRIGGER trg_log_account_score_change
  AFTER UPDATE OF lead_score, fit_score, intent_score
  ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION log_account_score_change();

-- =====================================================
-- Trigger function to log vibe alerts
-- =====================================================
CREATE OR REPLACE FUNCTION log_vibe_alert_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO timeline_events (
    organization_id,
    opportunity_id,
    type,
    activity_type,
    title,
    actor_user_id,
    metadata,
    timestamp
  ) VALUES (
    NEW.organization_id,
    NEW.opportunity_id,
    'vibe',
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'vibe_alert_created'
      WHEN NEW.status = 'acknowledged' THEN 'vibe_alert_acknowledged'
      WHEN NEW.status = 'dismissed' THEN 'vibe_alert_dismissed'
      ELSE 'vibe_alert_updated'
    END,
    COALESCE(NEW.title, 'Alerta de vibe'),
    NULL,
    jsonb_build_object(
      'alert_type', NEW.alert_type,
      'priority', NEW.priority,
      'status', NEW.status,
      'message', NEW.message
    ),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for vibe alerts
DROP TRIGGER IF EXISTS trg_log_vibe_alert_insert ON vibe_alerts;
CREATE TRIGGER trg_log_vibe_alert_insert
  AFTER INSERT ON vibe_alerts
  FOR EACH ROW
  EXECUTE FUNCTION log_vibe_alert_event();

DROP TRIGGER IF EXISTS trg_log_vibe_alert_update ON vibe_alerts;
CREATE TRIGGER trg_log_vibe_alert_update
  AFTER UPDATE OF status ON vibe_alerts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_vibe_alert_event();

-- =====================================================
-- Trigger function to log AI scores (deal intelligence)
-- =====================================================
CREATE OR REPLACE FUNCTION log_ai_score_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO timeline_events (
    organization_id,
    opportunity_id,
    type,
    activity_type,
    title,
    actor_user_id,
    metadata,
    timestamp
  ) VALUES (
    NEW.organization_id,
    CASE WHEN NEW.entity_type = 'opportunity' THEN NEW.entity_id::uuid ELSE NULL END,
    'ai',
    'ai_score_generated',
    'Inteligência IA gerada',
    NULL,
    jsonb_build_object(
      'score_type', NEW.score_type,
      'score', NEW.score,
      'grade', NEW.grade,
      'confidence', NEW.confidence,
      'explanation', NEW.explanation
    ),
    now()
  );
  
  RETURN NEW;
END;
$$;

-- Create trigger for AI scores
DROP TRIGGER IF EXISTS trg_log_ai_score_insert ON ai_scores;
CREATE TRIGGER trg_log_ai_score_insert
  AFTER INSERT ON ai_scores
  FOR EACH ROW
  WHEN (NEW.entity_type = 'opportunity')
  EXECUTE FUNCTION log_ai_score_event();

-- =====================================================
-- Update unified_timeline view to include timeline_events
-- =====================================================
DROP VIEW IF EXISTS unified_timeline;

CREATE OR REPLACE VIEW unified_timeline AS
-- Activities
SELECT 
  'activity'::text AS type,
  a.id,
  COALESCE(a.completed_at, a.scheduled_date, a.created_at) AS timestamp,
  a.title,
  a.type AS activity_type,
  a.owner_user_id,
  a.opportunity_id,
  a.account_id,
  a.contact_id,
  a.organization_id,
  a.deleted_at,
  jsonb_build_object(
    'status', a.status,
    'description', a.description,
    'duration_minutes', a.duration_minutes,
    'is_automated', a.is_automated,
    'ai_generated', a.ai_generated,
    'sentiment', a.sentiment,
    'scheduled_date', a.scheduled_date,
    'completed_at', a.completed_at
  ) AS metadata
FROM activities a
WHERE a.opportunity_id IS NOT NULL

UNION ALL

-- Opportunity Notes
SELECT 
  'note'::text AS type,
  n.id,
  n.created_at AS timestamp,
  'Nota adicionada'::text AS title,
  'note'::text AS activity_type,
  n.created_by AS owner_user_id,
  n.opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  n.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  jsonb_build_object(
    'content', n.content
  ) AS metadata
FROM opportunity_notes n

UNION ALL

-- Opportunity Emails
SELECT 
  'email'::text AS type,
  e.id,
  e.sent_at AS timestamp,
  e.subject AS title,
  'email'::text AS activity_type,
  e.sent_by AS owner_user_id,
  e.opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  e.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  jsonb_build_object(
    'to_emails', e.to_emails,
    'from_email', e.from_email,
    'body', e.body,
    'opened_at', e.opened_at,
    'clicked_at', e.clicked_at
  ) AS metadata
FROM opportunity_emails e

UNION ALL

-- Audit Log
SELECT 
  'audit'::text AS type,
  al.id,
  al.created_at AS timestamp,
  al.action AS title,
  al.action AS activity_type,
  al.actor_user_id AS owner_user_id,
  al.entity_id AS opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  al.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  jsonb_build_object(
    'entity_type', al.entity_type,
    'field_name', al.field_name,
    'old_value', al.old_value,
    'new_value', al.new_value,
    'metadata', al.metadata,
    'trace_id', al.trace_id
  ) AS metadata
FROM audit_log al
WHERE al.entity_type = 'opportunity'

UNION ALL

-- Proposals
SELECT 
  'proposal'::text AS type,
  p.id,
  COALESCE(p.sent_at, p.created_at) AS timestamp,
  p.title,
  CASE 
    WHEN p.accepted_at IS NOT NULL THEN 'accepted'
    WHEN p.viewed_at IS NOT NULL THEN 'viewed'
    WHEN p.sent_at IS NOT NULL THEN 'sent'
    ELSE 'draft'
  END AS activity_type,
  NULL::uuid AS owner_user_id,
  p.opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  p.organization_id,
  p.deleted_at,
  jsonb_build_object(
    'status', p.status,
    'value', p.value,
    'expires_at', p.expires_at,
    'sent_at', p.sent_at,
    'viewed_at', p.viewed_at,
    'accepted_at', p.accepted_at,
    'declined_at', p.declined_at,
    'client_name', p.client_name
  ) AS metadata
FROM proposals p
WHERE p.opportunity_id IS NOT NULL

UNION ALL

-- Opportunity Files
SELECT 
  'file'::text AS type,
  f.id,
  f.created_at AS timestamp,
  f.file_name AS title,
  'upload'::text AS activity_type,
  f.uploaded_by AS owner_user_id,
  f.opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  f.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  jsonb_build_object(
    'file_size', f.file_size,
    'file_type', f.file_type,
    'storage_path', f.storage_path
  ) AS metadata
FROM opportunity_files f

UNION ALL

-- Workflow Executions (Automations)
SELECT 
  'automation'::text AS type,
  we.id,
  COALESCE(we.completed_at, we.started_at, we.created_at) AS timestamp,
  COALESCE(wr.name, 'Automação executada')::text AS title,
  we.trigger_type::text AS activity_type,
  NULL::uuid AS owner_user_id,
  we.opportunity_id,
  NULL::uuid AS account_id,
  NULL::uuid AS contact_id,
  we.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  jsonb_build_object(
    'workflow_rule_id', we.workflow_rule_id,
    'status', we.status,
    'trigger_type', we.trigger_type,
    'actions_executed', we.actions_executed,
    'error_message', we.error_message,
    'started_at', we.started_at,
    'completed_at', we.completed_at
  ) AS metadata
FROM workflow_executions we
LEFT JOIN workflow_rules wr ON wr.id = we.workflow_rule_id
WHERE we.opportunity_id IS NOT NULL

UNION ALL

-- Timeline Events (scores, vibe alerts, AI, etc.)
SELECT 
  te.type,
  te.id,
  te.timestamp,
  te.title,
  te.activity_type,
  te.actor_user_id AS owner_user_id,
  te.opportunity_id,
  te.account_id,
  te.contact_id,
  te.organization_id,
  NULL::timestamp with time zone AS deleted_at,
  te.metadata
FROM timeline_events te;