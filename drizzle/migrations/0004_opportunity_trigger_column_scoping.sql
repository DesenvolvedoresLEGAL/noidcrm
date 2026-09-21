SET LOCAL lock_timeout = '15s';

DROP TRIGGER IF EXISTS trg_indicators_opportunity ON public.opportunities;
CREATE TRIGGER trg_indicators_opportunity
AFTER INSERT OR UPDATE OF
  stage_id, status, valor_previsto, mrr_value, close_date_prevista,
  owner_user_id, account_id, contact_id, pipeline_id, prob,
  next_followup_date, last_contact_date, closed_at, loss_reason_id, deleted_at
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.trg_enqueue_indicators_from_opportunity();

DROP TRIGGER IF EXISTS trg_nrhs_enqueue_opportunities ON public.opportunities;
CREATE TRIGGER trg_nrhs_enqueue_opportunities
AFTER INSERT OR UPDATE OF
  stage_id, status, valor_previsto, mrr_value, close_date_prevista,
  owner_user_id, account_id, contact_id, pipeline_id, deleted_at
ON public.opportunities
FOR EACH ROW EXECUTE FUNCTION public.enqueue_nrhs_recalc();