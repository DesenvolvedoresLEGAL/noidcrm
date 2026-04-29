-- ============================================================
-- Sprint D — AI Optimization Layer (Kairós)
-- ============================================================

-- Helper: check org membership with active status
CREATE OR REPLACE FUNCTION public.is_active_org_member(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND status = 'active'
      AND deleted_at IS NULL
  )
$$;

-- Helper: check if user is owner/admin of org
CREATE OR REPLACE FUNCTION public.is_org_admin(_org_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = _org_id
      AND user_id = _user_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND (org_role IN ('owner','admin') OR role IN ('owner','admin'))
  )
$$;

-- ============================================================
-- 1. optimization_insights
-- ============================================================
CREATE TABLE IF NOT EXISTS public.optimization_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  metric_name TEXT,
  metric_value NUMERIC,
  baseline_value NUMERIC,
  delta NUMERIC,
  sample_size INT NOT NULL DEFAULT 0,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT optimization_insights_type_check
    CHECK (insight_type IN ('signal','template','channel','playbook','provider')),
  CONSTRAINT optimization_insights_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1),
  CONSTRAINT optimization_insights_unique
    UNIQUE (organization_id, insight_type, entity_id, metric_name)
);

CREATE INDEX IF NOT EXISTS idx_optimization_insights_org_detected
  ON public.optimization_insights(organization_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_insights_org_type
  ON public.optimization_insights(organization_id, insight_type);

ALTER TABLE public.optimization_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view optimization insights"
  ON public.optimization_insights FOR SELECT
  USING (public.is_active_org_member(organization_id, auth.uid()));

-- ============================================================
-- 2. optimization_recommendations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.optimization_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  insight_id UUID REFERENCES public.optimization_insights(id) ON DELETE SET NULL,
  recommendation_type TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  impact_estimate NUMERIC,
  confidence_score NUMERIC NOT NULL DEFAULT 0,
  action_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT optimization_recs_type_check
    CHECK (recommendation_type IN ('score_adjustment','rule_change','template_change','channel_shift','playbook_change')),
  CONSTRAINT optimization_recs_status_check
    CHECK (status IN ('pending','accepted','dismissed','auto_applied','failed')),
  CONSTRAINT optimization_recs_confidence_range
    CHECK (confidence_score >= 0 AND confidence_score <= 1)
);

CREATE INDEX IF NOT EXISTS idx_optimization_recs_org_status
  ON public.optimization_recommendations(organization_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_optimization_recs_target
  ON public.optimization_recommendations(organization_id, target_type, target_id);

ALTER TABLE public.optimization_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view optimization recommendations"
  ON public.optimization_recommendations FOR SELECT
  USING (public.is_active_org_member(organization_id, auth.uid()));

CREATE POLICY "Org admins can update recommendation status"
  ON public.optimization_recommendations FOR UPDATE
  USING (public.is_org_admin(organization_id, auth.uid()))
  WITH CHECK (public.is_org_admin(organization_id, auth.uid()));

-- ============================================================
-- 3. optimization_actions_log
-- ============================================================
CREATE TABLE IF NOT EXISTS public.optimization_actions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_id UUID REFERENCES public.optimization_recommendations(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  executed BOOLEAN NOT NULL DEFAULT false,
  result JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  executed_by UUID,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_optimization_actions_org_executed
  ON public.optimization_actions_log(organization_id, executed_at DESC);

ALTER TABLE public.optimization_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view optimization actions log"
  ON public.optimization_actions_log FOR SELECT
  USING (public.is_active_org_member(organization_id, auth.uid()));

-- ============================================================
-- 4. RPC: set optimization auto mode in organizations.settings
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_optimization_auto_mode(_org_id uuid, _enabled boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_org_admin(_org_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only organization admins can change optimization auto mode';
  END IF;

  UPDATE public.organizations
  SET settings = COALESCE(settings, '{}'::jsonb)
                 || jsonb_build_object('optimization_auto_mode', _enabled,
                                       'optimization_auto_mode_updated_at', now()::text,
                                       'optimization_auto_mode_updated_by', auth.uid()::text)
  WHERE id = _org_id;

  RETURN _enabled;
END;
$$;

REVOKE ALL ON FUNCTION public.set_optimization_auto_mode(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_optimization_auto_mode(uuid, boolean) TO authenticated;

-- ============================================================
-- 5. RPC: dismiss recommendation (helper for UI)
-- ============================================================
CREATE OR REPLACE FUNCTION public.dismiss_optimization_recommendation(_rec_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
BEGIN
  SELECT organization_id INTO v_org
  FROM public.optimization_recommendations
  WHERE id = _rec_id;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'Recommendation not found';
  END IF;

  IF NOT public.is_org_admin(v_org, auth.uid()) THEN
    RAISE EXCEPTION 'Only organization admins can dismiss recommendations';
  END IF;

  UPDATE public.optimization_recommendations
  SET status = 'dismissed',
      reviewed_by = auth.uid(),
      reviewed_at = now()
  WHERE id = _rec_id AND status = 'pending';

  RETURN _rec_id;
END;
$$;

REVOKE ALL ON FUNCTION public.dismiss_optimization_recommendation(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.dismiss_optimization_recommendation(uuid) TO authenticated;