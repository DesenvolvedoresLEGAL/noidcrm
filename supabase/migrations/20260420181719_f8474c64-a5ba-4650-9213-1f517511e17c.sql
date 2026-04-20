
-- 1) Backfill opportunity_id on existing runs
UPDATE public.ai_agent_execution_runs r
SET opportunity_id = COALESCE(
  r.opportunity_id,
  NULLIF(r.context_snapshot_json->'opportunity'->>'id','')::uuid,
  CASE WHEN r.entity_type='opportunity' THEN r.entity_id ELSE NULL END
)
WHERE r.opportunity_id IS NULL
  AND (r.entity_type='opportunity' OR r.context_snapshot_json ? 'opportunity');

-- 2) Reconstruct missing approval queue items for awaiting_approval runs that have a pending email
INSERT INTO public.ai_agent_approval_queue
  (run_id, agent_id, agent_version_id, organization_id, entity_type, entity_id,
   approval_type, status, requested_at, requested_by)
SELECT r.id, r.agent_id, r.agent_version_id, r.organization_id,
       r.entity_type, r.entity_id,
       'send_email'::text, 'pending'::text, now(), NULL
FROM public.ai_agent_execution_runs r
JOIN public.ai_email_messages m ON m.run_id = r.id
WHERE r.execution_status = 'awaiting_approval'
  AND m.send_status = 'pending_approval'
  AND NOT EXISTS (SELECT 1 FROM public.ai_agent_approval_queue q WHERE q.run_id = r.id);

-- 3) Replace unified_timeline view: agent_approval should resolve opportunity_id via run OR run.entity_id
CREATE OR REPLACE VIEW public.unified_timeline AS
 SELECT 'activity'::text AS type, a.id, COALESCE(a.completed_at, a.scheduled_date, a.created_at) AS "timestamp",
    a.title, a.type AS activity_type, a.owner_user_id, a.opportunity_id, a.account_id, a.contact_id,
    a.organization_id, a.deleted_at,
    jsonb_build_object('status', a.status, 'description', a.description, 'duration_minutes', a.duration_minutes,
      'is_automated', a.is_automated, 'ai_generated', a.ai_generated, 'sentiment', a.sentiment,
      'scheduled_date', a.scheduled_date, 'completed_at', a.completed_at) AS metadata
   FROM public.activities a WHERE a.opportunity_id IS NOT NULL
 UNION ALL
 SELECT 'note'::text, n.id, n.created_at, 'Nota adicionada'::text, 'note'::text, n.created_by,
    n.opportunity_id, NULL::uuid, NULL::uuid, n.organization_id, NULL::timestamptz,
    jsonb_build_object('content', n.content)
   FROM public.opportunity_notes n
 UNION ALL
 SELECT 'email'::text, e.id, e.sent_at, e.subject, 'email'::text, e.sent_by,
    e.opportunity_id, NULL::uuid, NULL::uuid, e.organization_id, NULL::timestamptz,
    jsonb_build_object('to_emails', e.to_emails, 'from_email', e.from_email, 'body', e.body,
      'opened_at', e.opened_at, 'clicked_at', e.clicked_at)
   FROM public.opportunity_emails e
 UNION ALL
 SELECT 'audit'::text, al.id, al.created_at, al.action, al.action, al.actor_user_id,
    al.entity_id, NULL::uuid, NULL::uuid, al.organization_id, NULL::timestamptz,
    jsonb_build_object('entity_type', al.entity_type, 'field_name', al.field_name,
      'old_value', al.old_value, 'new_value', al.new_value, 'metadata', al.metadata, 'trace_id', al.trace_id)
   FROM public.audit_log al WHERE al.entity_type = 'opportunity'
 UNION ALL
 SELECT 'proposal'::text, p.id, COALESCE(p.sent_at, p.created_at), p.title,
    CASE WHEN p.accepted_at IS NOT NULL THEN 'accepted' WHEN p.viewed_at IS NOT NULL THEN 'viewed'
         WHEN p.sent_at IS NOT NULL THEN 'sent' ELSE 'draft' END,
    NULL::uuid, p.opportunity_id, NULL::uuid, NULL::uuid, p.organization_id, p.deleted_at,
    jsonb_build_object('status', p.status, 'value', p.value, 'expires_at', p.expires_at,
      'sent_at', p.sent_at, 'viewed_at', p.viewed_at, 'accepted_at', p.accepted_at,
      'declined_at', p.declined_at, 'client_name', p.client_name)
   FROM public.proposals p WHERE p.opportunity_id IS NOT NULL
 UNION ALL
 SELECT 'file'::text, f.id, f.created_at, f.file_name, 'upload'::text, f.uploaded_by,
    f.opportunity_id, NULL::uuid, NULL::uuid, f.organization_id, NULL::timestamptz,
    jsonb_build_object('file_size', f.file_size, 'file_type', f.file_type, 'storage_path', f.storage_path)
   FROM public.opportunity_files f WHERE f.opportunity_id IS NOT NULL
 UNION ALL
 SELECT 'agent_approval'::text, q.id, COALESCE(q.decided_at, q.requested_at),
    CASE q.status WHEN 'pending' THEN 'Email Agent gerou um rascunho aguardando aprovação'
                  WHEN 'approved' THEN 'Aprovação concedida'
                  WHEN 'rejected' THEN 'Aprovação rejeitada'
                  ELSE 'Atualização do agente' END,
    q.status,
    COALESCE(q.approved_by, q.rejected_by, q.requested_by),
    COALESCE(
      r.opportunity_id,
      NULLIF(r.context_snapshot_json->'opportunity'->>'id','')::uuid,
      CASE WHEN r.entity_type='opportunity' THEN r.entity_id END
    ) AS opportunity_id,
    NULL::uuid, NULL::uuid, q.organization_id, NULL::timestamptz,
    jsonb_build_object(
      'queue_id', q.id, 'run_id', q.run_id, 'agent_id', q.agent_id, 'status', q.status,
      'approval_type', q.approval_type, 'rejection_reason', q.rejection_reason,
      'approval_reason', q.approval_reason
    )
   FROM public.ai_agent_approval_queue q
   JOIN public.ai_agent_execution_runs r ON r.id = q.run_id;

CREATE INDEX IF NOT EXISTS idx_runs_opportunity_id ON public.ai_agent_execution_runs(opportunity_id) WHERE opportunity_id IS NOT NULL;
