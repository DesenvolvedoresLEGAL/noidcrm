
-- Fix 1: Scope team manager helpers to the caller's current organization
CREATE OR REPLACE FUNCTION public.get_team_member_ids(_manager_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(array_agg(DISTINCT tm.user_id), ARRAY[]::uuid[])
  FROM public.teams t
  JOIN public.team_members tm ON tm.team_id = t.id
  WHERE t.manager_id = _manager_id
    AND t.organization_id = public.get_user_organization_id();
$function$;

CREATE OR REPLACE FUNCTION public.is_team_manager(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.teams
    WHERE manager_id = _user_id
      AND organization_id = public.get_user_organization_id()
  );
$function$;

-- Fix 2: Restrict user_invitations SELECT to org admins only (tokens/emails)
DROP POLICY IF EXISTS "Users can view org invitations" ON public.user_invitations;
CREATE POLICY "Admins can view org invitations"
ON public.user_invitations
FOR SELECT
TO authenticated
USING (public.user_is_org_admin(organization_id));
