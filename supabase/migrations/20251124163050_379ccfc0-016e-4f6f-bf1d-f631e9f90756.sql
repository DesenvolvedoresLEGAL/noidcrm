-- Sprint 3: UPSERT e Relacionamentos Automáticos
-- Adicionar colunas para rastreamento de UPSERT e relacionamentos

ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS operation_mode TEXT DEFAULT 'insert';
ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS update_count INTEGER DEFAULT 0;
ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS relationship_count INTEGER DEFAULT 0;
ALTER TABLE import_logs ADD COLUMN IF NOT EXISTS upsert_settings JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN import_logs.operation_mode IS 'Modo de operação: insert ou upsert';
COMMENT ON COLUMN import_logs.update_count IS 'Número de registros atualizados no modo upsert';
COMMENT ON COLUMN import_logs.relationship_count IS 'Número de relacionamentos automáticos criados';
COMMENT ON COLUMN import_logs.upsert_settings IS 'Configurações de upsert: unique_fields, update_strategy, etc.';