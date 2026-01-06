-- ============================================
-- FASE 5: CORRIGIR POLÍTICAS "ALWAYS TRUE" RESTANTES
-- ============================================

-- 5.1 AI_RUNS - Corrigir INSERT com organização
DROP POLICY IF EXISTS "System can insert ai_runs" ON ai_runs;
DROP POLICY IF EXISTS "Org members can insert ai_runs" ON ai_runs;
CREATE POLICY "Org members can insert ai_runs"
ON ai_runs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.2 AI_USAGE_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_usage_logs" ON ai_usage_logs;
DROP POLICY IF EXISTS "Org members can insert ai_usage_logs" ON ai_usage_logs;
CREATE POLICY "Org members can insert ai_usage_logs"
ON ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.3 AUDIT_LOG - Corrigir INSERT (sistema e membros da org)
DROP POLICY IF EXISTS "System can insert audit_log" ON audit_log;
DROP POLICY IF EXISTS "Org members can insert audit_log" ON audit_log;
CREATE POLICY "Org members can insert audit_log"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IS NULL OR
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.4 AUTOMATION_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert automation_logs" ON automation_logs;
DROP POLICY IF EXISTS "Authenticated can insert automation_logs" ON automation_logs;
CREATE POLICY "Authenticated can insert automation_logs"
ON automation_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 5.5 DAILY_BRIEFINGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert daily_briefings" ON daily_briefings;
DROP POLICY IF EXISTS "Org members can insert daily_briefings" ON daily_briefings;
CREATE POLICY "Org members can insert daily_briefings"
ON daily_briefings FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.6 ENTITY_SNAPSHOTS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert entity_snapshots" ON entity_snapshots;
DROP POLICY IF EXISTS "Org members can insert entity_snapshots" ON entity_snapshots;
CREATE POLICY "Org members can insert entity_snapshots"
ON entity_snapshots FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.7 NOTIFICATIONS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Users can insert own notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
ON notifications FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- 5.8 RELEASE_NOTES - Apenas super_admin pode inserir
DROP POLICY IF EXISTS "Admins can insert release_notes" ON release_notes;
DROP POLICY IF EXISTS "Only super_admin can insert release_notes" ON release_notes;
CREATE POLICY "Only super_admin can insert release_notes"
ON release_notes FOR INSERT
TO authenticated
WITH CHECK (public.is_platform_super_admin(auth.uid()));

-- 5.9 AI_SCORES - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_scores" ON ai_scores;
DROP POLICY IF EXISTS "Org members can insert ai_scores" ON ai_scores;
CREATE POLICY "Org members can insert ai_scores"
ON ai_scores FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.10 AI_SUGGESTIONS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_suggestions" ON ai_suggestions;
DROP POLICY IF EXISTS "Org members can insert ai_suggestions" ON ai_suggestions;
CREATE POLICY "Org members can insert ai_suggestions"
ON ai_suggestions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.11 AI_ALERTS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_alerts" ON ai_alerts;
DROP POLICY IF EXISTS "Org members can insert ai_alerts" ON ai_alerts;
CREATE POLICY "Org members can insert ai_alerts"
ON ai_alerts FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.12 AI_ACTIONS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_actions" ON ai_actions;
DROP POLICY IF EXISTS "Org members can insert ai_actions" ON ai_actions;
CREATE POLICY "Org members can insert ai_actions"
ON ai_actions FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.13 AI_FEEDBACK - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_feedback" ON ai_feedback;
DROP POLICY IF EXISTS "Org members can insert ai_feedback" ON ai_feedback;
CREATE POLICY "Org members can insert ai_feedback"
ON ai_feedback FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.14 AI_FORECAST_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_forecast_logs" ON ai_forecast_logs;
DROP POLICY IF EXISTS "Org members can insert ai_forecast_logs" ON ai_forecast_logs;
CREATE POLICY "Org members can insert ai_forecast_logs"
ON ai_forecast_logs FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.15 AI_PLAYBOOKS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai_playbooks" ON ai_playbooks;
DROP POLICY IF EXISTS "Org members can insert ai_playbooks" ON ai_playbooks;
CREATE POLICY "Org members can insert ai_playbooks"
ON ai_playbooks FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.16 ACTIVITIES - Corrigir INSERT
DROP POLICY IF EXISTS "Org members can create activities" ON activities;
DROP POLICY IF EXISTS "Org members can insert activities" ON activities;
CREATE POLICY "Org members can insert activities"
ON activities FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
  AND owner_user_id = auth.uid()
);

-- 5.17 OPPORTUNITIES - Corrigir INSERT
DROP POLICY IF EXISTS "Org members can create opportunities" ON opportunities;
DROP POLICY IF EXISTS "Org members can insert opportunities" ON opportunities;
CREATE POLICY "Org members can insert opportunities"
ON opportunities FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.18 ACCOUNTS - Corrigir INSERT
DROP POLICY IF EXISTS "Org members can create accounts" ON accounts;
DROP POLICY IF EXISTS "Org members can insert accounts" ON accounts;
CREATE POLICY "Org members can insert accounts"
ON accounts FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.19 CONTACTS - Corrigir INSERT
DROP POLICY IF EXISTS "Org members can create contacts" ON contacts;
DROP POLICY IF EXISTS "Org members can insert contacts" ON contacts;
CREATE POLICY "Org members can insert contacts"
ON contacts FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);

-- 5.20 PROPOSALS - Corrigir INSERT
DROP POLICY IF EXISTS "Org members can create proposals" ON proposals;
DROP POLICY IF EXISTS "Org members can insert proposals" ON proposals;
CREATE POLICY "Org members can insert proposals"
ON proposals FOR INSERT
TO authenticated
WITH CHECK (
  organization_id IN (
    SELECT om.organization_id FROM organization_members om 
    WHERE om.user_id = auth.uid() AND om.status = 'active'
  )
);