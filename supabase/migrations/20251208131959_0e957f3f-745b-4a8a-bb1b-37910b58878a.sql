-- Simplificar RLS de opportunities - remover todas as políticas complexas
-- e criar políticas simples onde todos os membros veem tudo da organização

-- Remover TODAS as políticas existentes de opportunities
DROP POLICY IF EXISTS "Users can view opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can view org opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can select opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can insert opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can update opportunities" ON opportunities;
DROP POLICY IF EXISTS "Org admins and managers can update any opportunity" ON opportunities;
DROP POLICY IF EXISTS "Users can delete opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can delete own opportunities" ON opportunities;

-- SELECT: Todos os membros ativos veem todas as oportunidades da organização
CREATE POLICY "opportunities_select_org_members"
ON opportunities
FOR SELECT
TO authenticated
USING (
  organization_id = get_user_organization_id()
);

-- INSERT: Todos os membros ativos podem criar oportunidades na organização
CREATE POLICY "opportunities_insert_org_members"
ON opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
);

-- UPDATE: Todos os membros ativos podem atualizar oportunidades da organização
CREATE POLICY "opportunities_update_org_members"
ON opportunities
FOR UPDATE
TO authenticated
USING (
  organization_id = get_user_organization_id()
);

-- DELETE: Todos os membros ativos podem deletar oportunidades da organização
CREATE POLICY "opportunities_delete_org_members"
ON opportunities
FOR DELETE
TO authenticated
USING (
  organization_id = get_user_organization_id()
);