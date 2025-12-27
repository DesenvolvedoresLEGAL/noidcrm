-- Add missing columns to contacts table to match NATIVE_FIELDS.contact
ALTER TABLE public.contacts 
ADD COLUMN IF NOT EXISTS email_principal text,
ADD COLUMN IF NOT EXISTS telefone_principal text,
ADD COLUMN IF NOT EXISTS departamento text,
ADD COLUMN IF NOT EXISTS linkedin text,
ADD COLUMN IF NOT EXISTS observacoes text;