
-- ============================================================================
-- NRHS v1 — Schema
-- ============================================================================

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS nrhs_status text,
  ADD COLUMN IF NOT EXISTS nrhs_data_integrity_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_cadence_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_stakeholders_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_win_loss_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_process_adherence_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_evidence_score integer,
  ADD COLUMN IF NOT EXISTS nrhs_gaps jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nrhs_recommendations jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS nrhs_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS nrhs_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS forecast_hygiene_eligible boolean,
  ADD COLUMN IF NOT EXISTS ote_hygiene_eligible boolean;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nrhs_score_range_chk') THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT nrhs_score_range_chk
      CHECK (nrhs_score IS NULL OR (nrhs_score BETWEEN 0 AND 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'nrhs_status_chk') THEN
    ALTER TABLE public.opportunities
      ADD CONSTRAINT nrhs_status_chk
      CHECK (nrhs_status IS NULL OR nrhs_status IN ('healthy','risk','critical','unhealthy'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_opportunities_nrhs_status
  ON public.opportunities (organization_id, nrhs_status)
  WHERE deleted_at IS NULL;

-- ============================================================================
-- nrhs_recalc_queue
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nrhs_recalc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  account_id uuid,
  trigger_source text NOT NULL,
  trigger_action text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_nrhs_queue_status_created
  ON public.nrhs_recalc_queue (status, created_at)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_nrhs_queue_opp
  ON public.nrhs_recalc_queue (opportunity_id, created_at DESC);

ALTER TABLE public.nrhs_recalc_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nrhs_queue_org_read ON public.nrhs_recalc_queue;
CREATE POLICY nrhs_queue_org_read ON public.nrhs_recalc_queue
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS nrhs_queue_member_insert ON public.nrhs_recalc_queue;
CREATE POLICY nrhs_queue_member_insert ON public.nrhs_recalc_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- nrhs_learning_signals
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nrhs_learning_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  opportunity_id uuid NOT NULL,
  account_id uuid,
  event_type text NOT NULL,
  event_value jsonb NOT NULL DEFAULT '{}'::jsonb,
  nrhs_score_at_event integer,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_nrhs_signals_org_opp_created
  ON public.nrhs_learning_signals (organization_id, opportunity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_nrhs_signals_event_type
  ON public.nrhs_learning_signals (organization_id, event_type, created_at DESC);

ALTER TABLE public.nrhs_learning_signals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS nrhs_signals_org_read ON public.nrhs_learning_signals;
CREATE POLICY nrhs_signals_org_read ON public.nrhs_learning_signals
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT om.organization_id FROM public.organization_members om
      WHERE om.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Enqueue function (debounce 2 minutos)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enqueue_nrhs_recalc()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    FROM public.nrhs_recalc_queue
    WHERE opportunity_id = v_opp
      AND status IN ('pending','processing')
      AND created_at > now() - interval '2 minutes'
    LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.nrhs_recalc_queue
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
    FROM public.nrhs_recalc_queue
    WHERE opportunity_id = v_opp
      AND status IN ('pending','processing')
      AND created_at > now() - interval '2 minutes'
    LIMIT 1;
    IF v_existing IS NULL THEN
      INSERT INTO public.nrhs_recalc_queue
        (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
      VALUES (v_org, v_opp, v_account, v_source, v_action);
    END IF;
    RETURN COALESCE(NEW, OLD);

  ELSIF v_source = 'contacts' THEN
    FOR r IN
      SELECT id, organization_id, account_id
      FROM public.opportunities
      WHERE (contact_id = COALESCE(NEW.id, OLD.id)
             OR account_id = COALESCE(NEW.account_id, OLD.account_id))
        AND deleted_at IS NULL
    LOOP
      v_existing := NULL;
      SELECT id INTO v_existing
      FROM public.nrhs_recalc_queue
      WHERE opportunity_id = r.id
        AND status IN ('pending','processing')
        AND created_at > now() - interval '2 minutes'
      LIMIT 1;
      IF v_existing IS NULL THEN
        INSERT INTO public.nrhs_recalc_queue
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
$function$;

-- ============================================================================
-- Triggers de enqueue
-- ============================================================================

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_opportunities ON public.opportunities;
CREATE TRIGGER trg_nrhs_enqueue_opportunities
AFTER INSERT OR UPDATE OF
  stage_id, status, valor_previsto, mrr_value, close_date_prevista,
  owner_user_id, account_id, contact_id, pipeline_id, deleted_at, updated_at
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_activities ON public.activities;
CREATE TRIGGER trg_nrhs_enqueue_activities
AFTER INSERT OR UPDATE OF status, type, completed_at, scheduled_date, deleted_at
ON public.activities
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_contacts ON public.contacts;
CREATE TRIGGER trg_nrhs_enqueue_contacts
AFTER INSERT OR UPDATE OF cargo, emails, telefones, deleted_at
ON public.contacts
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_proposals ON public.proposals;
CREATE TRIGGER trg_nrhs_enqueue_proposals
AFTER INSERT OR UPDATE OF status, sent_at, viewed_at
ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_opp_emails ON public.opportunity_emails;
CREATE TRIGGER trg_nrhs_enqueue_opp_emails
AFTER INSERT OR UPDATE OF sent_at, opened_at, clicked_at
ON public.opportunity_emails
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();

-- ============================================================================
-- Trigger de eventos de aprendizado (won/lost/stage_advanced/regressed)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.record_nrhs_learning_signal()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event text;
  v_old_pos integer;
  v_new_pos integer;
BEGIN
  IF NEW.status = 'won' AND COALESCE(OLD.status, '') <> 'won' THEN
    v_event := 'opportunity_won';
  ELSIF NEW.status = 'lost' AND COALESCE(OLD.status, '') <> 'lost' THEN
    v_event := 'opportunity_lost';
  ELSIF COALESCE(NEW.stage_id::text, '') <> COALESCE(OLD.stage_id::text, '') THEN
    SELECT position INTO v_old_pos FROM public.pipeline_stages WHERE id = OLD.stage_id;
    SELECT position INTO v_new_pos FROM public.pipeline_stages WHERE id = NEW.stage_id;
    IF v_new_pos IS NOT NULL AND v_old_pos IS NOT NULL THEN
      v_event := CASE WHEN v_new_pos > v_old_pos THEN 'stage_advanced' ELSE 'stage_regressed' END;
    ELSE
      v_event := 'stage_changed';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.nrhs_learning_signals
    (organization_id, opportunity_id, account_id, event_type, nrhs_score_at_event, outcome, event_value)
  VALUES (
    NEW.organization_id,
    NEW.id,
    NEW.account_id,
    v_event,
    NEW.nrhs_score,
    NEW.status,
    jsonb_build_object(
      'old_status', OLD.status,
      'new_status', NEW.status,
      'old_stage_id', OLD.stage_id,
      'new_stage_id', NEW.stage_id
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_nrhs_learning_signal ON public.opportunities;
CREATE TRIGGER trg_nrhs_learning_signal
AFTER UPDATE OF status, stage_id ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.record_nrhs_learning_signal();

-- ============================================================================
-- Backfill: enfileira recálculo para todas as oportunidades não fechadas
-- ============================================================================

INSERT INTO public.nrhs_recalc_queue (organization_id, opportunity_id, account_id, trigger_source, trigger_action)
SELECT o.organization_id, o.id, o.account_id, 'backfill_sprint14', 'recalculate'
FROM public.opportunities o
WHERE o.deleted_at IS NULL
  AND o.status NOT IN ('won','lost')
  AND NOT EXISTS (
    SELECT 1 FROM public.nrhs_recalc_queue q
    WHERE q.opportunity_id = o.id AND q.status IN ('pending','processing')
  );
