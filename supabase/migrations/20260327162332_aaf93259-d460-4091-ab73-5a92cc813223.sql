
-- 1. Add sync fields to products table
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS external_source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_products_external_id_org
  ON public.products(organization_id, external_source, external_id)
  WHERE external_id IS NOT NULL;

-- 2. Create api_keys table
CREATE TABLE public.api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
);

-- RLS for api_keys
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Only org admins/owners can manage API keys
CREATE POLICY "Users can view own org api keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can insert own org api keys"
ON public.api_keys
FOR INSERT
TO authenticated
WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can update own org api keys"
ON public.api_keys
FOR UPDATE
TO authenticated
USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete own org api keys"
ON public.api_keys
FOR DELETE
TO authenticated
USING (organization_id = public.get_user_organization_id());
