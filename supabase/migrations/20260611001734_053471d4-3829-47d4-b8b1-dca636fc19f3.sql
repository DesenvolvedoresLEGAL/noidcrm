
-- Fix UNTRUSTED_TENANT_ISOLATION: replace policies that read profiles.organization_id
-- with get_user_organization_id() (which reads from organization_members).

-- activity_mappings
DROP POLICY IF EXISTS "org_members_manage_mappings" ON public.activity_mappings;
DROP POLICY IF EXISTS "org_members_view_mappings" ON public.activity_mappings;
CREATE POLICY "org_members_view_mappings" ON public.activity_mappings FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_members_manage_mappings" ON public.activity_mappings FOR ALL USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());

-- ai_agent_escalation_policies
DROP POLICY IF EXISTS "org_member_delete_escalation" ON public.ai_agent_escalation_policies;
DROP POLICY IF EXISTS "org_member_insert_escalation" ON public.ai_agent_escalation_policies;
DROP POLICY IF EXISTS "org_member_select_escalation" ON public.ai_agent_escalation_policies;
DROP POLICY IF EXISTS "org_member_update_escalation" ON public.ai_agent_escalation_policies;
CREATE POLICY "org_member_select_escalation" ON public.ai_agent_escalation_policies FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_escalation" ON public.ai_agent_escalation_policies FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_escalation" ON public.ai_agent_escalation_policies FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_escalation" ON public.ai_agent_escalation_policies FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- ai_agent_memory_profiles
DROP POLICY IF EXISTS "org_member_delete_memory" ON public.ai_agent_memory_profiles;
DROP POLICY IF EXISTS "org_member_insert_memory" ON public.ai_agent_memory_profiles;
DROP POLICY IF EXISTS "org_member_select_memory" ON public.ai_agent_memory_profiles;
DROP POLICY IF EXISTS "org_member_update_memory" ON public.ai_agent_memory_profiles;
CREATE POLICY "org_member_select_memory" ON public.ai_agent_memory_profiles FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_memory" ON public.ai_agent_memory_profiles FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_memory" ON public.ai_agent_memory_profiles FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_memory" ON public.ai_agent_memory_profiles FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- ai_agent_prompt_layers
DROP POLICY IF EXISTS "org_member_delete_prompt_layers" ON public.ai_agent_prompt_layers;
DROP POLICY IF EXISTS "org_member_insert_prompt_layers" ON public.ai_agent_prompt_layers;
DROP POLICY IF EXISTS "org_member_select_prompt_layers" ON public.ai_agent_prompt_layers;
DROP POLICY IF EXISTS "org_member_update_prompt_layers" ON public.ai_agent_prompt_layers;
CREATE POLICY "org_member_select_prompt_layers" ON public.ai_agent_prompt_layers FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_prompt_layers" ON public.ai_agent_prompt_layers FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_prompt_layers" ON public.ai_agent_prompt_layers FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_prompt_layers" ON public.ai_agent_prompt_layers FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- ai_agent_rulesets
DROP POLICY IF EXISTS "org_member_delete_rulesets" ON public.ai_agent_rulesets;
DROP POLICY IF EXISTS "org_member_insert_rulesets" ON public.ai_agent_rulesets;
DROP POLICY IF EXISTS "org_member_select_rulesets" ON public.ai_agent_rulesets;
DROP POLICY IF EXISTS "org_member_update_rulesets" ON public.ai_agent_rulesets;
CREATE POLICY "org_member_select_rulesets" ON public.ai_agent_rulesets FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_rulesets" ON public.ai_agent_rulesets FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_rulesets" ON public.ai_agent_rulesets FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_rulesets" ON public.ai_agent_rulesets FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- ai_agent_tools
DROP POLICY IF EXISTS "org_member_delete_agent_tools" ON public.ai_agent_tools;
DROP POLICY IF EXISTS "org_member_insert_agent_tools" ON public.ai_agent_tools;
DROP POLICY IF EXISTS "org_member_select_agent_tools" ON public.ai_agent_tools;
DROP POLICY IF EXISTS "org_member_update_agent_tools" ON public.ai_agent_tools;
CREATE POLICY "org_member_select_agent_tools" ON public.ai_agent_tools FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_agent_tools" ON public.ai_agent_tools FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_agent_tools" ON public.ai_agent_tools FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_agent_tools" ON public.ai_agent_tools FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- ai_agent_triggers
DROP POLICY IF EXISTS "org_member_delete_triggers" ON public.ai_agent_triggers;
DROP POLICY IF EXISTS "org_member_insert_triggers" ON public.ai_agent_triggers;
DROP POLICY IF EXISTS "org_member_select_triggers" ON public.ai_agent_triggers;
DROP POLICY IF EXISTS "org_member_update_triggers" ON public.ai_agent_triggers;
CREATE POLICY "org_member_select_triggers" ON public.ai_agent_triggers FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_insert_triggers" ON public.ai_agent_triggers FOR INSERT TO authenticated WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_update_triggers" ON public.ai_agent_triggers FOR UPDATE TO authenticated USING (organization_id = public.get_user_organization_id());
CREATE POLICY "org_member_delete_triggers" ON public.ai_agent_triggers FOR DELETE TO authenticated USING (organization_id = public.get_user_organization_id());

