-- ============================================================
-- SPRINT SCORING 1.3 — Forensic audit + consolidated indicators
-- ============================================================

-- 1. Schema additions on opportunities (idempotent)
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS deal_health text,
  ADD COLUMN IF NOT EXISTS deal_health_score integer,
  ADD COLUMN IF NOT EXISTS deal_health_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deal_health_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS risk_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS risk_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS engagement_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS engagement_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS velocity_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS velocity_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_win_probability_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_win_probability_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS indicators_updated_at timestamptz;

-- 2. Recalculation queue
CREATE TABLE IF NOT EXISTS public.opportunity_indicators_recalc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  account_id uuid NULL,
  trigger_source text NOT NULL,
  trigger_action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_opp_ind_queue_pending
  ON public.opportunity_indicators_recalc_queue (created_at)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_opp_ind_queue_opp
  ON public.opportunity_indicators_recalc_queue (opportunity_id, status);

ALTER TABLE public.opportunity_indicators_recalc_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members read own queue rows" ON public.opportunity_indicators_recalc_queue;
CREATE POLICY "Org members read own queue rows"
  ON public.opportunity_indicators_recalc_queue
  FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- 3. Enqueue function (debounce 2min per opportunity)
CREATE OR REPLACE FUNCTION public.enqueue_opportunity_indicators_recalc(
  _opportunity_id uuid,
  _organization_id uuid,
  _account_id uuid,
  _trigger_source text,
  _trigger_action text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  recent_pending uuid;
BEGIN
  IF _opportunity_id IS NULL OR _organization_id IS NULL THEN
    RETURN;
  END IF;

  SELECT id INTO recent_pending
  FROM public.opportunity_indicators_recalc_queue
  WHERE opportunity_id = _opportunity_id
    AND status IN ('pending','processing')
    AND created_at > now() - interval '2 minutes'
  LIMIT 1;

  IF recent_pending IS NOT NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.opportunity_indicators_recalc_queue
    (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
  VALUES
    (_organization_id, _opportunity_id, _account_id, _trigger_source, _trigger_action);
END;
$$;

-- 4. Trigger functions
CREATE OR REPLACE FUNCTION public.trg_enqueue_indicators_from_opportunity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT')
     OR NEW.stage_id IS DISTINCT FROM OLD.stage_id
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.amount IS DISTINCT FROM OLD.amount
     OR NEW.contact_id IS DISTINCT FROM OLD.contact_id
     OR NEW.account_id IS DISTINCT FROM OLD.account_id
     OR NEW.won_at IS DISTINCT FROM OLD.won_at
     OR NEW.lost_at IS DISTINCT FROM OLD.lost_at
     OR NEW.opportunity_score IS DISTINCT FROM OLD.opportunity_score
  THEN
    PERFORM public.enqueue_opportunity_indicators_recalc(
      NEW.id, NEW.organization_id, NEW.account_id,
      'opportunities_trigger', TG_OP
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicators_opportunity ON public.opportunities;
CREATE TRIGGER trg_indicators_opportunity
  AFTER INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_indicators_from_opportunity();

CREATE OR REPLACE FUNCTION public.trg_enqueue_indicators_from_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_acc uuid;
BEGIN
  IF COALESCE(NEW.opportunity_id, OLD.opportunity_id) IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT organization_id, account_id INTO v_org, v_acc
  FROM public.opportunities WHERE id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  IF v_org IS NOT NULL THEN
    PERFORM public.enqueue_opportunity_indicators_recalc(
      COALESCE(NEW.opportunity_id, OLD.opportunity_id), v_org, v_acc,
      'activities_trigger', TG_OP
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_indicators_activity ON public.activities;
CREATE TRIGGER trg_indicators_activity
  AFTER INSERT OR UPDATE OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_indicators_from_activity();

CREATE OR REPLACE FUNCTION public.trg_enqueue_indicators_from_proposal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_acc uuid;
BEGIN
  IF COALESCE(NEW.opportunity_id, OLD.opportunity_id) IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  SELECT organization_id, account_id INTO v_org, v_acc
  FROM public.opportunities WHERE id = COALESCE(NEW.opportunity_id, OLD.opportunity_id);
  IF v_org IS NOT NULL THEN
    PERFORM public.enqueue_opportunity_indicators_recalc(
      COALESCE(NEW.opportunity_id, OLD.opportunity_id), v_org, v_acc,
      'proposals_trigger', TG_OP
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_indicators_proposal ON public.proposals;
CREATE TRIGGER trg_indicators_proposal
  AFTER INSERT OR UPDATE ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_indicators_from_proposal();

CREATE OR REPLACE FUNCTION public.trg_enqueue_indicators_from_opp_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_acc uuid;
BEGIN
  IF NEW.opportunity_id IS NULL THEN RETURN NEW; END IF;
  SELECT organization_id, account_id INTO v_org, v_acc
  FROM public.opportunities WHERE id = NEW.opportunity_id;
  IF v_org IS NOT NULL THEN
    PERFORM public.enqueue_opportunity_indicators_recalc(
      NEW.opportunity_id, v_org, v_acc, 'opp_emails_trigger', TG_OP
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_indicators_opp_email ON public.opportunity_emails;
CREATE TRIGGER trg_indicators_opp_email
  AFTER INSERT OR UPDATE ON public.opportunity_emails
  FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_indicators_from_opp_email();

-- 5. Realtime publication
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='opportunities'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.opportunities';
  END IF;
END $$;

ALTER TABLE public.opportunities REPLICA IDENTITY FULL;

-- 6. Backfill: enqueue all OPEN opportunities to fix the AI Win = 100% mass bug
INSERT INTO public.opportunity_indicators_recalc_queue
  (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
SELECT organization_id, id, account_id, 'sprint_1_3_backfill', 'audit'
FROM public.opportunities
WHERE deleted_at IS NULL
  AND status IN ('new','open');
