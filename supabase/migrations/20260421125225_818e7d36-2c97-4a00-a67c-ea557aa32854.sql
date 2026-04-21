-- Add validation warnings columns to track potential hallucinations
ALTER TABLE public.ai_email_messages
  ADD COLUMN IF NOT EXISTS validation_warnings_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS validation_flag text,
  ADD COLUMN IF NOT EXISTS brief_signature text;

ALTER TABLE public.ai_agent_execution_runs
  ADD COLUMN IF NOT EXISTS validation_warnings_json jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS brief_signature text;

-- Recreate the RPC to also return validation warnings + brief signature.
-- Drop first because the return signature changes.
DROP FUNCTION IF EXISTS public.get_opportunity_pending_approvals(uuid);

CREATE OR REPLACE FUNCTION public.get_opportunity_pending_approvals(p_opportunity_id uuid)
RETURNS TABLE (
  id uuid,
  run_id uuid,
  agent_id uuid,
  status text,
  approval_type text,
  requested_at timestamptz,
  organization_id uuid,
  rejection_reason text,
  agent_name text,
  email_id uuid,
  email_subject text,
  email_body_html text,
  email_body_text text,
  email_recipient_email text,
  email_recipient_name text,
  email_preview_text text,
  email_scheduled_send_at timestamptz,
  email_send_status text,
  email_send_failure_reason text,
  email_send_attempts integer,
  email_validation_warnings_json jsonb,
  email_validation_flag text,
  run_decision_json jsonb,
  run_scenario_label text,
  run_output_preview_json jsonb,
  run_validation_warnings_json jsonb,
  run_brief_signature text,
  run_context_snapshot_json jsonb,
  resolved_opportunity_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id,
    q.run_id,
    q.agent_id,
    q.status,
    q.approval_type,
    q.requested_at,
    q.organization_id,
    q.rejection_reason,
    a.name AS agent_name,
    e.id AS email_id,
    e.subject AS email_subject,
    e.body_html AS email_body_html,
    e.body_text AS email_body_text,
    e.recipient_email AS email_recipient_email,
    e.recipient_name AS email_recipient_name,
    e.preview_text AS email_preview_text,
    e.scheduled_send_at AS email_scheduled_send_at,
    e.send_status AS email_send_status,
    e.send_failure_reason AS email_send_failure_reason,
    e.send_attempts AS email_send_attempts,
    e.validation_warnings_json AS email_validation_warnings_json,
    e.validation_flag AS email_validation_flag,
    r.decision_json AS run_decision_json,
    r.scenario_label AS run_scenario_label,
    r.output_preview_json AS run_output_preview_json,
    r.validation_warnings_json AS run_validation_warnings_json,
    r.brief_signature AS run_brief_signature,
    r.context_snapshot_json AS run_context_snapshot_json,
    COALESCE(
      r.opportunity_id,
      NULLIF((r.context_snapshot_json -> 'opportunity') ->> 'id', '')::uuid,
      CASE WHEN r.entity_type = 'opportunity' THEN r.entity_id ELSE NULL END,
      e.opportunity_id
    ) AS resolved_opportunity_id
  FROM ai_agent_approval_queue q
  JOIN ai_agent_execution_runs r ON r.id = q.run_id
  LEFT JOIN ai_agents a ON a.id = q.agent_id
  LEFT JOIN ai_email_messages e ON e.run_id = q.run_id
  WHERE q.status IN ('pending', 'send_failed')
    AND q.organization_id = public.get_user_organization_id()
    AND COALESCE(
      r.opportunity_id,
      NULLIF((r.context_snapshot_json -> 'opportunity') ->> 'id', '')::uuid,
      CASE WHEN r.entity_type = 'opportunity' THEN r.entity_id ELSE NULL END,
      e.opportunity_id
    ) = p_opportunity_id
  ORDER BY q.requested_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_opportunity_pending_approvals(uuid) TO authenticated;