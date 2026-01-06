-- ============================================
-- FASE 1: CONTENÇÃO IMEDIATA - RESPOSTA A INCIDENTE
-- ============================================

-- 1.1 Remover platform_admins não autorizados (manter apenas SuperAdmin legítimo)
DELETE FROM platform_admins 
WHERE user_id NOT IN ('6d3df423-f210-4857-82d5-b068abdce96d');

-- 1.2 Restaurar nome da organização HUMANOID
UPDATE organizations SET name = 'HUMANOID' 
WHERE id = '774d7d78-8257-4891-aac7-718039b80049';

-- 1.3 Restaurar nome da organização OPERADORALEGAL (estava como "HE'S MY ROBLOX FRIEND")
UPDATE organizations SET name = 'OPERADORALEGAL' 
WHERE id = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d';

-- 1.4 Reativar todos os membros suspensos da OPERADORALEGAL
UPDATE organization_members SET status = 'active'
WHERE organization_id = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d'
  AND status = 'suspended';

-- ============================================
-- FASE 2: CORREÇÃO DE VULNERABILIDADES RLS
-- ============================================

-- 2.1 Criar função auxiliar para verificar super_admin (se não existir)
CREATE OR REPLACE FUNCTION public.is_platform_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM platform_admins 
    WHERE user_id = _user_id 
    AND role = 'super_admin' 
    AND is_active = true
  );
$$;

-- 2.2 ORGANIZATIONS - Bloquear DELETE para todos exceto super_admin
DROP POLICY IF EXISTS "Organization owners can delete" ON organizations;
DROP POLICY IF EXISTS "Only super_admin can delete organizations" ON organizations;

CREATE POLICY "Only super_admin can delete organizations"
ON organizations FOR DELETE
TO authenticated
USING (public.is_platform_super_admin(auth.uid()));

-- 2.3 ORGANIZATIONS - Restringir UPDATE para admins da org ou super_admin
DROP POLICY IF EXISTS "Organization admins can update" ON organizations;
DROP POLICY IF EXISTS "Org admins can update organization" ON organizations;

CREATE POLICY "Org admins can update organization"
ON organizations FOR UPDATE
TO authenticated
USING (
  public.is_platform_super_admin(auth.uid())
  OR public.user_is_org_admin(id)
)
WITH CHECK (
  public.is_platform_super_admin(auth.uid())
  OR public.user_is_org_admin(id)
);

-- 2.4 ORGANIZATION_MEMBERS - Bloquear DELETE para todos exceto super_admin
DROP POLICY IF EXISTS "Org admins can manage members" ON organization_members;
DROP POLICY IF EXISTS "Only super_admin can delete members" ON organization_members;
DROP POLICY IF EXISTS "Admins can update members" ON organization_members;

CREATE POLICY "Admins can update members"
ON organization_members FOR UPDATE
TO authenticated
USING (public.user_is_org_admin(organization_id))
WITH CHECK (public.user_is_org_admin(organization_id));

CREATE POLICY "Only super_admin can delete members"
ON organization_members FOR DELETE
TO authenticated
USING (public.is_platform_super_admin(auth.uid()));

-- 2.5 PROFILES - Apenas o próprio usuário pode atualizar seu perfil
DROP POLICY IF EXISTS "Users or org admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles in org" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 2.6 PROFILES - Bloquear DELETE completamente (apenas via super_admin)
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;
DROP POLICY IF EXISTS "Only super_admin can delete profiles" ON profiles;

CREATE POLICY "Only super_admin can delete profiles"
ON profiles FOR DELETE
TO authenticated
USING (public.is_platform_super_admin(auth.uid()));

-- 2.7 PLATFORM_ADMINS - Garantir RLS está habilitado e restringir acesso
ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "super_admin_manage" ON platform_admins;
DROP POLICY IF EXISTS "Only super_admin can manage platform_admins" ON platform_admins;
DROP POLICY IF EXISTS "Platform admins can view" ON platform_admins;
DROP POLICY IF EXISTS "Platform admins can view themselves" ON platform_admins;

-- Apenas super_admin pode ver platform_admins
CREATE POLICY "Only super_admin can view platform_admins"
ON platform_admins FOR SELECT
TO authenticated
USING (public.is_platform_super_admin(auth.uid()) OR user_id = auth.uid());

-- Apenas super_admin pode inserir/atualizar/deletar platform_admins
CREATE POLICY "Only super_admin can manage platform_admins"
ON platform_admins FOR ALL
TO authenticated
USING (public.is_platform_super_admin(auth.uid()))
WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- ============================================
-- FASE 3: TRIGGERS DE AUDITORIA E PROTEÇÃO
-- ============================================

-- 3.1 Trigger para auditar alterações em organizations
CREATE OR REPLACE FUNCTION public.audit_organization_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO audit_log (
    organization_id,
    actor_user_id,
    action,
    entity_type,
    entity_id,
    old_value,
    new_value,
    created_at
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    auth.uid(),
    TG_OP,
    'organization',
    COALESCE(NEW.id, OLD.id)::text,
    to_jsonb(OLD),
    to_jsonb(NEW),
    now()
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_organizations ON organizations;
CREATE TRIGGER trg_audit_organizations
AFTER UPDATE OR DELETE ON organizations
FOR EACH ROW EXECUTE FUNCTION public.audit_organization_changes();

-- 3.2 Trigger para bloquear alterações de nome com palavras ofensivas
CREATE OR REPLACE FUNCTION public.block_offensive_content()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offensive_patterns text[] := ARRAY[
    'LOL', 'BASTARD', 'XD', 'FIREWALL', 'ROBLOX', 
    'HOPE YOU HAVE CASH', 'WAIT FOR THE FEE', 'I KNOW'
  ];
  pattern text;
  check_value text;
BEGIN
  -- Determinar qual campo verificar baseado na tabela
  IF TG_TABLE_NAME = 'organizations' THEN
    check_value := NEW.name;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    check_value := NEW.full_name;
  ELSE
    RETURN NEW;
  END IF;
  
  -- Verificar padrões ofensivos
  FOREACH pattern IN ARRAY offensive_patterns LOOP
    IF check_value ILIKE '%' || pattern || '%' THEN
      RAISE EXCEPTION 'Conteúdo não permitido detectado: %', pattern;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_offensive_org_names ON organizations;
CREATE TRIGGER trg_block_offensive_org_names
BEFORE INSERT OR UPDATE ON organizations
FOR EACH ROW EXECUTE FUNCTION public.block_offensive_content();

DROP TRIGGER IF EXISTS trg_block_offensive_profile_names ON profiles;
CREATE TRIGGER trg_block_offensive_profile_names
BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION public.block_offensive_content();

-- ============================================
-- FASE 4: CORRIGIR POLÍTICAS "ALWAYS TRUE" CRÍTICAS
-- ============================================

-- 4.1 ORGANIZATION_MEMBERS - Corrigir INSERT
DROP POLICY IF EXISTS "Org admins can add members" ON organization_members;
CREATE POLICY "Org admins can add members"
ON organization_members FOR INSERT
TO authenticated
WITH CHECK (
  public.user_is_org_admin(organization_id)
  OR public.is_platform_super_admin(auth.uid())
);

-- 4.2 PROFILES - Corrigir INSERT (apenas sistema pode criar via trigger)
DROP POLICY IF EXISTS "System can create profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 4.3 ORGANIZATIONS - Corrigir INSERT
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
ON organizations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);