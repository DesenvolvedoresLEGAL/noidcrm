-- SPRINT PERF 0.1 — Índices, autovacuum, retenção e VACUUM agendado
-- Não altera RLS, profiles, organization_members, dynamic pricing, propostas,
-- aceite, valor aprovado, Pix, ERP, Slack, views de receita/comissão ou regras comerciais.

-- =========================================================================
-- 1. Índice parcial: activities(account_id) WHERE deleted_at IS NULL
-- =========================================================================
CREATE INDEX IF NOT EXISTS idx_activities_account_active
  ON public.activities (account_id)
  WHERE deleted_at IS NULL;

-- Observação: proposal_dynamic_pricing_events já possui 2 índices em proposal_id
-- (idx_pdp_events_proposal e idx_proposal_dynamic_pricing_events_proposal_id).
-- Nenhum novo índice criado para evitar duplicação.

-- =========================================================================
-- 2. Autovacuum agressivo nas filas de recálculo (dead_tup = 2x live_tup hoje)
-- =========================================================================
ALTER TABLE public.lead_score_recalc_queue
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.05);

ALTER TABLE public.opportunity_score_recalc_queue
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.05);

ALTER TABLE public.opportunity_indicators_recalc_queue
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.05);

ALTER TABLE public.nrhs_recalc_queue
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.05);

-- =========================================================================
-- 3. Função de retenção (somente DELETE de registros operacionais antigos).
--    Não toca em receita, comissão, propostas, contas, contatos ou auditoria
--    de negócio — apenas logs técnicos/snapshots de telemetria.
-- =========================================================================
CREATE OR REPLACE FUNCTION public.perf_apply_retention_policies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_security  int := 0;
  v_audit     int := 0;
  v_system    int := 0;
  v_snapshots int := 0;
BEGIN
  -- security_audit_log: logs de tentativas/eventos de segurança (>90 dias)
  DELETE FROM public.security_audit_log
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_security = ROW_COUNT;

  -- audit_log: trilhas técnicas (>90 dias)
  DELETE FROM public.audit_log
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_audit = ROW_COUNT;

  -- system_events: eventos técnicos do sistema (>90 dias)
  DELETE FROM public.system_events
   WHERE created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_system = ROW_COUNT;

  -- entity_snapshots: snapshots de telemetria (>30 dias)
  DELETE FROM public.entity_snapshots
   WHERE created_at < now() - interval '30 days';
  GET DIAGNOSTICS v_snapshots = ROW_COUNT;

  RETURN jsonb_build_object(
    'security_audit_log_deleted', v_security,
    'audit_log_deleted',          v_audit,
    'system_events_deleted',      v_system,
    'entity_snapshots_deleted',   v_snapshots,
    'ran_at',                     now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.perf_apply_retention_policies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.perf_apply_retention_policies() FROM anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.perf_apply_retention_policies() TO service_role;

-- =========================================================================
-- 4. Agendamentos pg_cron — idempotentes (unschedule antes de reagendar)
-- =========================================================================

-- 4a. Retenção diária 04:00 UTC (01:00 BRT)
DO $$
BEGIN
  PERFORM cron.unschedule('perf-retention-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'perf-retention-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'perf-retention-daily',
  '0 4 * * *',
  $cron$ SELECT public.perf_apply_retention_policies(); $cron$
);

-- 4b. VACUUM ANALYZE diário nas filas (04:30 UTC, fora de pico)
DO $$
BEGIN
  PERFORM cron.unschedule('perf-vacuum-recalc-queues-daily')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'perf-vacuum-recalc-queues-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'perf-vacuum-recalc-queues-daily',
  '30 4 * * *',
  $cron$ VACUUM (ANALYZE) public.lead_score_recalc_queue,
                          public.opportunity_score_recalc_queue,
                          public.opportunity_indicators_recalc_queue,
                          public.nrhs_recalc_queue; $cron$
);

-- 4c. VACUUM FULL semanal em entity_snapshots (domingo 03:00 UTC).
--     Tabela tem 392MB com 1 live row — bloat severo, reclaim quase total.
--     ACCESS EXCLUSIVE LOCK breve em janela ociosa.
DO $$
BEGIN
  PERFORM cron.unschedule('perf-vacuum-entity-snapshots-weekly')
   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'perf-vacuum-entity-snapshots-weekly');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'perf-vacuum-entity-snapshots-weekly',
  '0 3 * * 0',
  $cron$ VACUUM (FULL, ANALYZE) public.entity_snapshots; $cron$
);

COMMENT ON FUNCTION public.perf_apply_retention_policies() IS
  'Sprint PERF 0.1 — Retenção segura: security_audit_log/audit_log/system_events > 90d, entity_snapshots > 30d. Não toca regra comercial.';