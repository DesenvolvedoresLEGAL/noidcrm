-- MIGRAÇÃO 3 FINAL: Corrigir Políticas "Always True"

-- =====================================================
-- TABELAS COM organization_id
-- =====================================================

-- AI_RUNS - Corrigir UPDATE
DROP POLICY IF EXISTS "System can update ai_runs" ON ai_runs;
CREATE POLICY "System can update ai_runs"
ON ai_runs FOR UPDATE
TO authenticated
USING (organization_id = get_user_organization_id())
WITH CHECK (organization_id = get_user_organization_id());

-- AI_USAGE_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert ai usage" ON ai_usage_logs;
CREATE POLICY "System can insert ai usage"
ON ai_usage_logs FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- AUDIT_LOG - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert audit logs" ON audit_log;
CREATE POLICY "System can insert audit logs"
ON audit_log FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- DAILY_BRIEFINGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert briefings" ON daily_briefings;
CREATE POLICY "System can insert briefings"
ON daily_briefings FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- DIAGNOSTIC_RESULTS - Corrigir INSERT
DROP POLICY IF EXISTS "Service role can insert diagnostic results" ON diagnostic_results;
CREATE POLICY "Service role can insert diagnostic results"
ON diagnostic_results FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- ENTITY_SNAPSHOTS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert snapshots" ON entity_snapshots;
CREATE POLICY "System can insert snapshots"
ON entity_snapshots FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- EXPORT_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert export logs" ON export_logs;
CREATE POLICY "System can insert export logs"
ON export_logs FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- PROFILES - Corrigir INSERT (usa user_id, não organization_id)
DROP POLICY IF EXISTS "System can insert profiles" ON profiles;
CREATE POLICY "System can insert profiles"
ON profiles FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- PROPOSAL_ALERTS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert proposal alerts" ON proposal_alerts;
CREATE POLICY "System can insert proposal alerts"
ON proposal_alerts FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- RELEASE_NOTES - Corrigir INSERT (apenas super_admin)
DROP POLICY IF EXISTS "System manages release notes" ON release_notes;
CREATE POLICY "System manages release notes"
ON release_notes FOR INSERT
TO authenticated
WITH CHECK (is_platform_super_admin(auth.uid()));

-- SCORE_CALCULATION_HISTORY - Corrigir INSERT
DROP POLICY IF EXISTS "system_insert_score_history" ON score_calculation_history;
CREATE POLICY "system_insert_score_history"
ON score_calculation_history FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- SECURITY_AUDIT_LOG - Corrigir INSERT
DROP POLICY IF EXISTS "System inserts security logs" ON security_audit_log;
CREATE POLICY "System inserts security logs"
ON security_audit_log FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- SYNC_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert sync logs" ON sync_logs;
DROP POLICY IF EXISTS "System creates sync logs" ON sync_logs;
CREATE POLICY "System can insert sync logs"
ON sync_logs FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- SYSTEM_EVENTS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert system_events" ON system_events;
CREATE POLICY "System can insert system_events"
ON system_events FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- TIMELINE_EVENTS - Corrigir INSERT
DROP POLICY IF EXISTS "Allow system inserts for triggers" ON timeline_events;
CREATE POLICY "Allow system inserts for triggers"
ON timeline_events FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- USER_ACCESS_LOGS - Corrigir INSERT
DROP POLICY IF EXISTS "System can insert logs" ON user_access_logs;
CREATE POLICY "System can insert logs"
ON user_access_logs FOR INSERT
TO authenticated
WITH CHECK (organization_id = get_user_organization_id() AND auth.uid() IS NOT NULL);

-- =====================================================
-- TABELAS SEM organization_id (usar apenas auth.uid() check)
-- =====================================================

-- AUTOMATION_LOGS
DROP POLICY IF EXISTS "System insert automation_logs" ON automation_logs;
CREATE POLICY "System insert automation_logs"
ON automation_logs FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- PENDING_RELEASE_CHANGES
DROP POLICY IF EXISTS "Authenticated can insert pending changes" ON pending_release_changes;
DROP POLICY IF EXISTS "Authenticated can update pending changes" ON pending_release_changes;
CREATE POLICY "Authenticated can insert pending changes"
ON pending_release_changes FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated can update pending changes"
ON pending_release_changes FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- PERFORMANCE_METRICS_LOG
DROP POLICY IF EXISTS "System can insert performance metrics" ON performance_metrics_log;
CREATE POLICY "System can insert performance metrics"
ON performance_metrics_log FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- PROPOSAL_VIEWS
DROP POLICY IF EXISTS "System can insert proposal views" ON proposal_views;
CREATE POLICY "System can insert proposal views"
ON proposal_views FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- SELLER_ACHIEVEMENTS
DROP POLICY IF EXISTS "System can insert seller achievements" ON seller_achievements;
CREATE POLICY "System can insert seller achievements"
ON seller_achievements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- SELLER_BADGES
DROP POLICY IF EXISTS "System can insert seller badges" ON seller_badges;
CREATE POLICY "System can insert seller badges"
ON seller_badges FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- SELLER_MISSIONS
DROP POLICY IF EXISTS "System can insert seller missions" ON seller_missions;
CREATE POLICY "System can insert seller missions"
ON seller_missions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);