-- =====================================================
-- FIX CRÍTICO: Políticas RLS para accounts, contacts, opportunities
-- Permitir que TODOS os membros da org vejam e criem registros
-- =====================================================

-- ACCOUNTS: Corrigir política SELECT (muito restritiva)
DROP POLICY IF EXISTS "Users view accounts by role and ownership" ON accounts;

CREATE POLICY "Users view org accounts"
ON accounts FOR SELECT
USING (organization_id = get_user_organization_id());

-- ACCOUNTS: Simplificar política INSERT
DROP POLICY IF EXISTS "Users can insert org accounts" ON accounts;
DROP POLICY IF EXISTS "Users insert accounts in own org" ON accounts;

CREATE POLICY "Users insert accounts in own org"
ON accounts FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND auth.uid() IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- ACCOUNTS: Corrigir política UPDATE
DROP POLICY IF EXISTS "Users can update org accounts" ON accounts;
DROP POLICY IF EXISTS "Users update accounts in own org" ON accounts;

CREATE POLICY "Users update accounts in own org"
ON accounts FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ACCOUNTS: Corrigir política DELETE (apenas admin/owner)
DROP POLICY IF EXISTS "Admins can delete org accounts" ON accounts;
DROP POLICY IF EXISTS "Admins delete accounts in own org" ON accounts;

CREATE POLICY "Admins delete accounts in own org"
ON accounts FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- CONTACTS: Aplicar mesma correção
-- =====================================================

DROP POLICY IF EXISTS "Users view contacts by role and ownership" ON contacts;

CREATE POLICY "Users view org contacts"
ON contacts FOR SELECT
USING (organization_id = get_user_organization_id());

DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;
DROP POLICY IF EXISTS "Users insert contacts in own org" ON contacts;

CREATE POLICY "Users insert contacts in own org"
ON contacts FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND auth.uid() IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

DROP POLICY IF EXISTS "Users can update contacts" ON contacts;
DROP POLICY IF EXISTS "Users update contacts in own org" ON contacts;

CREATE POLICY "Users update contacts in own org"
ON contacts FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());