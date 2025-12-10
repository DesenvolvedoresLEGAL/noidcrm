-- CORREÇÕES CRÍTICAS DE SEGURANÇA: Fase 2 (Continuação)
-- Corrige as tabelas restantes que não foram aplicadas

-- ============================================
-- 3. REVENUE_EVENTS: Remover policy perigosa (SELECT já existe)
-- ============================================
DROP POLICY IF EXISTS "System can manage revenue events" ON revenue_events;
DROP POLICY IF EXISTS "System can insert revenue events" ON revenue_events;

-- Sistema pode inserir eventos (triggers/funções)
CREATE POLICY "System can insert revenue events" 
ON revenue_events FOR INSERT 
TO authenticated
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- 4. AI_SCORES: Restringir acesso (era public com USING true para ALL)
-- ============================================
DROP POLICY IF EXISTS "System can manage ai scores" ON ai_scores;
DROP POLICY IF EXISTS "System can manage ai scores insert" ON ai_scores;
DROP POLICY IF EXISTS "System can manage ai scores update" ON ai_scores;

-- Criar policy para INSERT/UPDATE apenas para mesma organização
CREATE POLICY "System can manage ai scores insert" 
ON ai_scores FOR INSERT 
TO authenticated
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "System can manage ai scores update" 
ON ai_scores FOR UPDATE 
TO authenticated
USING (organization_id = get_user_organization_id());

-- ============================================
-- 5. AI_SUGGESTIONS: Restringir UPDATE
-- ============================================
DROP POLICY IF EXISTS "System can update suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can update org suggestions" ON ai_suggestions;

CREATE POLICY "Users can update org suggestions" 
ON ai_suggestions FOR UPDATE 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- ============================================
-- 6. WORKFLOW_EXECUTIONS: Restringir UPDATE
-- ============================================
DROP POLICY IF EXISTS "System can update workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can update org workflow executions" ON workflow_executions;

CREATE POLICY "Users can update org workflow executions" 
ON workflow_executions FOR UPDATE 
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());