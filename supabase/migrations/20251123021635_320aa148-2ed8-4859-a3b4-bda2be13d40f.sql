-- =====================================================
-- FASE 1: CONTROLE DE ACESSO POR ROLE - NOID CRM
-- =====================================================

-- 1. Criar Security Definer Functions para controle de acesso
-- =====================================================

-- Função para verificar se usuário pode ver todos os registros (admin/manager)
CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Admin e Manager podem ver tudo
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'manager')
  )
  OR EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'manager')
  );
$$;

-- Função para verificar se usuário é admin/owner
CREATE OR REPLACE FUNCTION public.is_admin_or_owner(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin')
  );
$$;

-- 2. Atualizar RLS Policies - OPPORTUNITIES
-- =====================================================

-- Remover policy antiga
DROP POLICY IF EXISTS "Users can view org opportunities" ON opportunities;

-- Criar nova policy granular
CREATE POLICY "Users can view opportunities based on role" 
ON opportunities FOR SELECT
USING (
  organization_id = get_user_organization_id() 
  AND (
    -- Admin/Manager veem tudo
    can_view_all(auth.uid())
    OR
    -- Sales vê apenas suas próprias
    owner_user_id = auth.uid()
  )
);

-- 3. Atualizar RLS Policies - ACTIVITIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view org activities" ON activities;

CREATE POLICY "Users can view activities based on role"
ON activities FOR SELECT
USING (
  organization_id = get_user_organization_id()
  AND (
    can_view_all(auth.uid())
    OR
    owner_user_id = auth.uid()
  )
);

-- 4. Atualizar RLS Policies - ACCOUNTS
-- =====================================================

-- Manter policy de view como está (todos na org veem)
-- Em produção, considere filtrar por owner se accounts tiverem owner_user_id

-- 5. Atualizar RLS Policies - CONTACTS
-- =====================================================

-- Manter policy de view como está (todos na org veem)
-- Em produção, considere filtrar por owner se contacts tiverem owner_user_id

-- 6. Comentários de documentação
-- =====================================================
COMMENT ON FUNCTION public.can_view_all IS 
  'Retorna true se o usuário é admin ou manager e pode visualizar todos os registros da organização';

COMMENT ON FUNCTION public.is_admin_or_owner IS 
  'Retorna true se o usuário é owner ou admin da organização';

COMMENT ON POLICY "Users can view opportunities based on role" ON opportunities IS 
  'Admin/Manager visualizam todas as oportunidades. Vendedores visualizam apenas suas próprias oportunidades (owner_user_id)';

COMMENT ON POLICY "Users can view activities based on role" ON activities IS 
  'Admin/Manager visualizam todas as atividades. Vendedores visualizam apenas suas próprias atividades (owner_user_id)';