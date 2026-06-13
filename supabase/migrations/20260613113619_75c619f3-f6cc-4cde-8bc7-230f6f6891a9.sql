
-- =========================================================================
-- FIX 1: FORBIDDEN_RLS_SOURCE on profiles
-- Replace SELECT policies that rely on profiles.organization_id (untrusted
-- denormalized cache) with membership-based checks via organization_members.
-- =========================================================================

DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users view profiles in their org only" ON public.profiles;

CREATE POLICY "Users view profiles via active membership"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.organization_members me
    JOIN public.organization_members other
      ON other.organization_id = me.organization_id
    WHERE me.user_id = auth.uid()
      AND me.status = 'active'
      AND other.user_id = public.profiles.user_id
      AND other.status = 'active'
  )
);

-- Prevent regular users from changing their own profile.organization_id.
-- Only platform admins or org admins/owners of the target org may change it.
CREATE OR REPLACE FUNCTION public.prevent_profile_org_self_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    IF NOT public.is_platform_admin_for_rls(auth.uid())
       AND NOT (
         NEW.organization_id IS NOT NULL
         AND public.user_is_org_admin(NEW.organization_id)
       )
       AND NOT (
         OLD.organization_id IS NOT NULL
         AND public.user_is_org_admin(OLD.organization_id)
       )
    THEN
      RAISE EXCEPTION 'Not allowed to change profile organization_id'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_org_self_change ON public.profiles;
CREATE TRIGGER trg_prevent_profile_org_self_change
BEFORE UPDATE OF organization_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_org_self_change();


-- =========================================================================
-- FIX 2: PRIVILEGE_ESCALATION_CROSS_ORG_ROLE
-- can_view_all(_user_id) and is_admin_or_owner(_user_id) returned true if
-- the user held a privileged role in ANY org. Scope them to the user's
-- currently selected org (get_user_organization_id()) so the role check
-- aligns with the org row filter used in the same policies.
-- Also add explicit org-scoped overloads for future correctness.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND organization_id = public.get_user_organization_id()
      AND org_role IN ('owner', 'admin', 'finance', 'operations', 'cs')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND organization_id = public.get_user_organization_id()
      AND org_role IN ('owner', 'admin')
  );
$$;

-- Explicit org-scoped overloads for future use in cross-org policies
CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND organization_id = _org_id
      AND org_role IN ('owner', 'admin', 'finance', 'operations', 'cs')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid, _org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND organization_id = _org_id
      AND org_role IN ('owner', 'admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.can_view_all(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_view_all(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_owner(uuid, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
