-- Drop and recreate unified_timeline view with all event types
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

-- Workflow Executions (Automations) - using workflow_rules table
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
WHERE we.opportunity_id IS NOT NULL;