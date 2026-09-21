-- 1) Índice de polling das filas de recálculo
CREATE INDEX IF NOT EXISTS idx_osrq_status_created_pending
  ON public.opportunity_score_recalc_queue (status, created_at)
  WHERE status IN ('pending','processing');

CREATE INDEX IF NOT EXISTS idx_lsrq_status_created_pending
  ON public.lead_score_recalc_queue (status, created_at)
  WHERE status IN ('pending','processing');

-- 2) Função de retenção das filas (evita novo acúmulo de milhões de linhas)
CREATE OR REPLACE FUNCTION public.prune_recalc_queues()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.opportunity_score_recalc_queue
   WHERE status IN ('completed','skipped','failed')
     AND created_at < now() - interval '2 days';

  DELETE FROM public.nrhs_recalc_queue
   WHERE status IN ('completed','skipped','failed')
     AND created_at < now() - interval '2 days';

  DELETE FROM public.lead_score_recalc_queue
   WHERE status IN ('completed','skipped','failed')
     AND created_at < now() - interval '2 days';
END;
$$;

REVOKE ALL ON FUNCTION public.prune_recalc_queues() FROM PUBLIC, anon, authenticated;

-- 3) Agenda de limpeza de hora em hora
SELECT cron.unschedule('prune-recalc-queues')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'prune-recalc-queues');

SELECT cron.schedule('prune-recalc-queues', '20 * * * *', $$SELECT public.prune_recalc_queues();$$);

-- 4) Remoção de índices nunca utilizados em opportunities (custo de escrita e de planejamento)
DROP INDEX IF EXISTS public.idx_opportunities_trial_status;
DROP INDEX IF EXISTS public.idx_opportunities_qualification_loss_reason;
DROP INDEX IF EXISTS public.idx_opportunities_opp_grade;
DROP INDEX IF EXISTS public.idx_opportunities_nrhs_score;
DROP INDEX IF EXISTS public.idx_opportunities_nrhs_tier;
DROP INDEX IF EXISTS public.idx_opportunities_plg_classification;
DROP INDEX IF EXISTS public.idx_opportunities_opportunity_type;
DROP INDEX IF EXISTS public.idx_opportunities_lead_type;
DROP INDEX IF EXISTS public.idx_opportunities_plg_org;
DROP INDEX IF EXISTS public.idx_opportunities_temperatura;
DROP INDEX IF EXISTS public.idx_opportunities_urgency_score;
DROP INDEX IF EXISTS public.idx_opportunities_next_followup;
DROP INDEX IF EXISTS public.idx_opportunities_temperature;
DROP INDEX IF EXISTS public.idx_opportunities_opp_score;
DROP INDEX IF EXISTS public.idx_opportunities_score_updated;
DROP INDEX IF EXISTS public.idx_opportunities_won_at_org;
DROP INDEX IF EXISTS public.idx_opportunities_opp_health;