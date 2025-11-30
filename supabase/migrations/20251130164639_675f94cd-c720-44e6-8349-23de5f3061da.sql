-- Fix import_logs constraints to support all entity types and validation_failed status

-- 1. Drop and recreate status constraint to include 'validation_failed'
ALTER TABLE import_logs 
  DROP CONSTRAINT IF EXISTS import_logs_status_check;

ALTER TABLE import_logs 
  ADD CONSTRAINT import_logs_status_check 
  CHECK (status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'validation_failed'::text]));

-- 2. Drop and recreate entity_type constraint to include all 9 supported entity types
ALTER TABLE import_logs 
  DROP CONSTRAINT IF EXISTS import_logs_entity_type_check;

ALTER TABLE import_logs 
  ADD CONSTRAINT import_logs_entity_type_check 
  CHECK (entity_type = ANY (ARRAY[
    'accounts'::text, 
    'contacts'::text, 
    'opportunities'::text, 
    'products'::text, 
    'activities'::text, 
    'proposals'::text,
    'loss_reasons'::text, 
    'origins'::text, 
    'territories'::text
  ]));