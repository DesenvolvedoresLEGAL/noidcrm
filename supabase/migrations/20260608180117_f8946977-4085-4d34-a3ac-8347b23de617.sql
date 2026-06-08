
-- 1) action_registry: require active org membership (was: any authenticated)
DROP POLICY IF EXISTS "Anyone authenticated can read action registry" ON public.action_registry;
CREATE POLICY "Org members can read action registry"
ON public.action_registry
FOR SELECT
TO authenticated
USING (
  is_active = true
  AND (
    public.is_platform_admin_for_rls(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  )
);

-- 2) ai_tools_registry: same scope-down
DROP POLICY IF EXISTS "authenticated_read_tools_registry" ON public.ai_tools_registry;
CREATE POLICY "Org members can read ai tools registry"
ON public.ai_tools_registry
FOR SELECT
TO authenticated
USING (
  public.is_platform_admin_for_rls(auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  )
);

-- 3) pending_release_changes: restrict to platform admins only (was: public)
DROP POLICY IF EXISTS "Anyone can view pending changes" ON public.pending_release_changes;
CREATE POLICY "Platform admins can view pending changes"
ON public.pending_release_changes
FOR SELECT
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()));
