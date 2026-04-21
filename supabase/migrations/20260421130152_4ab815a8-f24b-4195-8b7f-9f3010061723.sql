DROP FUNCTION IF EXISTS public.get_opportunity_pending_approvals(uuid);

CREATE OR REPLACE FUNCTION public.get_opportunity_pending_approvals(p_opportunity_id uuid)
RETURNS TABLE (
  id uuid, run_id uuid, agent_id uuid, status text, approval_type text,
  requested_at timestamptz, organization_id uuid, rejection_reason text, agent_name text,
  email_id uuid, email_subject text, email_body_html text, email_body_text text,
  email_recipient_email text, email_recipient_name text, email_preview_text text,
  email_scheduled_send_at timestamptz, email_send_status text,
  email_send_failure_reason text, email_send_attempts int,
  email_validation_warnings_json jsonb,
  run_decision_json jsonb, run_scenario_label text, run_output_preview_json jsonb,
  run_validation_warnings_json jsonb, run_brief_signature text
)
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  WITH base AS (
    SELECT q.id, q.run_id, q.agent_id, q.status, q.approval_type, q.requested_at,
      q.organization_id, q.rejection_reason,
      r.opportunity_id AS run_opp_id, r.context_snapshot_json AS run_ctx,
      r.entity_type AS run_entity_type, r.entity_id AS run_entity_id,
      r.decision_json AS run_decision_json, r.scenario_label AS run_scenario_label,
      r.output_preview_json AS run_output_preview_json,
      r.validation_warnings_json AS run_validation_warnings_json,
      r.brief_signature AS run_brief_signature,
      a.name AS agent_name,
      e.id AS email_id, e.opportunity_id AS email_opp_id, e.subject AS email_subject,
      e.body_html AS email_body_html, e.body_text AS email_body_text,
      e.recipient_email AS email_recipient_email, e.recipient_name AS email_recipient_name,
      e.preview_text AS email_preview_text, e.scheduled_send_at AS email_scheduled_send_at,
      e.send_status AS email_send_status, e.send_failure_reason AS email_send_failure_reason,
      e.send_attempts AS email_send_attempts,
      e.validation_warnings_json AS email_validation_warnings_json
    FROM public.ai_agent_approval_queue q
    LEFT JOIN public.ai_agent_execution_runs r ON r.id = q.run_id
    LEFT JOIN public.ai_agents a ON a.id = q.agent_id
    LEFT JOIN LATERAL (
      SELECT em.* FROM public.ai_email_messages em
      WHERE em.run_id = q.run_id ORDER BY em.created_at DESC LIMIT 1
    ) e ON TRUE
    WHERE q.status IN ('pending', 'send_failed')
  ),
  resolved AS (
    SELECT b.*, COALESCE(
      b.run_opp_id,
      NULLIF((b.run_ctx -> 'opportunity') ->> 'id', '')::uuid,
      CASE WHEN b.run_entity_type = 'opportunity' THEN b.run_entity_id ELSE NULL END,
      b.email_opp_id
    ) AS resolved_opp_id FROM base b
  )
  SELECT id, run_id, agent_id, status, approval_type, requested_at, organization_id, rejection_reason,
    agent_name, email_id, email_subject, email_body_html, email_body_text,
    email_recipient_email, email_recipient_name, email_preview_text,
    email_scheduled_send_at, email_send_status, email_send_failure_reason, email_send_attempts,
    email_validation_warnings_json,
    run_decision_json, run_scenario_label, run_output_preview_json,
    run_validation_warnings_json, run_brief_signature
  FROM resolved
  WHERE resolved_opp_id = p_opportunity_id
    AND organization_id = public.get_user_organization_id()
  ORDER BY requested_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_opportunity_pending_approvals(uuid) TO authenticated;