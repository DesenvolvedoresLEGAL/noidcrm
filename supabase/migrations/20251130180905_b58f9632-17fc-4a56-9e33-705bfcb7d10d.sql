-- Remover trigger problemático da tabela import_logs
-- Este trigger tentava atualizar um campo updated_at que não existe
DROP TRIGGER IF EXISTS update_import_logs_updated_at ON import_logs;