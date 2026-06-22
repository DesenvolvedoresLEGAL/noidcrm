
-- 1) apollo_reveal_audit: restringir SELECT a admins de org
DROP POLICY IF EXISTS "Org members can read apollo reveal audit" ON public.apollo_reveal_audit;

CREATE POLICY "Org admins can read apollo reveal audit"
ON public.apollo_reveal_audit
FOR SELECT
TO authenticated
USING (
  public.is_org_admin(organization_id, auth.uid())
  OR public.is_platform_admin_for_rls(auth.uid())
);

-- 2) profiles: UPDATE WITH CHECK não pode referenciar profiles.organization_id como fonte de verdade.
-- Garantir que: (a) usuário só atualiza o próprio perfil, (b) se mudar organization_id, o destino
-- deve ser uma organização da qual ele é membro ativo (verificado via organization_members, sem
-- referenciar a linha sendo atualizada).
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (
  user_id = auth.uid()
  AND (
    organization_id IS NULL
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id = profiles.organization_id
        AND om.status = 'active'
    )
  )
);
