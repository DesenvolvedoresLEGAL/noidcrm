-- ============================================================================
-- SPRINT 2.1 — Data Hygiene & Canonical Guardrails
-- ============================================================================

-- 1) Generated columns won_at / lost_at (immutable derivations of closed_at)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS won_at timestamp with time zone
    GENERATED ALWAYS AS (CASE WHEN status = 'won'  THEN closed_at END) STORED;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS lost_at timestamp with time zone
    GENERATED ALWAYS AS (CASE WHEN status = 'lost' THEN closed_at END) STORED;

CREATE INDEX IF NOT EXISTS idx_opportunities_won_at_org
  ON public.opportunities (organization_id, won_at)
  WHERE deleted_at IS NULL AND status = 'won';

CREATE INDEX IF NOT EXISTS idx_opportunities_lost_at_org
  ON public.opportunities (organization_id, lost_at)
  WHERE deleted_at IS NULL AND status = 'lost';

CREATE INDEX IF NOT EXISTS idx_opportunities_org_active
  ON public.opportunities (organization_id, status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- 2) Feature flags table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  flag_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  rollout_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (organization_id, flag_key)
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_org_key
  ON public.feature_flags (organization_id, flag_key);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view their org feature flags"
  ON public.feature_flags
  FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Admins can insert feature flags"
  ON public.feature_flags
  FOR INSERT
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can update feature flags"
  ON public.feature_flags
  FOR UPDATE
  USING (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

CREATE POLICY "Admins can delete feature flags"
  ON public.feature_flags
  FOR DELETE
  USING (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP TRIGGER IF EXISTS trg_feature_flags_updated_at ON public.feature_flags;
CREATE TRIGGER trg_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- 3) Helper: is_feature_enabled(flag_key)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.is_feature_enabled(_flag_key text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.feature_flags
     WHERE organization_id = public.get_user_organization_id()
       AND flag_key = _flag_key
     LIMIT 1),
    false
  );
$$;

-- ============================================================================
-- 4) Seed reports_v2_enabled = false for every existing organization
-- ============================================================================
INSERT INTO public.feature_flags (organization_id, flag_key, enabled, rollout_metadata)
SELECT id, 'reports_v2_enabled', false,
       jsonb_build_object('introduced_at', now(), 'sprint', '2.1')
FROM public.organizations
ON CONFLICT (organization_id, flag_key) DO NOTHING;
