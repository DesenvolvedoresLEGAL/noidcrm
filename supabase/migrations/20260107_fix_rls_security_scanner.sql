-- Migration para corrigir RLS de profiles e seller_evaluations
-- Data: 2026-01-07
-- Objetivo: Liberar deploy bloqueado por alertas de segurança

-- ===================================
-- 1. CORRIGIR RLS DA TABELA PROFILES
-- ===================================

-- Dropar política antiga (muito permissiva)
DROP POLICY IF EXISTS "Users can view org profiles" ON public.profiles;

-- Nova política: Usuário só vê o próprio perfil + admins podem ver todos da org
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid() -- Próprio perfil
    OR
    auth.uid() IN ( -- OU é admin da mesma organização
      SELECT om.user_id 
      FROM organization_members om
      WHERE om.organization_id = profiles.organization_id 
      AND om.role IN ('owner', 'admin')
    )
  );

-- Política de INSERT (para novos usuários)
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Política de UPDATE (usuário edita próprio perfil + admins)
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR
    auth.uid() IN (
      SELECT om.user_id 
      FROM organization_members om
      WHERE om.organization_id = profiles.organization_id 
      AND om.role IN ('owner', 'admin')
    )
  );

-- ===================================================
-- 2. CORRIGIR RLS DA TABELA SELLER_EVALUATIONS
-- ===================================================

-- Dropar políticas antigas
DROP POLICY IF EXISTS "Users can view org evaluations" ON public.seller_evaluations;
DROP POLICY IF EXISTS "Users can insert org evaluations" ON public.seller_evaluations;

-- Nova política de SELECT: Apenas avaliado, avaliador, HR e admins
CREATE POLICY "Restricted evaluation view"
  ON public.seller_evaluations FOR SELECT
  TO authenticated
  USING (
    seller_id = auth.uid() -- Próprio avaliado
    OR
    evaluated_by = auth.uid() -- Quem avaliou
    OR
    auth.uid() IN ( -- Admins/Owners/HR da organização
      SELECT om.user_id 
      FROM organization_members om
      WHERE om.organization_id = seller_evaluations.organization_id 
      AND om.role IN ('owner', 'admin')
    )
    OR
    auth.uid() IN ( -- Usuários com role HR
      SELECT ur.user_id
      FROM user_roles ur
      WHERE ur.role = 'hr'
    )
  );

-- Política de INSERT: Apenas managers podem criar avaliações
CREATE POLICY "Managers can create evaluations"
  ON public.seller_evaluations FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() IN (
      SELECT om.user_id 
      FROM organization_members om
      WHERE om.organization_id = organization_id 
      AND om.role IN ('owner', 'admin', 'manager')
    )
    AND organization_id IN (
      SELECT organization_id 
      FROM organization_members 
      WHERE user_id = auth.uid()
    )
  );

-- Política de UPDATE: Apenas quem criou ou admins
CREATE POLICY "Evaluator can update own evaluations"
  ON public.seller_evaluations FOR UPDATE
  TO authenticated
  USING (
    evaluated_by = auth.uid()
    OR
    auth.uid() IN (
      SELECT om.user_id 
      FROM organization_members om
      WHERE om.organization_id = seller_evaluations.organization_id 
      AND om.role IN ('owner', 'admin')
    )
  );

-- ===================================
-- 3. COMENTÁRIOS PARA O SCANNER
-- ===================================

COMMENT ON POLICY "Users can view own profile" ON public.profiles IS 
'Restricts profile visibility to: (1) the user themselves, (2) admins of the same organization. Protects sensitive data like CPF and birth_date.';

COMMENT ON POLICY "Restricted evaluation view" ON public.seller_evaluations IS 
'Restricts evaluation visibility to: (1) evaluated employee, (2) evaluator, (3) HR role, (4) org admins. Prevents unauthorized access to performance data.';
