CREATE OR REPLACE FUNCTION public.user_can_access_proposal(_organization_id uuid, _opportunity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (
    _organization_id = public.get_user_organization_id()
    AND (
      public.can_view_all(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.opportunities o
        WHERE o.id = _opportunity_id
          AND o.owner_user_id = auth.uid()
      )
      OR (
        public.is_team_manager(auth.uid())
        AND EXISTS (
          SELECT 1
          FROM public.opportunities o
          WHERE o.id = _opportunity_id
            AND o.owner_user_id = ANY (public.get_team_member_ids(auth.uid()))
        )
      )
    )
  );
$$;

DROP POLICY IF EXISTS proposals_select_by_visibility ON public.proposals;

CREATE POLICY proposals_select_by_visibility
ON public.proposals
FOR SELECT
TO authenticated
USING (public.user_can_access_proposal(organization_id, opportunity_id));