-- algorithm_versions
DROP POLICY IF EXISTS "org_members_manage_versions" ON public.algorithm_versions;
DROP POLICY IF EXISTS "org_members_view_versions" ON public.algorithm_versions;
CREATE POLICY "org_members_view_versions" ON public.algorithm_versions FOR SELECT USING ((organization_id IS NULL) OR (organization_id = public.get_user_organization_id()));
CREATE POLICY "org_members_manage_versions" ON public.algorithm_versions FOR ALL USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());

-- badge_preservation_history
DROP POLICY IF EXISTS "sellers_view_badge_history" ON public.badge_preservation_history;
CREATE POLICY "sellers_view_badge_history" ON public.badge_preservation_history FOR SELECT USING (
  (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  OR (organization_id = public.get_user_organization_id())
);

-- entity_snapshots
DROP POLICY IF EXISTS "Users can delete own org snapshots" ON public.entity_snapshots;
DROP POLICY IF EXISTS "Users can view own org snapshots" ON public.entity_snapshots;
CREATE POLICY "Users can view own org snapshots" ON public.entity_snapshots FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can delete own org snapshots" ON public.entity_snapshots FOR DELETE USING (organization_id = public.get_user_organization_id());

-- loss_semantic_analyses
DROP POLICY IF EXISTS "lsa_select_same_org" ON public.loss_semantic_analyses;
CREATE POLICY "lsa_select_same_org" ON public.loss_semantic_analyses FOR SELECT TO authenticated USING (organization_id = public.get_user_organization_id());

-- plg_events
DROP POLICY IF EXISTS "Users can insert plg_events for their organization" ON public.plg_events;
DROP POLICY IF EXISTS "Users can view their organization plg_events" ON public.plg_events;
CREATE POLICY "Users can view their organization plg_events" ON public.plg_events FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert plg_events for their organization" ON public.plg_events FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- plg_score_config
DROP POLICY IF EXISTS "Users can manage their organization plg_score_config" ON public.plg_score_config;
DROP POLICY IF EXISTS "Users can view their organization plg_score_config" ON public.plg_score_config;
CREATE POLICY "Users can view their organization plg_score_config" ON public.plg_score_config FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can manage their organization plg_score_config" ON public.plg_score_config FOR ALL USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id());

-- plg_score_history
DROP POLICY IF EXISTS "Users can insert plg_score_history for their organization" ON public.plg_score_history;
DROP POLICY IF EXISTS "Users can view their organization plg_score_history" ON public.plg_score_history;
CREATE POLICY "Users can view their organization plg_score_history" ON public.plg_score_history FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert plg_score_history for their organization" ON public.plg_score_history FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());

-- score_calculation_history
DROP POLICY IF EXISTS "sellers_view_score_history" ON public.score_calculation_history;
CREATE POLICY "sellers_view_score_history" ON public.score_calculation_history FOR SELECT USING (
  (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  OR (organization_id = public.get_user_organization_id())
);

-- xp_conversion_history
DROP POLICY IF EXISTS "sellers_view_xp_history" ON public.xp_conversion_history;
CREATE POLICY "sellers_view_xp_history" ON public.xp_conversion_history FOR SELECT USING (
  (seller_id IN (SELECT id FROM public.sellers WHERE user_id = auth.uid()))
  OR (organization_id = public.get_user_organization_id())
);

-- Fix BROKEN_RLS_POLICY_WRONG_KEY on notification_events
-- The duplicate policy uses profiles.id = auth.uid() (dead code). Remove it; the
-- other policy "Org members can read events" already uses get_user_organization_id().
DROP POLICY IF EXISTS "Users read events from own org" ON public.notification_events;
