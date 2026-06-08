
-- 1) Harden get_user_organization_id: read from organization_members (trusted)
CREATE OR REPLACE FUNCTION public.get_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT organization_id
  FROM public.organization_members
  WHERE user_id = auth.uid()
    AND status = 'active'
  ORDER BY joined_at DESC NULLS LAST
  LIMIT 1
$$;

-- 2) Block users from self-modifying profiles.organization_id
CREATE OR REPLACE FUNCTION public.prevent_profile_org_hijack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    -- Allow only platform admins or server-side (no auth context)
    IF auth.uid() IS NULL OR public.is_platform_admin_for_rls(auth.uid()) THEN
      RETURN NEW;
    END IF;
    -- Allow if the new org matches an active membership of this user
    IF EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id
        AND status = 'active'
    ) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Not allowed to change organization_id on profiles';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_org_hijack ON public.profiles;
CREATE TRIGGER trg_prevent_profile_org_hijack
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_profile_org_hijack();

-- 3) Fix 22 broken RLS policies that used profiles.id = auth.uid()
-- Strategy: replace with get_user_organization_id() (now trusted)

-- ai_agent_run_outcomes
DROP POLICY IF EXISTS "org_access_run_outcomes" ON public.ai_agent_run_outcomes;
CREATE POLICY "org_access_run_outcomes" ON public.ai_agent_run_outcomes
  FOR ALL USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());

-- ai_email_* tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'ai_email_agent_metrics_daily',
    'ai_email_agent_outcomes',
    'ai_email_cadence_policies',
    'ai_email_cadence_progress',
    'ai_email_cadence_steps',
    'ai_email_cooldown_policies',
    'ai_email_pipeline_rules'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "org_access" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "org_access" ON public.%I FOR ALL USING (organization_id = public.get_user_organization_id()) WITH CHECK (organization_id = public.get_user_organization_id())',
      t
    );
  END LOOP;
END $$;

-- lead_emotional_memory
DROP POLICY IF EXISTS "Users can view emotional memory for their org" ON public.lead_emotional_memory;
DROP POLICY IF EXISTS "Users can insert emotional memory for their org" ON public.lead_emotional_memory;
DROP POLICY IF EXISTS "Users can update emotional memory for their org" ON public.lead_emotional_memory;
DROP POLICY IF EXISTS "Users can delete emotional memory for their org" ON public.lead_emotional_memory;
CREATE POLICY "Users can view emotional memory for their org" ON public.lead_emotional_memory
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert emotional memory for their org" ON public.lead_emotional_memory
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can update emotional memory for their org" ON public.lead_emotional_memory
  FOR UPDATE USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can delete emotional memory for their org" ON public.lead_emotional_memory
  FOR DELETE USING (organization_id = public.get_user_organization_id());

-- vibe_alerts
DROP POLICY IF EXISTS "Users can view vibe alerts for their org" ON public.vibe_alerts;
DROP POLICY IF EXISTS "Users can insert vibe alerts for their org" ON public.vibe_alerts;
DROP POLICY IF EXISTS "Users can update vibe alerts for their org" ON public.vibe_alerts;
DROP POLICY IF EXISTS "Users can delete vibe alerts for their org" ON public.vibe_alerts;
CREATE POLICY "Users can view vibe alerts for their org" ON public.vibe_alerts
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert vibe alerts for their org" ON public.vibe_alerts
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can update vibe alerts for their org" ON public.vibe_alerts
  FOR UPDATE USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can delete vibe alerts for their org" ON public.vibe_alerts
  FOR DELETE USING (organization_id = public.get_user_organization_id());

-- vibe_narratives (also normalize to helper)
DROP POLICY IF EXISTS "Users can view narratives from their organization" ON public.vibe_narratives;
DROP POLICY IF EXISTS "Users can insert narratives in their organization" ON public.vibe_narratives;
DROP POLICY IF EXISTS "Users can update narratives in their organization" ON public.vibe_narratives;
DROP POLICY IF EXISTS "Users can delete narratives in their organization" ON public.vibe_narratives;
CREATE POLICY "Users can view narratives from their organization" ON public.vibe_narratives
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert narratives in their organization" ON public.vibe_narratives
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can update narratives in their organization" ON public.vibe_narratives
  FOR UPDATE USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can delete narratives in their organization" ON public.vibe_narratives
  FOR DELETE USING (organization_id = public.get_user_organization_id());

-- vibe_state_history
DROP POLICY IF EXISTS "Users can view vibe history for their org" ON public.vibe_state_history;
DROP POLICY IF EXISTS "Users can insert vibe history for their org" ON public.vibe_state_history;
CREATE POLICY "Users can view vibe history for their org" ON public.vibe_state_history
  FOR SELECT USING (organization_id = public.get_user_organization_id());
CREATE POLICY "Users can insert vibe history for their org" ON public.vibe_state_history
  FOR INSERT WITH CHECK (organization_id = public.get_user_organization_id());
