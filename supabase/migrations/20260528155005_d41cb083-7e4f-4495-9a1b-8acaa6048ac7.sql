-- Fase 1B: índices de performance (sem alterar regra de negócio)
CREATE INDEX IF NOT EXISTS idx_prospect_scores_prospect_id
  ON public.prospect_scores (prospect_id);

CREATE INDEX IF NOT EXISTS idx_proposal_dynamic_pricing_events_proposal_id
  ON public.proposal_dynamic_pricing_events (proposal_id);

-- Fase 1A: limpar logs acumulados que não fazem parte de regra de negócio.
-- cron.job_run_details acumula histórico do pg_cron; net._http_response acumula respostas HTTP.
-- DELETE em vez de TRUNCATE para minimizar lock (sem CASCADE em FKs externas).
DELETE FROM cron.job_run_details WHERE end_time < now() - interval '7 days';
DELETE FROM net._http_response WHERE created < now() - interval '7 days';