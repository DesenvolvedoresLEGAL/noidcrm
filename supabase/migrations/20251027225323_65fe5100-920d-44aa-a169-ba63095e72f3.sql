-- Add new fields to organizations table for Phase 2
ALTER TABLE public.organizations
ADD COLUMN IF NOT EXISTS legal_name TEXT,
ADD COLUMN IF NOT EXISTS address_street TEXT,
ADD COLUMN IF NOT EXISTS address_number TEXT,
ADD COLUMN IF NOT EXISTS address_complement TEXT,
ADD COLUMN IF NOT EXISTS address_city TEXT,
ADD COLUMN IF NOT EXISTS address_state TEXT,
ADD COLUMN IF NOT EXISTS address_zip TEXT,
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS email TEXT,
ADD COLUMN IF NOT EXISTS website TEXT,
ADD COLUMN IF NOT EXISTS state_registration TEXT,
ADD COLUMN IF NOT EXISTS municipal_registration TEXT,
ADD COLUMN IF NOT EXISTS responsible_user_id UUID REFERENCES auth.users(id);

-- Add index for responsible user lookup
CREATE INDEX IF NOT EXISTS idx_organizations_responsible_user ON public.organizations(responsible_user_id);

-- Add comments for documentation
COMMENT ON COLUMN public.organizations.legal_name IS 'Razão Social - Legal company name';
COMMENT ON COLUMN public.organizations.address_street IS 'Street address';
COMMENT ON COLUMN public.organizations.address_number IS 'Address number';
COMMENT ON COLUMN public.organizations.address_complement IS 'Address complement/apartment';
COMMENT ON COLUMN public.organizations.address_city IS 'City';
COMMENT ON COLUMN public.organizations.address_state IS 'State/Province';
COMMENT ON COLUMN public.organizations.address_zip IS 'ZIP/Postal code (CEP)';
COMMENT ON COLUMN public.organizations.phone IS 'Company phone number';
COMMENT ON COLUMN public.organizations.email IS 'Company email';
COMMENT ON COLUMN public.organizations.website IS 'Company website URL';
COMMENT ON COLUMN public.organizations.state_registration IS 'State tax registration (Inscrição Estadual)';
COMMENT ON COLUMN public.organizations.municipal_registration IS 'Municipal tax registration (Inscrição Municipal)';
COMMENT ON COLUMN public.organizations.responsible_user_id IS 'User responsible for the account';