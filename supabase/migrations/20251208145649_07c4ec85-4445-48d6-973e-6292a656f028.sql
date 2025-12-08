-- Criar função para verificar se usuário é CS
CREATE OR REPLACE FUNCTION public.user_is_cs(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND org_role = 'cs'
      AND status = 'active'
  )
$$;

-- Criar função para verificar se usuário é admin, manager ou CS (para permissões intermediárias)
CREATE OR REPLACE FUNCTION public.user_is_org_admin_manager_or_cs(_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = auth.uid()
      AND organization_id = _org_id
      AND org_role IN ('owner', 'admin', 'manager', 'cs')
      AND status = 'active'
  )
$$;