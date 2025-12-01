-- FASE 3: Limpeza de import_logs pendentes/órfãos
-- Remove logs que nunca completaram (mais de 1 hora) para corrigir estatísticas infladas

DELETE FROM import_logs 
WHERE status IN ('processing', 'pending', 'validation_failed')
  AND created_at < NOW() - INTERVAL '1 hour';

-- Adicionar índice para melhorar performance das queries de estatísticas
CREATE INDEX IF NOT EXISTS idx_import_logs_status_created 
ON import_logs(status, created_at DESC);