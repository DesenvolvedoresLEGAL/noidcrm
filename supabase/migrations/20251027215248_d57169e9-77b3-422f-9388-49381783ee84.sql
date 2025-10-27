-- Create products table for dynamic product management
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_organization_id ON public.products(organization_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(active) WHERE active = true;

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view org products"
  ON public.products FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can insert products"
  ON public.products FOR INSERT
  WITH CHECK (user_is_org_admin(organization_id));

CREATE POLICY "Admins can update products"
  ON public.products FOR UPDATE
  USING (user_is_org_admin(organization_id));

CREATE POLICY "Admins can delete products"
  ON public.products FOR DELETE
  USING (user_is_org_admin(organization_id));