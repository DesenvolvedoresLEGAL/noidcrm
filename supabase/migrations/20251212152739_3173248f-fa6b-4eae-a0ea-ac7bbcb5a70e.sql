-- =====================================================
-- CORREÇÃO COMPLETA DAS POLÍTICAS RLS
-- Resolver conflitos, duplicatas e políticas faltantes
-- =====================================================

-- =====================================================
-- 1. OPPORTUNITIES: Corrigir conflito DELETE
-- =====================================================

-- Remover política permissiva que permite qualquer membro deletar
DROP POLICY IF EXISTS "opportunities_delete_org_members" ON opportunities;

-- Manter apenas a política restritiva para admins
-- (já existe "Admins can delete org opportunities")

-- Limpar políticas duplicadas de SELECT
DROP POLICY IF EXISTS "opportunities_select_org_members" ON opportunities;
DROP POLICY IF EXISTS "Users view opportunities by hierarchy" ON opportunities;

-- Criar política SELECT unificada
CREATE POLICY "Org members view opportunities"
ON opportunities FOR SELECT
USING (organization_id = get_user_organization_id());

-- Limpar políticas duplicadas de INSERT
DROP POLICY IF EXISTS "opportunities_insert_org_members" ON opportunities;
DROP POLICY IF EXISTS "Org members insert opportunities" ON opportunities;

-- Criar política INSERT unificada
CREATE POLICY "Org members insert opportunities"
ON opportunities FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND auth.uid() IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- Limpar políticas duplicadas de UPDATE
DROP POLICY IF EXISTS "opportunities_update_org_members" ON opportunities;
DROP POLICY IF EXISTS "Admins and managers can update any org opportunity" ON opportunities;
DROP POLICY IF EXISTS "Users update own opportunities" ON opportunities;

-- Criar política UPDATE unificada (org members podem editar)
CREATE POLICY "Org members update opportunities"
ON opportunities FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- =====================================================
-- 2. CONTACTS: Limpar políticas duplicadas
-- =====================================================

DROP POLICY IF EXISTS "contacts_select_org_members" ON contacts;
DROP POLICY IF EXISTS "Users view contacts by role and ownership" ON contacts;

-- SELECT já existe como "Users view org contacts"

-- Limpar INSERT duplicados
DROP POLICY IF EXISTS "contacts_insert_org_members" ON contacts;
DROP POLICY IF EXISTS "Users can insert contacts" ON contacts;

-- INSERT já existe como "Users insert contacts in own org"

-- Limpar UPDATE duplicados
DROP POLICY IF EXISTS "contacts_update_org_members" ON contacts;
DROP POLICY IF EXISTS "Users can update contacts" ON contacts;

-- UPDATE já existe como "Users update contacts in own org"

-- Adicionar DELETE para contacts (apenas admins)
DROP POLICY IF EXISTS "contacts_delete_org_members" ON contacts;
DROP POLICY IF EXISTS "Admins delete contacts" ON contacts;

CREATE POLICY "Admins delete contacts"
ON contacts FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 3. PROPOSALS: Limpar políticas duplicadas
-- =====================================================

DROP POLICY IF EXISTS "proposals_select_org_members" ON proposals;
DROP POLICY IF EXISTS "Users view proposals by hierarchy" ON proposals;

-- Criar política SELECT unificada
CREATE POLICY "Org members view proposals"
ON proposals FOR SELECT
USING (organization_id = get_user_organization_id());

-- Limpar INSERT duplicados
DROP POLICY IF EXISTS "proposals_insert_org_members" ON proposals;
DROP POLICY IF EXISTS "Users insert proposals" ON proposals;

-- Criar política INSERT unificada
CREATE POLICY "Org members insert proposals"
ON proposals FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND auth.uid() IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- Limpar UPDATE duplicados
DROP POLICY IF EXISTS "proposals_update_org_members" ON proposals;
DROP POLICY IF EXISTS "Users update own proposals" ON proposals;

-- Criar política UPDATE unificada
CREATE POLICY "Org members update proposals"
ON proposals FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- Adicionar DELETE para proposals (apenas admins)
DROP POLICY IF EXISTS "proposals_delete_org_members" ON proposals;
DROP POLICY IF EXISTS "Admins delete proposals" ON proposals;

CREATE POLICY "Admins delete proposals"
ON proposals FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 4. CONTRACTS: Adicionar política DELETE faltante
-- =====================================================

DROP POLICY IF EXISTS "Admins delete contracts" ON contracts;

CREATE POLICY "Admins delete contracts"
ON contracts FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 5. ACTIVITIES: Verificar e padronizar
-- =====================================================

DROP POLICY IF EXISTS "activities_select_org_members" ON activities;
DROP POLICY IF EXISTS "Users view activities by hierarchy" ON activities;

-- Criar política SELECT unificada
CREATE POLICY "Org members view activities"
ON activities FOR SELECT
USING (organization_id = get_user_organization_id());

-- Limpar INSERT duplicados
DROP POLICY IF EXISTS "activities_insert_org_members" ON activities;
DROP POLICY IF EXISTS "Users insert activities" ON activities;

-- Criar política INSERT unificada
CREATE POLICY "Org members insert activities"
ON activities FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND auth.uid() IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- Limpar UPDATE duplicados
DROP POLICY IF EXISTS "activities_update_org_members" ON activities;
DROP POLICY IF EXISTS "Users update own activities" ON activities;

-- Criar política UPDATE unificada
CREATE POLICY "Org members update activities"
ON activities FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- Adicionar DELETE para activities (apenas admins)
DROP POLICY IF EXISTS "activities_delete_org_members" ON activities;
DROP POLICY IF EXISTS "Admins delete activities" ON activities;

CREATE POLICY "Admins delete activities"
ON activities FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);