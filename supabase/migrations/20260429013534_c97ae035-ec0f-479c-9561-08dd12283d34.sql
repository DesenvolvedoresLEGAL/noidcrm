-- Sprint Scoring 1.1 — Auto Lead Score Recalculation Queue + Triggers

CREATE TABLE IF NOT EXISTS public.lead_score_recalc_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  trigger_source text NOT NULL CHECK (trigger_source IN ('accounts','contacts','opportunities','activities','manual')),
  trigger_action text NOT NULL CHECK (trigger_action IN ('insert','update','delete')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','completed','failed','skipped')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_lsrq_org_account_status
  ON public.lead_score_recalc_queue(organization_id, account_id, status);
CREATE INDEX IF NOT EXISTS idx_lsrq_status_created
  ON public.lead_score_recalc_queue(status, created_at);
CREATE INDEX IF NOT EXISTS idx_lsrq_account_created_desc
  ON public.lead_score_recalc_queue(account_id, created_at DESC);

ALTER TABLE public.lead_score_recalc_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lsrq_select_org_members" ON public.lead_score_recalc_queue;
CREATE POLICY "lsrq_select_org_members"
  ON public.lead_score_recalc_queue
  FOR SELECT
  USING (public.user_is_org_member(organization_id));

CREATE OR REPLACE FUNCTION public.enqueue_lead_score_recalc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org uuid;
  v_account uuid;
  v_source text := TG_TABLE_NAME;
  v_action text := lower(TG_OP);
  v_existing uuid;
BEGIN
  IF v_source = 'accounts' THEN
    v_org := COALESCE(NEW.organization_id, OLD.organization_id);
    v_account := COALESCE(NEW.id, OLD.id);
  ELSIF v_source IN ('contacts','opportunities','activities') THEN
    v_org := COALESCE(NEW.organization_id, OLD.organization_id);
    v_account := COALESCE(NEW.account_id, OLD.account_id);
  END IF;

  IF v_account IS NULL OR v_org IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT id INTO v_existing
  FROM public.lead_score_recalc_queue
  WHERE organization_id = v_org
    AND account_id = v_account
    AND trigger_source = v_source
    AND status = 'pending'
    AND created_at > now() - interval '2 minutes'
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.lead_score_recalc_queue
    (organization_id, account_id, trigger_source, trigger_action)
  VALUES (v_org, v_account, v_source, v_action);

  RETURN COALESCE(NEW, OLD);
EXCEPTION WHEN OTHERS THEN
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Triggers (column-scoped where possible)
DROP TRIGGER IF EXISTS trg_lsrq_accounts_ins ON public.accounts;
CREATE TRIGGER trg_lsrq_accounts_ins
  AFTER INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_accounts_upd ON public.accounts;
CREATE TRIGGER trg_lsrq_accounts_upd
  AFTER UPDATE OF razao_social, nome_fantasia, cnpj, segmento, tamanho, porte,
                  capital_social, cidade, uf, telefones, emails, cnae
  ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_contacts_iud ON public.contacts;
CREATE TRIGGER trg_lsrq_contacts_iud
  AFTER INSERT OR DELETE ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_contacts_upd ON public.contacts;
CREATE TRIGGER trg_lsrq_contacts_upd
  AFTER UPDATE OF nome, emails, telefones, cargo, departamento, account_id, deleted_at
  ON public.contacts
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_opportunities_iud ON public.opportunities;
CREATE TRIGGER trg_lsrq_opportunities_iud
  AFTER INSERT OR DELETE ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_opportunities_upd ON public.opportunities;
CREATE TRIGGER trg_lsrq_opportunities_upd
  AFTER UPDATE OF stage_id, status, valor_previsto, won_at, lost_at, closed_at, account_id
  ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_activities_iud ON public.activities;
CREATE TRIGGER trg_lsrq_activities_iud
  AFTER INSERT OR DELETE ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

DROP TRIGGER IF EXISTS trg_lsrq_activities_upd ON public.activities;
CREATE TRIGGER trg_lsrq_activities_upd
  AFTER UPDATE OF status, type, completed_at, scheduled_date, account_id, opportunity_id, deleted_at
  ON public.activities
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_lead_score_recalc();

-- Realtime: ensure accounts emits full row updates so clients can detect score field changes
ALTER TABLE public.accounts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts';
  END IF;
END $$;
