ALTER TABLE inventory_families
ADD COLUMN IF NOT EXISTS technical_spec_template jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE inventory_families
DROP CONSTRAINT IF EXISTS inventory_families_template_is_array;

ALTER TABLE inventory_families
ADD CONSTRAINT inventory_families_template_is_array
CHECK (jsonb_typeof(technical_spec_template) = 'array');