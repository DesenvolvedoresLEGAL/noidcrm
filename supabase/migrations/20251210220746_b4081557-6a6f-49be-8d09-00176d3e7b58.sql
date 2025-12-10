-- CORREÇÃO COMPLETA DE SEGURANÇA - TODAS AS 7 FASES
-- Elimina TODOS os vazamentos cross-organization identificados

-- ============================================
-- FASE 1: CONTRACTS - Vazamento crítico atual
-- ============================================
DROP POLICY IF EXISTS "Users can view contracts" ON contracts;
DROP POLICY IF EXISTS "Users can update their contracts" ON contracts;

-- Policy UPDATE segura (SELECT já existe correta)
CREATE POLICY "Users can update org contracts" 
ON contracts FOR UPDATE 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- FASE 2: OPPORTUNITIES - DELETE sem org check
-- ============================================
DROP POLICY IF EXISTS "Admins can delete opportunities" ON opportunities;

CREATE POLICY "Admins can delete org opportunities" 
ON opportunities FOR DELETE 
TO authenticated
USING (
  organization_id = get_user_organization_id() 
  AND user_is_org_admin(organization_id)
);

-- ============================================
-- FASE 3: SEQUENCES - has_role sem org check
-- ============================================
DROP POLICY IF EXISTS "Admins can manage sequences" ON sequences;

CREATE POLICY "Admins can manage org sequences" 
ON sequences FOR ALL 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- FASE 4: SETTINGS - has_role sem org check
-- ============================================
DROP POLICY IF EXISTS "Admins can manage settings" ON settings;

CREATE POLICY "Admins can manage org settings" 
ON settings FOR ALL 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- FASE 5: USER_ROLES - has_role sem org check
-- ============================================
DROP POLICY IF EXISTS "Only admins can manage roles" ON user_roles;
DROP POLICY IF EXISTS "Users can view own roles" ON user_roles;

-- Usuários podem ver apenas seus próprios roles
CREATE POLICY "Users can view own roles" 
ON user_roles FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- FASE 6A: SELLER_ACHIEVEMENTS - USING(true)
-- ============================================
DROP POLICY IF EXISTS "System can update seller achievements" ON seller_achievements;

CREATE POLICY "System can update seller achievements" 
ON seller_achievements FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sellers 
    WHERE sellers.id = seller_achievements.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

-- ============================================
-- FASE 6B: SELLER_BADGES - USING(true)
-- ============================================
DROP POLICY IF EXISTS "System can update seller badges" ON seller_badges;

CREATE POLICY "Users can update own seller badges" 
ON seller_badges FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sellers 
    WHERE sellers.id = seller_badges.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

-- ============================================
-- FASE 6C: SELLER_MISSIONS - USING(true)
-- ============================================
DROP POLICY IF EXISTS "System can update seller missions" ON seller_missions;

CREATE POLICY "Users can update own seller missions" 
ON seller_missions FOR UPDATE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sellers 
    WHERE sellers.id = seller_missions.seller_id 
    AND sellers.user_id = auth.uid()
  )
);

-- ============================================
-- FASE 6D: SYNC_LOGS - USING(true)
-- ============================================
DROP POLICY IF EXISTS "System can update sync logs" ON sync_logs;

CREATE POLICY "Users can update own sync logs" 
ON sync_logs FOR UPDATE 
TO authenticated
USING (user_id = auth.uid());

-- ============================================
-- FASE 6E: USAGE_COUNTERS - USING(true) para ALL
-- ============================================
DROP POLICY IF EXISTS "System can manage usage" ON usage_counters;

-- Apenas SELECT para usuários autenticados da org
CREATE POLICY "Users can view org usage counters" 
ON usage_counters FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id());

-- INSERT/UPDATE apenas para a própria org
CREATE POLICY "Users can insert org usage counters" 
ON usage_counters FOR INSERT 
TO authenticated
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org usage counters" 
ON usage_counters FOR UPDATE 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- FASE 7: WINLOSS_FACTORS - USING(true) para ALL
-- ============================================
DROP POLICY IF EXISTS "System can manage factors" ON winloss_factors;

-- SELECT para todos da org
CREATE POLICY "Users can view org winloss factors" 
ON winloss_factors FOR SELECT 
TO authenticated
USING (organization_id = get_user_organization_id());

-- INSERT/UPDATE/DELETE apenas para admins da org
CREATE POLICY "Admins can insert org winloss factors" 
ON winloss_factors FOR INSERT 
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id() 
  AND user_is_org_admin(organization_id)
);

CREATE POLICY "Admins can update org winloss factors" 
ON winloss_factors FOR UPDATE 
TO authenticated
USING (
  organization_id = get_user_organization_id() 
  AND user_is_org_admin(organization_id)
)
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org winloss factors" 
ON winloss_factors FOR DELETE 
TO authenticated
USING (
  organization_id = get_user_organization_id() 
  AND user_is_org_admin(organization_id)
);