-- Add 'follow_up' to activities type check constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_type_check 
  CHECK (type = ANY (ARRAY['call'::text, 'email'::text, 'meeting'::text, 'task'::text, 'whatsapp'::text, 'note'::text, 'follow_up'::text]));