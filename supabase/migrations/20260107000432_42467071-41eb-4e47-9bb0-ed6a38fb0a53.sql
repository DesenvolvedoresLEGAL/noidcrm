-- Migration 7: Move pg_trgm extension to extensions schema
-- Phase 2 Security Fixes

-- Drop from public and recreate in extensions schema
DROP EXTENSION IF EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;