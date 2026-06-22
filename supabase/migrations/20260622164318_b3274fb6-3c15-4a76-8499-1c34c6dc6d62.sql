
-- KAI.19 — SDR Copilot tasks
CREATE TABLE public.kairos_sdr_copilot_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  queue_id uuid NOT NULL REFERENCES public.kairos_qualified_queue(id) ON DELETE CASCADE,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE SET NULL,
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','in_review','approved','activity_created','promoted_to_crm','dismissed','completed')),
  priority_score numeric NOT NULL DEFAULT 0,
  preferred_channel text
    CHECK (preferred_channel IS NULL OR preferred_channel IN ('whatsapp','email','linkedin','call')),
  next_best_action text
    CHECK (next_best_action IS NULL OR next_best_action IN ('call','whatsapp','email','linkedin','create_activity','promote_to_crm','reactivate_customer','review_duplicate','discard')),
  reason text,
  commercial_brief jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_messages jsonb NOT NULL DEFAULT '{}'::jsonb,
  objections jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE ON public.kairos_sdr_copilot_tasks TO authenticated;
GRANT ALL ON public.kairos_sdr_copilot_tasks TO service_role;

ALTER TABLE public.kairos_sdr_copilot_tasks ENABLE ROW LEVEL SECURITY;

-- Unique active task per queue item
CREATE UNIQUE INDEX kairos_sdr_copilot_tasks_queue_active_uniq
  ON public.kairos_sdr_copilot_tasks (queue_id)
  WHERE status NOT IN ('completed','dismissed','promoted_to_crm');

CREATE INDEX idx_kairos_sdr_copilot_org_status_priority
  ON public.kairos_sdr_copilot_tasks (organization_id, status, priority_score DESC);
CREATE INDEX idx_kairos_sdr_copilot_assigned_status
  ON public.kairos_sdr_copilot_tasks (assigned_to, status);
CREATE INDEX idx_kairos_sdr_copilot_queue
  ON public.kairos_sdr_copilot_tasks (queue_id);

-- updated_at trigger
CREATE TRIGGER trg_kairos_sdr_copilot_tasks_updated_at
  BEFORE UPDATE ON public.kairos_sdr_copilot_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS helper: is user a manager-level role in this org?
-- Reuses existing has_role(user_id, role) function for admin/owner/manager checks.

-- SELECT: managers see all in org; SDRs see own or unassigned
CREATE POLICY "sdr_copilot_select_org"
ON public.kairos_sdr_copilot_tasks
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  )
);

-- INSERT: any org member
CREATE POLICY "sdr_copilot_insert_org"
ON public.kairos_sdr_copilot_tasks
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

-- UPDATE: org members may update; assigned_to changes restricted by app logic
-- (full UPDATE allowed; reassignment governance lives in service layer + audit)
CREATE POLICY "sdr_copilot_update_org"
ON public.kairos_sdr_copilot_tasks
FOR UPDATE
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
  AND (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'owner')
    OR public.has_role(auth.uid(), 'manager')
    OR assigned_to = auth.uid()
    OR assigned_to IS NULL
  )
)
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

COMMENT ON TABLE public.kairos_sdr_copilot_tasks IS
  'KAI.19 SDR Copilot: prepared, assistive tasks for pre-sales. Never sends messages or creates activities automatically.';
