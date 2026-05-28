
-- ============================================================================
-- Security hotfix: 5 RLS findings from scanner (2026-05-28)
-- ============================================================================

-- 1) ai_agent_test_scenarios: split ALL policy into per-op so DELETE of global
--    templates (organization_id IS NULL) is blocked.
DROP POLICY IF EXISTS "org members can manage test scenarios" ON public.ai_agent_test_scenarios;

CREATE POLICY "org members can select test scenarios"
ON public.ai_agent_test_scenarios
FOR SELECT TO authenticated
USING (
  (organization_id IS NULL)
  OR (organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid()))
);

CREATE POLICY "org members can insert test scenarios"
ON public.ai_agent_test_scenarios
FOR INSERT TO authenticated
WITH CHECK (
  organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid())
);

CREATE POLICY "org members can update test scenarios"
ON public.ai_agent_test_scenarios
FOR UPDATE TO authenticated
USING (
  organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid())
)
WITH CHECK (
  organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid())
);

CREATE POLICY "org members can delete test scenarios"
ON public.ai_agent_test_scenarios
FOR DELETE TO authenticated
USING (
  organization_id IS NOT NULL
  AND organization_id IN (SELECT om.organization_id FROM public.organization_members om WHERE om.user_id = auth.uid())
);

-- 2) automation_logs: INSERT must reference an opportunity in caller's org.
DROP POLICY IF EXISTS "Authenticated can insert automation_logs" ON public.automation_logs;
DROP POLICY IF EXISTS "System insert automation_logs" ON public.automation_logs;

CREATE POLICY "Org members can insert automation_logs"
ON public.automation_logs
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.opportunities o
    JOIN public.organization_members om
      ON om.organization_id = o.organization_id
     AND om.user_id = auth.uid()
    WHERE o.id = automation_logs.opportunity_id
  )
);

-- 3) pending_release_changes: restrict UPDATE to platform admins.
DROP POLICY IF EXISTS "Authenticated can update pending changes" ON public.pending_release_changes;

CREATE POLICY "Platform admins can update pending changes"
ON public.pending_release_changes
FOR UPDATE TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()))
WITH CHECK (public.is_platform_admin_for_rls(auth.uid()));

-- 4) public_form_submissions: INSERT only when form is public and org matches.
DROP POLICY IF EXISTS "Anyone can submit public forms" ON public.public_form_submissions;

CREATE POLICY "Anyone can submit enabled public forms"
ON public.public_form_submissions
FOR INSERT TO public
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.custom_forms cf
    WHERE cf.id = public_form_submissions.form_id
      AND cf.is_public = true
      AND cf.organization_id = public_form_submissions.organization_id
  )
);

-- 5) scheduled_demos: INSERT must reference an available slot in same org.
DROP POLICY IF EXISTS "Anyone can schedule demos" ON public.scheduled_demos;

CREATE POLICY "Anyone can schedule demos on valid slots"
ON public.scheduled_demos
FOR INSERT TO public
WITH CHECK (
  slot_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM public.demo_slots ds
    WHERE ds.id = scheduled_demos.slot_id
      AND ds.organization_id = scheduled_demos.organization_id
  )
);
