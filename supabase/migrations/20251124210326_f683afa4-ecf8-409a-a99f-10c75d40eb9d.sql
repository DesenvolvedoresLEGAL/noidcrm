-- Sprint 1: Products & Services Enhancement

-- Create product_categories table
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Enable RLS on product_categories
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

-- RLS Policies for product_categories
CREATE POLICY "Users can view org product categories"
  ON public.product_categories FOR SELECT
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can insert org product categories"
  ON public.product_categories FOR INSERT
  WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org product categories"
  ON public.product_categories FOR UPDATE
  USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete org product categories"
  ON public.product_categories FOR DELETE
  USING (user_is_org_admin(organization_id));

-- Add new columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'produto',
ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS reference TEXT,
ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'un',
ADD COLUMN IF NOT EXISTS ipi_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Add CHECK constraint for product type
ALTER TABLE public.products
ADD CONSTRAINT products_type_check CHECK (type IN ('produto', 'servico'));

-- Create trigger for product_categories updated_at
CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_products_category_id ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_type ON public.products(type);
CREATE INDEX IF NOT EXISTS idx_product_categories_org_id ON public.product_categories(organization_id);