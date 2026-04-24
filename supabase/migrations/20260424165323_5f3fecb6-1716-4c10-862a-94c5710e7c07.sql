-- Cancelar run travado e adicionar coluna heartbeat para watchdog
UPDATE playbook_runs
SET status = 'failed',
    finished_at = now(),
    error_summary = 'Cancelado: timeout (>30min sem progresso). Run substituído por nova execução com persistência paralela.'
WHERE id = '7e40ec7c-62d9-4fa4-8cf3-be4d0d0d8b40'
  AND status = 'running';

-- Adicionar coluna heartbeat para detecção de runs órfãos
ALTER TABLE playbook_runs
ADD COLUMN IF NOT EXISTS last_heartbeat_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_playbook_runs_heartbeat
ON playbook_runs (status, last_heartbeat_at)
WHERE status = 'running';

-- Função watchdog: marca runs sem heartbeat há 15min como failed
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_playbook_runs()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected integer;
BEGIN
  UPDATE playbook_runs
  SET status = 'failed',
      finished_at = now(),
      error_summary = COALESCE(error_summary, '') || ' [watchdog: sem heartbeat há mais de 15 minutos]'
  WHERE status = 'running'
    AND COALESCE(last_heartbeat_at, started_at) < now() - interval '15 minutes';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;