CREATE POLICY nsec12_activities_insert_opportunity_tenant_guard
ON public.activities
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  opportunity_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = activities.opportunity_id
      AND o.organization_id = activities.organization_id
  )
);

CREATE POLICY nsec12_proposals_insert_opportunity_tenant_guard
ON public.proposals
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = proposals.opportunity_id
      AND o.organization_id = proposals.organization_id
  )
);