
-- ============================================================
-- KAI.17 — GTM Performance Hub
-- ============================================================

CREATE TABLE IF NOT EXISTS public.kairos_gtm_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recommendation_type text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  target_label text,
  title text NOT NULL,
  description text NOT NULL,
  severity text NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info','low','medium','high','critical')),
  impact_estimate numeric(15,2) DEFAULT 0,
  confidence_score numeric(5,2) DEFAULT 0,
  metric_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','dismissed','resolved')),
  dedup_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kairos_gtm_rec_unique UNIQUE (organization_id, dedup_key)
);

CREATE INDEX IF NOT EXISTS idx_kgr_org_status ON public.kairos_gtm_recommendations(organization_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_kgr_target ON public.kairos_gtm_recommendations(organization_id, target_type, target_id);

GRANT SELECT, UPDATE ON public.kairos_gtm_recommendations TO authenticated;
GRANT ALL ON public.kairos_gtm_recommendations TO service_role;

ALTER TABLE public.kairos_gtm_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kgr_org_select" ON public.kairos_gtm_recommendations;
CREATE POLICY "kgr_org_select" ON public.kairos_gtm_recommendations
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = kairos_gtm_recommendations.organization_id
      AND om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "kgr_org_update" ON public.kairos_gtm_recommendations;
CREATE POLICY "kgr_org_update" ON public.kairos_gtm_recommendations
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = kairos_gtm_recommendations.organization_id
      AND om.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.organization_id = kairos_gtm_recommendations.organization_id
      AND om.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "kgr_service_all" ON public.kairos_gtm_recommendations;
CREATE POLICY "kgr_service_all" ON public.kairos_gtm_recommendations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_kgr_touch ON public.kairos_gtm_recommendations;
CREATE TRIGGER trg_kgr_touch
BEFORE UPDATE ON public.kairos_gtm_recommendations
FOR EACH ROW EXECUTE FUNCTION public.fn_kairos_revenue_attribution_touch();

-- ============================================================
-- GTM performance view
-- ============================================================
CREATE OR REPLACE VIEW public.kairos_gtm_performance_summary AS
SELECT
  q.organization_id,
  q.event_id,
  COALESCE(p.event_name, 'Sem evento') AS event_name,
  p.icp_profile_id AS icp_cluster_id,
  COALESCE(icp.name, 'Sem ICP') AS icp_cluster_name,
  bri.run_id AS batch_run_id,
  q.owner_id,
  a.sdr_id,
  a.primary_contact_department,
  q.source_type,
  COUNT(*) AS captured_count,
  COUNT(*) FILTER (WHERE q.qualification_status::text <> 'captured') AS queued_count,
  COUNT(*) FILTER (WHERE q.enrichment_status = 'enriched') AS enriched_count,
  COUNT(*) FILTER (WHERE q.apollo_status IN ('enriched','partial')) AS apollo_executed_count,
  COUNT(*) FILTER (WHERE q.decision_maker_status = 'found') AS decision_maker_found_count,
  COUNT(*) FILTER (WHERE COALESCE(q.contacts_found, 0) > 0) AS contact_revealed_count,
  COUNT(*) FILTER (WHERE q.approach_brief IS NOT NULL) AS approach_ready_count,
  COUNT(*) FILTER (WHERE q.sdr_ready) AS sdr_ready_count,
  COUNT(*) FILTER (WHERE q.qualification_status::text = 'imported') AS promoted_to_crm_count,
  COUNT(a.id) AS opportunities_created_count,
  COUNT(a.id) FILTER (WHERE a.proposal_id IS NOT NULL) AS proposals_created_count,
  COUNT(a.id) FILTER (WHERE a.proposal_sent_at IS NOT NULL) AS proposals_sent_count,
  COUNT(a.id) FILTER (WHERE a.proposal_viewed_at IS NOT NULL) AS proposals_viewed_count,
  COUNT(a.id) FILTER (WHERE a.status = 'won') AS won_count,
  COUNT(a.id) FILTER (WHERE a.status = 'lost') AS lost_count,
  COALESCE(SUM(a.valid_revenue_amount) FILTER (WHERE a.status = 'won'), 0) AS valid_revenue_amount,
  COALESCE(SUM(a.revenue_amount) FILTER (WHERE a.status = 'won'), 0) AS revenue_amount,
  COALESCE(SUM(ap.credits_used), 0) AS apollo_credits_used,
  COUNT(ap.id) FILTER (WHERE ap.decision_maker_found) AS apollo_dm_found_count,
  MAX(q.created_at) AS last_capture_at
FROM public.kairos_qualified_queue q
LEFT JOIN public.prospects p ON p.id = q.prospect_id
LEFT JOIN public.icp_profiles icp ON icp.id = p.icp_profile_id
LEFT JOIN LATERAL (
  SELECT run_id FROM public.kairos_batch_run_items
  WHERE prospect_id = q.prospect_id
  ORDER BY created_at DESC LIMIT 1
) bri ON true
LEFT JOIN public.kairos_revenue_attribution a ON a.queue_id = q.id
LEFT JOIN public.apollo_enrichment_audit ap ON ap.prospect_id = q.prospect_id
GROUP BY 1,2,3,4,5,6,7,8,9,10;

GRANT SELECT ON public.kairos_gtm_performance_summary TO authenticated, service_role;

-- Sibling view: Apollo per event/ICP
CREATE OR REPLACE VIEW public.kairos_apollo_performance_summary AS
SELECT
  ap.organization_id,
  ap.icp_id,
  ap.icp_category,
  ap.batch_run_id,
  COUNT(*) AS executions,
  COUNT(*) FILTER (WHERE ap.apollo_status = 'skipped') AS skipped,
  COUNT(*) FILTER (WHERE ap.apollo_status = 'partial') AS partial,
  COUNT(*) FILTER (WHERE ap.apollo_status = 'enriched') AS enriched,
  COUNT(*) FILTER (WHERE ap.apollo_status = 'failed') AS failed,
  COUNT(*) FILTER (WHERE ap.decision_maker_found) AS decision_makers,
  COALESCE(SUM(ap.contacts_found), 0) AS contacts_found,
  COALESCE(SUM(ap.contacts_revealed), 0) AS contacts_revealed,
  COALESCE(SUM(ap.credits_used), 0) AS credits_used
FROM public.apollo_enrichment_audit ap
GROUP BY 1,2,3,4;

GRANT SELECT ON public.kairos_apollo_performance_summary TO authenticated, service_role;

-- ============================================================
-- Compute function (idempotent; returns json summary)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_kairos_compute_gtm_performance(p_organization_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_totals jsonb;
BEGIN
  IF p_organization_id IS NULL THEN
    RETURN '{}'::jsonb;
  END IF;

  SELECT jsonb_build_object(
    'captured', COALESCE(SUM(captured_count), 0),
    'sdr_ready', COALESCE(SUM(sdr_ready_count), 0),
    'promoted', COALESCE(SUM(promoted_to_crm_count), 0),
    'opportunities', COALESCE(SUM(opportunities_created_count), 0),
    'proposals_created', COALESCE(SUM(proposals_created_count), 0),
    'proposals_sent', COALESCE(SUM(proposals_sent_count), 0),
    'won', COALESCE(SUM(won_count), 0),
    'lost', COALESCE(SUM(lost_count), 0),
    'valid_revenue', COALESCE(SUM(valid_revenue_amount), 0),
    'apollo_credits', COALESCE(SUM(apollo_credits_used), 0),
    'apollo_dm_found', COALESCE(SUM(apollo_dm_found_count), 0),
    'computed_at', now()
  )
  INTO v_totals
  FROM public.kairos_gtm_performance_summary
  WHERE organization_id = p_organization_id;

  RETURN COALESCE(v_totals, '{}'::jsonb);
END $$;

GRANT EXECUTE ON FUNCTION public.fn_kairos_compute_gtm_performance(uuid) TO authenticated, service_role;
