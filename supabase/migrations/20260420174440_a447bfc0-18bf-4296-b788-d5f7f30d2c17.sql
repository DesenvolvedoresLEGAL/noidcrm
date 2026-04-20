ALTER TABLE public.ai_agent_execution_runs
  ADD COLUMN IF NOT EXISTS opportunity_id uuid;

CREATE INDEX IF NOT EXISTS idx_exec_runs_opportunity
  ON public.ai_agent_execution_runs(opportunity_id)
  WHERE opportunity_id IS NOT NULL;

UPDATE public.ai_agent_execution_runs
SET opportunity_id = CASE
  WHEN entity_type = 'opportunity' THEN entity_id
  WHEN context_snapshot_json ? 'opportunity_id'
       AND (context_snapshot_json->>'opportunity_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       THEN (context_snapshot_json->>'opportunity_id')::uuid
  ELSE NULL
END
WHERE opportunity_id IS NULL;

CREATE OR REPLACE VIEW public.unified_timeline AS
 SELECT 'activity'::text AS type,
    a.id,
    COALESCE(a.completed_at, a.scheduled_date, a.created_at) AS "timestamp",
    a.title,
    a.type AS activity_type,
    a.owner_user_id,
    a.opportunity_id,
    a.account_id,
    a.contact_id,
    a.organization_id,
    a.deleted_at,
    jsonb_build_object('status', a.status, 'description', a.description, 'duration_minutes', a.duration_minutes, 'is_automated', a.is_automated, 'ai_generated', a.ai_generated, 'sentiment', a.sentiment, 'scheduled_date', a.scheduled_date, 'completed_at', a.completed_at) AS metadata
   FROM activities a
  WHERE a.opportunity_id IS NOT NULL
UNION ALL
 SELECT 'note'::text, n.id, n.created_at, 'Nota adicionada'::text, 'note'::text, n.created_by, n.opportunity_id,
    NULL::uuid, NULL::uuid, n.organization_id, NULL::timestamptz,
    jsonb_build_object('content', n.content)
   FROM opportunity_notes n
UNION ALL
 SELECT 'email'::text, e.id, e.sent_at, e.subject, 'email'::text, e.sent_by, e.opportunity_id,
    NULL::uuid, NULL::uuid, e.organization_id, NULL::timestamptz,
    jsonb_build_object('to_emails', e.to_emails, 'from_email', e.from_email, 'body', e.body, 'opened_at', e.opened_at, 'clicked_at', e.clicked_at)
   FROM opportunity_emails e
UNION ALL
 SELECT 'audit'::text, al.id, al.created_at, al.action, al.action, al.actor_user_id, al.entity_id,
    NULL::uuid, NULL::uuid, al.organization_id, NULL::timestamptz,
    jsonb_build_object('entity_type', al.entity_type, 'field_name', al.field_name, 'old_value', al.old_value, 'new_value', al.new_value, 'metadata', al.metadata, 'trace_id', al.trace_id)
   FROM audit_log al
  WHERE al.entity_type = 'opportunity'::text
UNION ALL
 SELECT 'proposal'::text, p.id, COALESCE(p.sent_at, p.created_at), p.title,
    CASE
      WHEN p.accepted_at IS NOT NULL THEN 'accepted'::text
      WHEN p.viewed_at IS NOT NULL THEN 'viewed'::text
      WHEN p.sent_at IS NOT NULL THEN 'sent'::text
      ELSE 'draft'::text
    END,
    NULL::uuid, p.opportunity_id, NULL::uuid, NULL::uuid, p.organization_id, p.deleted_at,
    jsonb_build_object('status', p.status, 'value', p.value, 'expires_at', p.expires_at, 'sent_at', p.sent_at, 'viewed_at', p.viewed_at, 'accepted_at', p.accepted_at, 'declined_at', p.declined_at, 'client_name', p.client_name)
   FROM proposals p
  WHERE p.opportunity_id IS NOT NULL
UNION ALL
 SELECT 'file'::text, f.id, f.created_at, f.file_name, 'upload'::text, f.uploaded_by, f.opportunity_id,
    NULL::uuid, NULL::uuid, f.organization_id, NULL::timestamptz,
    jsonb_build_object('file_size', f.file_size, 'file_type', f.file_type, 'storage_path', f.storage_path)
   FROM opportunity_files f
  WHERE f.opportunity_id IS NOT NULL
UNION ALL
 SELECT 'agent_approval'::text,
    q.id,
    COALESCE(q.decided_at, q.requested_at),
    CASE q.status
      WHEN 'pending'  THEN 'Email Agent gerou um rascunho aguardando aprovação'
      WHEN 'approved' THEN 'Aprovação concedida'
      WHEN 'rejected' THEN 'Aprovação rejeitada'
      ELSE 'Atualização do agente'
    END,
    q.status,
    COALESCE(q.approved_by, q.rejected_by, q.requested_by),
    r.opportunity_id,
    NULL::uuid, NULL::uuid,
    q.organization_id,
    NULL::timestamptz,
    jsonb_build_object(
      'queue_id', q.id,
      'run_id', q.run_id,
      'agent_id', q.agent_id,
      'status', q.status,
      'approval_type', q.approval_type,
      'approval_reason', q.approval_reason,
      'rejection_reason', q.rejection_reason,
      'subject', em.subject,
      'recipient_email', em.recipient_email,
      'agent_name', ag.name
    )
   FROM ai_agent_approval_queue q
   JOIN ai_agent_execution_runs r ON r.id = q.run_id
   LEFT JOIN ai_agents ag ON ag.id = q.agent_id
   LEFT JOIN LATERAL (
     SELECT subject, recipient_email
     FROM ai_email_messages
     WHERE run_id = q.run_id
     ORDER BY created_at DESC
     LIMIT 1
   ) em ON TRUE
  WHERE r.opportunity_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.notify_owner_on_agent_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp_id uuid;
  v_opp_title text;
  v_owner uuid;
  v_subject text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT opportunity_id INTO v_opp_id
  FROM public.ai_agent_execution_runs
  WHERE id = NEW.run_id;

  IF v_opp_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT title, owner_user_id INTO v_opp_title, v_owner
  FROM public.opportunities
  WHERE id = v_opp_id;

  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT subject INTO v_subject
  FROM public.ai_email_messages
  WHERE run_id = NEW.run_id
  ORDER BY created_at DESC
  LIMIT 1;

  INSERT INTO public.notifications (
    user_id, organization_id, type, title, message, metadata
  ) VALUES (
    v_owner,
    NEW.organization_id,
    'agent_approval_pending',
    'Email Agent precisa da sua aprovação',
    COALESCE(v_opp_title, 'Oportunidade') || COALESCE(' · ' || v_subject, ''),
    jsonb_build_object(
      'queue_id', NEW.id,
      'run_id', NEW.run_id,
      'agent_id', NEW.agent_id,
      'opportunity_id', v_opp_id,
      'deep_link', '/app/opportunities/' || v_opp_id || '?tab=emails&approval=' || NEW.id
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_on_agent_approval ON public.ai_agent_approval_queue;
CREATE TRIGGER trg_notify_owner_on_agent_approval
AFTER INSERT ON public.ai_agent_approval_queue
FOR EACH ROW
EXECUTE FUNCTION public.notify_owner_on_agent_approval();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'ai_agent_approval_queue'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.ai_agent_approval_queue';
  END IF;
END$$;

ALTER TABLE public.ai_agent_approval_queue REPLICA IDENTITY FULL;