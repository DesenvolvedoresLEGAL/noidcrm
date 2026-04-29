-- Sprint Scoring 1.2 — Opportunity Score automation infrastructure (retry)

-- 1) New persisted columns on opportunities
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS opportunity_grade text,
  ADD COLUMN IF NOT EXISTS opportunity_health text,
  ADD COLUMN IF NOT EXISTS opportunity_score_metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_opportunity_grade_check') THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_opportunity_grade_check
      CHECK (opportunity_grade IS NULL OR opportunity_grade IN ('A','B','C','D','F'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_opportunity_health_check') THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_opportunity_health_check
      CHECK (opportunity_health IS NULL OR opportunity_health IN ('hot','healthy','attention','risk','stalled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'opportunities_opportunity_score_range_check') THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT opportunities_opportunity_score_range_check
      CHECK (opportunity_score IS NULL OR (opportunity_score BETWEEN 0 AND 100));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_opp_score
  ON public.opportunities(organization_id, opportunity_score DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_opp_grade
  ON public.opportunities(organization_id, opportunity_grade) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_opp_health
  ON public.opportunities(organization_id, opportunity_health) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_score_updated
  ON public.opportunities(organization_id, score_updated_at DESC) WHERE deleted_at IS NULL;

-- 2) Recalc queue
CREATE TABLE IF NOT EXISTS public.opportunity_score_recalc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  account_id uuid,
  trigger_source text NOT NULL CHECK (trigger_source IN ('opportunities','activities','proposals','opportunity_emails','contacts','manual')),
  trigger_action text NOT NULL CHECK (trigger_action IN ('insert','update','delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','skipped')),
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_osrq_org_opp_status ON public.opportunity_score_recalc_queue(organization_id, opportunity_id, status);
CREATE INDEX IF NOT EXISTS idx_osrq_org_status_created ON public.opportunity_score_recalc_queue(organization_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_osrq_opp_created_desc ON public.opportunity_score_recalc_queue(opportunity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_osrq_created_at ON public.opportunity_score_recalc_queue(created_at);

ALTER TABLE public.opportunity_score_recalc_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "osrq_select_org_members" ON public.opportunity_score_recalc_queue;
CREATE POLICY "osrq_select_org_members"
  ON public.opportunity_score_recalc_queue FOR SELECT
  USING (public.user_is_org_member(organization_id));

-- 3) Enqueue function (debounce 2 min per opportunity)
CREATE OR REPLACE FUNCTION public.enqueue_opportunity_score_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_source text := TG_TABLE_NAME;
  v_action text := lower(TG_OP);
  v_org uuid;
  v_opp uuid;
  v_account uuid;
  v_existing uuid;
  r record;
BEGIN
  IF v_source = 'opportunities' THEN
    v_org := COALESCE(NEW.organization_id, OLD.organization_id);
    v_opp := COALESCE(NEW.id, OLD.id);
    v_account := COALESCE(NEW.account_id, OLD.account_id);
    IF v_opp IS NULL OR v_org IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    SELECT id INTO v_existing
    FROM public.opportunity_score_recalc_queue
    WHERE opportunity_id = v_opp
      AND status IN ('pending','processing')
      AND created_at > now() - interval '2 minutes'
    LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.opportunity_score_recalc_queue
        (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
      VALUES (v_org, v_opp, v_account, v_source, v_action);
    END IF;
    RETURN COALESCE(NEW, OLD);

  ELSIF v_source IN ('activities','proposals','opportunity_emails') THEN
    v_org := COALESCE(NEW.organization_id, OLD.organization_id);
    v_opp := COALESCE(NEW.opportunity_id, OLD.opportunity_id);
    IF v_opp IS NULL OR v_org IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

    SELECT account_id INTO v_account FROM public.opportunities WHERE id = v_opp;

    SELECT id INTO v_existing
    FROM public.opportunity_score_recalc_queue
    WHERE opportunity_id = v_opp
      AND status IN ('pending','processing')
      AND created_at > now() - interval '2 minutes'
    LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.opportunity_score_recalc_queue
        (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
      VALUES (v_org, v_opp, v_account, v_source, v_action);
    END IF;
    RETURN COALESCE(NEW, OLD);

  ELSIF v_source = 'contacts' THEN
    FOR r IN
      SELECT id, organization_id, account_id
      FROM public.opportunities
      WHERE contact_id = COALESCE(NEW.id, OLD.id)
        AND deleted_at IS NULL
    LOOP
      v_existing := NULL;
      SELECT id INTO v_existing
      FROM public.opportunity_score_recalc_queue
      WHERE opportunity_id = r.id
        AND status IN ('pending','processing')
        AND created_at > now() - interval '2 minutes'
      LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.opportunity_score_recalc_queue
          (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
        VALUES (r.organization_id, r.id, r.account_id, v_source, v_action);
      END IF;
    END LOOP;
    RETURN COALESCE(NEW, OLD);
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 4) Triggers (use real column name `loss_reason_id`)
DROP TRIGGER IF EXISTS trg_osrq_opportunities_iud ON public.opportunities;
CREATE TRIGGER trg_osrq_opportunities_iud
  AFTER INSERT OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_opportunities_upd ON public.opportunities;
CREATE TRIGGER trg_osrq_opportunities_upd
  AFTER UPDATE OF stage_id, status, valor_previsto, prob, close_date_prevista,
                  owner_user_id, account_id, contact_id, next_followup_date,
                  last_contact_date, closed_at, loss_reason_id, deleted_at
  ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_activities_iud ON public.activities;
CREATE TRIGGER trg_osrq_activities_iud
  AFTER INSERT OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_activities_upd ON public.activities;
CREATE TRIGGER trg_osrq_activities_upd
  AFTER UPDATE OF status, type, completed_at, scheduled_date,
                  opportunity_id, account_id, contact_id, deleted_at
  ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_proposals_iud ON public.proposals;
CREATE TRIGGER trg_osrq_proposals_iud
  AFTER INSERT OR DELETE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_proposals_upd ON public.proposals;
CREATE TRIGGER trg_osrq_proposals_upd
  AFTER UPDATE OF status, sent_at, viewed_at, accepted_at, expires_at,
                  total_amount, opportunity_id
  ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_opp_emails_ins ON public.opportunity_emails;
CREATE TRIGGER trg_osrq_opp_emails_ins
  AFTER INSERT ON public.opportunity_emails
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_opp_emails_upd ON public.opportunity_emails;
CREATE TRIGGER trg_osrq_opp_emails_upd
  AFTER UPDATE OF opened_at, clicked_at, direction
  ON public.opportunity_emails
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

DROP TRIGGER IF EXISTS trg_osrq_contacts_upd ON public.contacts;
CREATE TRIGGER trg_osrq_contacts_upd
  AFTER UPDATE OF nome, emails, telefones, cargo, account_id, deleted_at
  ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_opportunity_score_recalc();

-- 5) Realtime
ALTER TABLE public.opportunities REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'opportunities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities';
  END IF;
END $$;