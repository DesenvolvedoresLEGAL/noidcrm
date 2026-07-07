
-- 1) Table
CREATE TABLE IF NOT EXISTS public.product_inventory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,

  label text NOT NULL,

  eventrix_category_id text NOT NULL,
  eventrix_category_name text NOT NULL,

  eventrix_family_id text NOT NULL,
  eventrix_family_name text NOT NULL,

  eventrix_item_kind text NULL,

  quantity numeric(12,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_basis text NOT NULL DEFAULT 'per_point'
    CHECK (unit_basis IN ('per_point','per_event','per_day','per_participant','per_unit','manual')),

  is_required boolean NOT NULL DEFAULT true,
  notes text NULL,

  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,

  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Grants
GRANT SELECT, INSERT, UPDATE ON public.product_inventory_requirements TO authenticated;
GRANT ALL ON public.product_inventory_requirements TO service_role;

-- 3) Indexes
CREATE INDEX IF NOT EXISTS idx_pir_org
  ON public.product_inventory_requirements(organization_id);
CREATE INDEX IF NOT EXISTS idx_pir_product
  ON public.product_inventory_requirements(organization_id, product_id);
CREATE INDEX IF NOT EXISTS idx_pir_eventrix_category
  ON public.product_inventory_requirements(organization_id, eventrix_category_id);
CREATE INDEX IF NOT EXISTS idx_pir_eventrix_family
  ON public.product_inventory_requirements(organization_id, eventrix_family_id);
CREATE INDEX IF NOT EXISTS idx_pir_active
  ON public.product_inventory_requirements(organization_id, product_id, is_active);

-- 4) RLS
ALTER TABLE public.product_inventory_requirements ENABLE ROW LEVEL SECURITY;

-- Read: same set as eventrix inventory read helper (managers included)
CREATE POLICY "pir_select"
  ON public.product_inventory_requirements
  FOR SELECT TO authenticated
  USING (public.user_can_read_eventrix_inventory(organization_id));

-- Write: owner/admin/operations
CREATE POLICY "pir_insert"
  ON public.product_inventory_requirements
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE POLICY "pir_update"
  ON public.product_inventory_requirements
  FOR UPDATE TO authenticated
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

-- No DELETE policy (soft delete only via is_active)

-- 5) updated_at trigger
CREATE TRIGGER trg_pir_updated_at
  BEFORE UPDATE ON public.product_inventory_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
