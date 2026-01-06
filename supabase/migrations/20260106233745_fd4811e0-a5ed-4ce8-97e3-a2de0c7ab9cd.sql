-- MIGRAÇÃO 2: Proteger Tabelas Críticas (profiles, organization_members)

-- 2.1 PROFILES - Remover políticas duplicadas e criar políticas seguras
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Org admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users or org admins can update profiles" ON profiles;

-- Usuários só podem editar seu próprio perfil
CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2.2 ORGANIZATION_MEMBERS - Corrigir INSERT com WITH CHECK (true)
DROP POLICY IF EXISTS "System can insert members" ON organization_members;

-- Criar política segura para INSERT
CREATE POLICY "Org admins can insert members"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (
  user_is_org_admin(organization_id)
  OR is_platform_super_admin(auth.uid())
);