
ALTER TABLE public.organization_settings
  ADD COLUMN IF NOT EXISTS monthly_revenue_goal numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS quarterly_revenue_goal numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS annual_revenue_goal numeric(14,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_opportunities_org_deleted
  ON public.opportunities(organization_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_org_status_closed_at
  ON public.opportunities(organization_id, status, closed_at)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_org_pipeline_status
  ON public.opportunities(organization_id, pipeline_id, status)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.organization_feature_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  key text NOT NULL,
  enabled boolean NOT NULL DEFAULT false,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, key)
);

CREATE INDEX IF NOT EXISTS idx_org_feature_flags_org_key
  ON public.organization_feature_flags(organization_id, key);

ALTER TABLE public.organization_feature_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view org feature flags" ON public.organization_feature_flags;
CREATE POLICY "Members can view org feature flags"
  ON public.organization_feature_flags
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "Admins can insert org feature flags" ON public.organization_feature_flags;
CREATE POLICY "Admins can insert org feature flags"
  ON public.organization_feature_flags
  FOR INSERT
  TO authenticated
  WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can update org feature flags" ON public.organization_feature_flags;
CREATE POLICY "Admins can update org feature flags"
  ON public.organization_feature_flags
  FOR UPDATE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP POLICY IF EXISTS "Admins can delete org feature flags" ON public.organization_feature_flags;
CREATE POLICY "Admins can delete org feature flags"
  ON public.organization_feature_flags
  FOR DELETE
  TO authenticated
  USING (
    organization_id = public.get_user_organization_id()
    AND public.has_role(auth.uid(), 'admin'::app_role)
  );

DROP TRIGGER IF EXISTS trg_org_feature_flags_updated_at ON public.organization_feature_flags;
CREATE TRIGGER trg_org_feature_flags_updated_at
  BEFORE UPDATE ON public.organization_feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.organization_feature_flags (organization_id, key, enabled, payload)
SELECT
  o.id,
  'reports_v2_enabled',
  false,
  jsonb_build_object(
    'general', false,
    'losses', false,
    'forecast', false,
    'closer', false,
    'team', false,
    'stage_metrics', false
  )
FROM public.organizations o
ON CONFLICT (organization_id, key) DO NOTHING;

CREATE OR REPLACE VIEW public.v_opportunities_hygiene_base AS
SELECT
  o.id,
  o.organization_id,
  o.pipeline_id,
  o.stage_id,
  o.account_id,
  o.contact_id,
  o.owner_user_id,
  o.title,
  o.status,
  o.valor_previsto,
  o.prob,
  o.close_date_prevista,
  o.closed_at,
  o.won_at,
  o.lost_at,
  o.loss_reason_id,
  o.created_at,
  o.updated_at
FROM public.opportunities o
WHERE o.deleted_at IS NULL;

COMMENT ON VIEW public.v_opportunities_hygiene_base IS
  'Sprint 2.1 — Base canônica de oportunidades para Reports V2. SEMPRE exclui soft-deleted.';
