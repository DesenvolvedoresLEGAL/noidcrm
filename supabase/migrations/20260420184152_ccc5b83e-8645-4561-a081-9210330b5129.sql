
-- 1) Create ai_agent_feedback table
CREATE TABLE public.ai_agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  run_id uuid REFERENCES public.ai_agent_execution_runs(id) ON DELETE SET NULL,
  queue_id uuid,
  feedback_type text NOT NULL CHECK (feedback_type IN ('rejection', 'edit', 'positive')),
  feedback_text text,
  original_output_json jsonb DEFAULT '{}'::jsonb,
  edited_output_json jsonb,
  context_snapshot_json jsonb,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_agent_feedback_org_agent ON public.ai_agent_feedback(organization_id, agent_id);
CREATE INDEX idx_ai_agent_feedback_created ON public.ai_agent_feedback(created_at DESC);

ALTER TABLE public.ai_agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org feedback"
  ON public.ai_agent_feedback FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Members can insert org feedback"
  ON public.ai_agent_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

-- 2) Add scheduled_send_at to ai_email_messages
ALTER TABLE public.ai_email_messages
  ADD COLUMN IF NOT EXISTS scheduled_send_at timestamptz;
