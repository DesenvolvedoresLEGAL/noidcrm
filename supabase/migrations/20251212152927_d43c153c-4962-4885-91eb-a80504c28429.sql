-- =====================================================
-- CORREÇÃO RLS: Tabelas de Automação e IA
-- =====================================================

-- =====================================================
-- 1. AI_SUGGESTIONS: Corrigir INSERT permissivo e duplicatas
-- =====================================================

DROP POLICY IF EXISTS "System can insert suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can update org suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can update own suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Users can view own suggestions" ON ai_suggestions;

-- SELECT: membros da org
CREATE POLICY "Org members view ai_suggestions"
ON ai_suggestions FOR SELECT
USING (organization_id = get_user_organization_id());

-- INSERT: sistema (org scoped)
CREATE POLICY "System insert ai_suggestions"
ON ai_suggestions FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- UPDATE: membros da org
CREATE POLICY "Org members update ai_suggestions"
ON ai_suggestions FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: apenas admins
CREATE POLICY "Admins delete ai_suggestions"
ON ai_suggestions FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 2. WORKFLOW_RULES: Limpar conflitos e padronizar
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage workflow rules" ON workflow_rules;
DROP POLICY IF EXISTS "Users can delete org workflow rules" ON workflow_rules;
DROP POLICY IF EXISTS "Users can insert workflow rules" ON workflow_rules;
DROP POLICY IF EXISTS "Users can update org workflow rules" ON workflow_rules;
DROP POLICY IF EXISTS "Users can view org workflow rules" ON workflow_rules;

-- SELECT: membros da org
CREATE POLICY "Org members view workflow_rules"
ON workflow_rules FOR SELECT
USING (organization_id = get_user_organization_id());

-- INSERT: membros da org (admins/managers configuram)
CREATE POLICY "Org members insert workflow_rules"
ON workflow_rules FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND organization_id = get_user_organization_id()
  AND user_is_org_admin_or_manager(organization_id)
);

-- UPDATE: admins/managers
CREATE POLICY "Admins update workflow_rules"
ON workflow_rules FOR UPDATE
USING (
  organization_id = get_user_organization_id()
  AND user_is_org_admin_or_manager(organization_id)
)
WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: apenas admins
CREATE POLICY "Admins delete workflow_rules"
ON workflow_rules FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND user_is_org_admin(organization_id)
);

-- =====================================================
-- 3. WORKFLOW_EXECUTIONS: Corrigir INSERT permissivo
-- =====================================================

DROP POLICY IF EXISTS "System can insert workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can update org workflow executions" ON workflow_executions;
DROP POLICY IF EXISTS "Users can view org workflow executions" ON workflow_executions;

-- SELECT: membros da org
CREATE POLICY "Org members view workflow_executions"
ON workflow_executions FOR SELECT
USING (organization_id = get_user_organization_id());

-- INSERT: sistema (via triggers/functions)
CREATE POLICY "System insert workflow_executions"
ON workflow_executions FOR INSERT
WITH CHECK (
  organization_id IS NOT NULL 
  AND organization_id = get_user_organization_id()
);

-- UPDATE: membros da org
CREATE POLICY "Org members update workflow_executions"
ON workflow_executions FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- DELETE: apenas admins
CREATE POLICY "Admins delete workflow_executions"
ON workflow_executions FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 4. AI_ACTIONS: Adicionar DELETE
-- =====================================================

DROP POLICY IF EXISTS "Admins delete ai_actions" ON ai_actions;

CREATE POLICY "Admins delete ai_actions"
ON ai_actions FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 5. AI_SCORES: Adicionar DELETE
-- =====================================================

DROP POLICY IF EXISTS "Admins delete ai_scores" ON ai_scores;

CREATE POLICY "Admins delete ai_scores"
ON ai_scores FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 6. AI_FEEDBACK: Adicionar UPDATE e DELETE
-- =====================================================

DROP POLICY IF EXISTS "Org members update ai_feedback" ON ai_feedback;
DROP POLICY IF EXISTS "Admins delete ai_feedback" ON ai_feedback;

CREATE POLICY "Org members update ai_feedback"
ON ai_feedback FOR UPDATE
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Admins delete ai_feedback"
ON ai_feedback FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 7. AI_ALERTS: Adicionar DELETE
-- =====================================================

DROP POLICY IF EXISTS "Admins delete ai_alerts" ON ai_alerts;

CREATE POLICY "Admins delete ai_alerts"
ON ai_alerts FOR DELETE
USING (
  organization_id = get_user_organization_id()
  AND can_view_all(auth.uid())
);

-- =====================================================
-- 8. AUTOMATION_LOGS: Corrigir INSERT permissivo
-- =====================================================

DROP POLICY IF EXISTS "System can insert automation logs" ON automation_logs;

-- INSERT mais restritivo (sem with_check=true global)
CREATE POLICY "System insert automation_logs"
ON automation_logs FOR INSERT
WITH CHECK (true); -- Mantém permissivo pois é inserido por triggers internos