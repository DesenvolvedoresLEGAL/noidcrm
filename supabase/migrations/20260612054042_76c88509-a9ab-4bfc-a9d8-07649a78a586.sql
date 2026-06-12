
-- ============================================================
-- KAI.16 — Kairós Revenue Attribution
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.kairos_attribution_status AS ENUM (
    'sourced',
    'queued',
    'promoted_to_crm',
    'opportunity_open',
    'proposal_created',
    'proposal_sent',
    'proposal_viewed',
    'won',
    'lost',
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kairos_revenue_attribution (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,

  event_id uuid,
  event_name text,
  batch_run_id uuid REFERENCES public.kairos_batch_runs(id) ON DELETE SET NULL,
  prospect_id uuid REFERENCES public.prospects(id) ON DELETE SET NULL,
  queue_id uuid REFERENCES public.kairos_qualified_queue(id) ON DELETE SET NULL,

  account_id uuid,
  contact_id uuid,
  opportunity_id uuid REFERENCES public.opportunities(id) ON DELETE CASCADE,
  proposal_id uuid,
  contract_id uuid,

  source_type text,
  source_name text,
  icp_cluster_id uuid,
  icp_cluster_name text,

  apollo_provider_used text,
  primary_contact_department text,
  primary_contact_role text,
  primary_contact_score integer,

  owner_id uuid,
  sdr_id uuid,

  opportunity_created_at timestamptz,
  proposal_created_at timestamptz,
  proposal_sent_at timestamptz,
  proposal_viewed_at timestamptz,
  won_at timestamptz,
  lost_at timestamptz,

  revenue_amount numeric(15,2) DEFAULT 0,
  valid_revenue_amount numeric(15,2) DEFAULT 0,

  status public.kairos_attribution_status NOT NULL DEFAULT 'promoted_to_crm',

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT kairos_revenue_attribution_opp_unique UNIQUE (opportunity_id)
);

CREATE INDEX IF NOT EXISTS idx_kra_org_status ON public.kairos_revenue_attribution(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_kra_org_won_at ON public.kairos_revenue_attribution(organization_id, won_at);
CREATE INDEX IF NOT EXISTS idx_kra_event ON public.kairos_revenue_attribution(organization_id, event_id);
CREATE INDEX IF NOT EXISTS idx_kra_batch ON public.kairos_revenue_attribution(batch_run_id);
CREATE INDEX IF NOT EXISTS idx_kra_owner ON public.kairos_revenue_attribution(organization_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_kra_sdr ON public.kairos_revenue_attribution(organization_id, sdr_id);
CREATE INDEX IF NOT EXISTS idx_kra_icp ON public.kairos_revenue_attribution(organization_id, icp_cluster_id);
CREATE INDEX IF NOT EXISTS idx_kra_proposal ON public.kairos_revenue_attribution(proposal_id);

GRANT SELECT ON public.kairos_revenue_attribution TO authenticated;
GRANT ALL ON public.kairos_revenue_attribution TO service_role;

ALTER TABLE public.kairos_revenue_attribution ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kra_org_select" ON public.kairos_revenue_attribution;
CREATE POLICY "kra_org_select" ON public.kairos_revenue_attribution
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.organization_id = kairos_revenue_attribution.organization_id
        AND om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "kra_service_all" ON public.kairos_revenue_attribution;
CREATE POLICY "kra_service_all" ON public.kairos_revenue_attribution
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.fn_kairos_revenue_attribution_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kra_touch ON public.kairos_revenue_attribution;
CREATE TRIGGER trg_kra_touch
BEFORE UPDATE ON public.kairos_revenue_attribution
FOR EACH ROW EXECUTE FUNCTION public.fn_kairos_revenue_attribution_touch();

-- ============================================================
-- Sync function
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_kairos_sync_attribution(p_opportunity_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_attr_id uuid;
  v_opp record;
  v_prop record;
  v_rev record;
  v_status public.kairos_attribution_status;
  v_won_at timestamptz;
  v_lost_at timestamptz;
  v_revenue numeric := 0;
  v_valid_revenue numeric := 0;
BEGIN
  IF p_opportunity_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id, organization_id, status, accepted_proposal_id, closed_at, created_at, owner_user_id, qualified_by_user_id
    INTO v_opp
  FROM public.opportunities
  WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_attr_id FROM (
    SELECT id FROM public.kairos_revenue_attribution WHERE opportunity_id = p_opportunity_id LIMIT 1
  ) s;

  IF v_attr_id IS NULL THEN
    -- No attribution row exists; opportunity wasn't from Kairós. Skip.
    RETURN NULL;
  END IF;

  -- Latest proposal (prefer accepted, else most recent)
  SELECT p.id, p.created_at, p.sent_at, p.viewed_at, p.accepted_at, p.approved_amount
    INTO v_prop
  FROM public.proposals p
  WHERE p.opportunity_id = p_opportunity_id
  ORDER BY (p.id = v_opp.accepted_proposal_id) DESC, COALESCE(p.accepted_at, p.sent_at, p.created_at) DESC
  LIMIT 1;

  -- Revenue from official source
  SELECT cwrv.commercial_amount, cwrv.valid_revenue_amount, cwrv.won_at, cwrv.is_cancelled_sale
    INTO v_rev
  FROM public.commercial_won_revenue_view cwrv
  WHERE cwrv.opportunity_id = p_opportunity_id
  LIMIT 1;

  IF v_rev.commercial_amount IS NOT NULL THEN
    v_revenue := COALESCE(v_rev.commercial_amount, 0);
    v_valid_revenue := COALESCE(v_rev.valid_revenue_amount, 0);
    v_won_at := v_rev.won_at;
  END IF;

  -- Status derivation
  IF v_rev.is_cancelled_sale THEN
    v_status := 'cancelled';
  ELSIF lower(coalesce(v_opp.status,'')) IN ('won','ganho','ganha') OR v_won_at IS NOT NULL THEN
    v_status := 'won';
  ELSIF lower(coalesce(v_opp.status,'')) IN ('lost','perdido','perdida') THEN
    v_status := 'lost';
    v_lost_at := v_opp.closed_at;
  ELSIF v_prop.viewed_at IS NOT NULL THEN
    v_status := 'proposal_viewed';
  ELSIF v_prop.sent_at IS NOT NULL THEN
    v_status := 'proposal_sent';
  ELSIF v_prop.id IS NOT NULL THEN
    v_status := 'proposal_created';
  ELSE
    v_status := 'opportunity_open';
  END IF;

  UPDATE public.kairos_revenue_attribution
  SET
    proposal_id = COALESCE(v_prop.id, proposal_id),
    proposal_created_at = COALESCE(v_prop.created_at, proposal_created_at),
    proposal_sent_at = COALESCE(v_prop.sent_at, proposal_sent_at),
    proposal_viewed_at = COALESCE(v_prop.viewed_at, proposal_viewed_at),
    won_at = COALESCE(v_won_at, won_at),
    lost_at = COALESCE(v_lost_at, lost_at),
    revenue_amount = v_revenue,
    valid_revenue_amount = v_valid_revenue,
    status = v_status,
    owner_id = COALESCE(v_opp.owner_user_id, owner_id),
    opportunity_created_at = COALESCE(opportunity_created_at, v_opp.created_at),
    updated_at = now()
  WHERE opportunity_id = p_opportunity_id
  RETURNING id INTO v_attr_id;

  RETURN v_attr_id;
END $$;

GRANT EXECUTE ON FUNCTION public.fn_kairos_sync_attribution(uuid) TO authenticated, service_role;

-- ============================================================
-- Triggers — keep attribution in sync
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_kairos_attribution_on_proposal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.opportunity_id IS NOT NULL THEN
    PERFORM public.fn_kairos_sync_attribution(NEW.opportunity_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kairos_attr_proposal ON public.proposals;
CREATE TRIGGER trg_kairos_attr_proposal
AFTER INSERT OR UPDATE OF sent_at, viewed_at, accepted_at, approved_amount, opportunity_id
ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.fn_kairos_attribution_on_proposal();

CREATE OR REPLACE FUNCTION public.fn_kairos_attribution_on_opportunity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.fn_kairos_sync_attribution(NEW.id);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kairos_attr_opportunity ON public.opportunities;
CREATE TRIGGER trg_kairos_attr_opportunity
AFTER UPDATE OF status, closed_at, accepted_proposal_id, owner_user_id
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.fn_kairos_attribution_on_opportunity();

-- ============================================================
-- Summary view
-- ============================================================
CREATE OR REPLACE VIEW public.kairos_revenue_attribution_summary AS
SELECT
  organization_id,
  event_id,
  event_name,
  batch_run_id,
  icp_cluster_id,
  icp_cluster_name,
  owner_id,
  sdr_id,
  primary_contact_department,
  COUNT(*) AS attributions,
  COUNT(*) FILTER (WHERE status NOT IN ('cancelled')) AS active_attributions,
  COUNT(*) FILTER (WHERE proposal_id IS NOT NULL) AS proposals_created,
  COUNT(*) FILTER (WHERE proposal_sent_at IS NOT NULL) AS proposals_sent,
  COUNT(*) FILTER (WHERE proposal_viewed_at IS NOT NULL) AS proposals_viewed,
  COUNT(*) FILTER (WHERE status = 'won') AS deals_won,
  COUNT(*) FILTER (WHERE status = 'lost') AS deals_lost,
  COUNT(*) FILTER (WHERE status = 'cancelled') AS deals_cancelled,
  COALESCE(SUM(revenue_amount) FILTER (WHERE status = 'won'), 0) AS revenue_total,
  COALESCE(SUM(valid_revenue_amount) FILTER (WHERE status = 'won'), 0) AS valid_revenue_total,
  CASE
    WHEN COUNT(*) FILTER (WHERE status = 'won') > 0
    THEN COALESCE(SUM(valid_revenue_amount) FILTER (WHERE status = 'won'), 0)
         / NULLIF(COUNT(*) FILTER (WHERE status = 'won'), 0)
    ELSE 0
  END AS avg_ticket,
  CASE
    WHEN COUNT(*) > 0
    THEN COUNT(*) FILTER (WHERE status = 'won')::numeric / COUNT(*)::numeric
    ELSE 0
  END AS conversion_rate
FROM public.kairos_revenue_attribution
GROUP BY organization_id, event_id, event_name, batch_run_id,
         icp_cluster_id, icp_cluster_name, owner_id, sdr_id, primary_contact_department;

GRANT SELECT ON public.kairos_revenue_attribution_summary TO authenticated, service_role;

COMMENT ON TABLE public.kairos_revenue_attribution IS
  'KAI.16 — Origem GTM/Kairós atribuída à receita oficial. Não duplica receita; cruza com commercial_won_revenue_view.';
