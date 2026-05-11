
-- 1) Expand check constraints to allow 'point_day'
ALTER TABLE public.products DROP CONSTRAINT IF EXISTS products_billing_type_check;
ALTER TABLE public.products ADD CONSTRAINT products_billing_type_check
  CHECK (billing_type = ANY (ARRAY['one_time'::text, 'recurring'::text, 'point_day'::text]));

ALTER TABLE public.proposal_items DROP CONSTRAINT IF EXISTS proposal_items_billing_type_check;
ALTER TABLE public.proposal_items ADD CONSTRAINT proposal_items_billing_type_check
  CHECK (billing_type = ANY (ARRAY['one_time'::text, 'recurring'::text, 'point_day'::text]));

-- 2) New product fields
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS default_unit_price_point_day numeric,
  ADD COLUMN IF NOT EXISTS default_billing_days integer,
  ADD COLUMN IF NOT EXISTS default_quantity_points integer DEFAULT 1;

-- 3) New proposal_items fields
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS quantity_points integer,
  ADD COLUMN IF NOT EXISTS billing_days integer,
  ADD COLUMN IF NOT EXISTS unit_price_point_day numeric;

-- 4) Trigger to compute totals for point_day items
CREATE OR REPLACE FUNCTION public.compute_proposal_item_point_day()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.billing_type = 'point_day' THEN
    IF NEW.quantity_points IS NULL OR NEW.quantity_points < 1 THEN
      NEW.quantity_points := 1;
    END IF;
    IF NEW.billing_days IS NULL OR NEW.billing_days < 1 THEN
      NEW.billing_days := 1;
    END IF;
    IF NEW.unit_price_point_day IS NULL THEN
      NEW.unit_price_point_day := COALESCE(NEW.unit_price, 0);
    END IF;
    NEW.quantity := NEW.quantity_points * NEW.billing_days;
    NEW.unit_price := NEW.unit_price_point_day;
    NEW.total := ROUND(
      (NEW.quantity_points * NEW.billing_days * NEW.unit_price_point_day)
      * (1 - COALESCE(NEW.discount_percent, 0) / 100.0),
      2
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_proposal_item_point_day ON public.proposal_items;
CREATE TRIGGER trg_compute_proposal_item_point_day
  BEFORE INSERT OR UPDATE ON public.proposal_items
  FOR EACH ROW
  EXECUTE FUNCTION public.compute_proposal_item_point_day();

-- 5) BOM table (composição técnica)
CREATE TABLE IF NOT EXISTS public.product_bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  component_product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  inventory_category_id uuid REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  inventory_family_id uuid REFERENCES public.inventory_families(id) ON DELETE SET NULL,
  quantity_per_point numeric NOT NULL DEFAULT 1,
  label text,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_bom_items_product ON public.product_bom_items(product_id);
CREATE INDEX IF NOT EXISTS idx_product_bom_items_org ON public.product_bom_items(organization_id);

ALTER TABLE public.product_bom_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view BOM" ON public.product_bom_items;
CREATE POLICY "Org members can view BOM"
  ON public.product_bom_items FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "Org members can insert BOM" ON public.product_bom_items;
CREATE POLICY "Org members can insert BOM"
  ON public.product_bom_items FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "Org members can update BOM" ON public.product_bom_items;
CREATE POLICY "Org members can update BOM"
  ON public.product_bom_items FOR UPDATE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP POLICY IF EXISTS "Org members can delete BOM" ON public.product_bom_items;
CREATE POLICY "Org members can delete BOM"
  ON public.product_bom_items FOR DELETE
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members
    WHERE user_id = auth.uid() AND status = 'active'
  ));

DROP TRIGGER IF EXISTS update_product_bom_items_updated_at ON public.product_bom_items;
CREATE TRIGGER update_product_bom_items_updated_at
  BEFORE UPDATE ON public.product_bom_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
