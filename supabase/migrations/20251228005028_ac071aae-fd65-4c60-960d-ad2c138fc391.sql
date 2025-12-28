-- Remover trigger duplicado que está causando registros duplicados no audit_log
-- Existem dois triggers chamando a mesma função track_opportunity_changes:
-- 1. track_opportunity_audit
-- 2. track_opportunity_changes_trigger
-- Mantemos apenas o track_opportunity_changes_trigger

DROP TRIGGER IF EXISTS track_opportunity_audit ON opportunities;