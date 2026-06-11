-- KAI.13: Qualified Queue
DO $$ BEGIN
  CREATE TYPE public.qualification_status AS ENUM (
    'captured','existing_customer','existing_account','duplicate','enriched',
    'decision_maker_found','contact_revealed','approach_ready','ready_for_sdr',
    'human_review','imported','discarded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.kairos_qualified_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_id uuid NULL,
  prospect_id uuid NOT NULL REFERENCES public.prospects(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  domain text NULL,
  source text NULL,
  source_type text NULL,
  relationship_status text NULL,
  score integer NOT NULL DEFAULT 0,
  grade text NULL,
  confidence numeric(5,2) NULL,
  icp_match boolean NOT NULL DEFAULT false,
  enrichment_status text NULL,
  decision_maker_status text NULL,
  contact_status text NULL,
  qualification_status public.qualification_status NOT NULL DEFAULT 'captured',
  sdr_ready boolean NOT NULL DEFAULT false,
  approach_brief jsonb NULL,
  owner_id uuid NULL,
  review_reason text NULL,
  discard_reason text NULL,
  imported_at timestamptz NULL,
  imported_opportunity_id uuid NULL,
  imported_account_id uuid NULL,
  imported_contact_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, prospect_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kairos_qualified_queue TO authenticated;
GRANT ALL ON public.kairos_qualified_queue TO service_role;

ALTER TABLE public.kairos_qualified_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qq_org_select" ON public.kairos_qualified_queue FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());
CREATE POLICY "qq_org_insert" ON public.kairos_qualified_queue FOR INSERT TO authenticated
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "qq_org_update" ON public.kairos_qualified_queue FOR UPDATE TO authenticated
  USING (organization_id = public.get_user_organization_id())
  WITH CHECK (organization_id = public.get_user_organization_id());
CREATE POLICY "qq_org_delete" ON public.kairos_qualified_queue FOR DELETE TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE INDEX IF NOT EXISTS idx_qq_org_status ON public.kairos_qualified_queue (organization_id, qualification_status);
CREATE INDEX IF NOT EXISTS idx_qq_prospect ON public.kairos_qualified_queue (prospect_id);
CREATE INDEX IF NOT EXISTS idx_qq_org_sdr_ready ON public.kairos_qualified_queue (organization_id, sdr_ready) WHERE sdr_ready = true;

-- Score + grade + sdr_ready calculator
CREATE OR REPLACE FUNCTION public.kairos_queue_compute_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_score int := 0;
  v_corp_domain boolean;
  v_has_decision boolean;
  v_has_email boolean;
  v_has_event boolean;
  v_ai_score numeric;
  v_no_dup boolean;
  v_relationship text;
BEGIN
  v_corp_domain := NEW.domain IS NOT NULL AND NEW.domain !~* '(gmail|hotmail|outlook|yahoo|uol|bol|terra)\.com';
  v_has_decision := NEW.decision_maker_status IN ('found','revealed');
  v_has_email := NEW.contact_status IN ('revealed','verified');
  v_has_event := NEW.event_id IS NOT NULL;
  v_ai_score := COALESCE(NEW.confidence, 0);
  v_no_dup := NEW.qualification_status <> 'duplicate';
  v_relationship := COALESCE(NEW.relationship_status, 'new');

  IF NEW.icp_match THEN v_score := v_score + 20; END IF;
  IF v_corp_domain THEN v_score := v_score + 15; END IF;
  IF v_has_decision THEN v_score := v_score + 15; END IF;
  IF v_has_email THEN v_score := v_score + 15; END IF;
  IF v_has_event THEN v_score := v_score + 10; END IF;
  IF v_ai_score >= 70 THEN v_score := v_score + 10; ELSIF v_ai_score >= 40 THEN v_score := v_score + 5; END IF;
  IF NEW.source_type IN ('event','expofp','firecrawl_verified') THEN v_score := v_score + 10; ELSIF NEW.source_type IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF v_no_dup THEN v_score := v_score + 5; END IF;

  IF v_score > 100 THEN v_score := 100; END IF;
  NEW.score := v_score;
  NEW.grade := CASE WHEN v_score >= 80 THEN 'A' WHEN v_score >= 60 THEN 'B' WHEN v_score >= 40 THEN 'C' ELSE 'D' END;

  NEW.sdr_ready := (
    NEW.enrichment_status IN ('enriched','complete')
    AND v_has_decision
    AND v_has_email
    AND v_score >= 60
    AND v_no_dup
    AND v_relationship IN ('new','prospect','unknown')
  );

  IF NEW.sdr_ready AND NEW.qualification_status NOT IN ('imported','discarded','human_review','ready_for_sdr') THEN
    NEW.qualification_status := 'ready_for_sdr';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_kairos_queue_score ON public.kairos_qualified_queue;
CREATE TRIGGER trg_kairos_queue_score
  BEFORE INSERT OR UPDATE ON public.kairos_qualified_queue
  FOR EACH ROW EXECUTE FUNCTION public.kairos_queue_compute_score();