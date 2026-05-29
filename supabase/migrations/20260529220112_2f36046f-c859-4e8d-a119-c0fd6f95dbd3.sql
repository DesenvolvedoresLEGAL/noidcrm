
-- ============================================================================
-- SECURITY FIX 1: proposal_views — restrict INSERT to org members of the proposal
-- ============================================================================
DROP POLICY IF EXISTS "System can insert proposal views" ON public.proposal_views;

CREATE POLICY "Org members can insert proposal views"
ON public.proposal_views
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.proposals p
    JOIN public.organization_members om
      ON om.organization_id = p.organization_id
    WHERE p.id = proposal_views.proposal_id
      AND om.user_id = auth.uid()
      AND om.status = 'active'
  )
);

-- Note: anonymous public-link view tracking continues to happen via edge
-- functions running with service_role, which bypasses RLS.

-- ============================================================================
-- SECURITY FIX 2: user_invitations — remove broad anon SELECT, expose
-- token lookup via SECURITY DEFINER RPC that requires the exact token.
-- ============================================================================
DROP POLICY IF EXISTS "Public can view invitation by token" ON public.user_invitations;

CREATE OR REPLACE FUNCTION public.get_invitation_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  email text,
  org_role text,
  organization_id uuid,
  team_id uuid,
  permission_set_id uuid,
  expires_at timestamptz,
  status text,
  invited_by uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ui.id,
    ui.email,
    ui.org_role,
    ui.organization_id,
    ui.team_id,
    ui.permission_set_id,
    ui.expires_at,
    ui.status,
    ui.invited_by
  FROM public.user_invitations ui
  WHERE ui.token = p_token
    AND ui.status = 'pending'
    AND ui.expires_at > now()
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_invitation_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_invitation_by_token(text) TO anon, authenticated;
