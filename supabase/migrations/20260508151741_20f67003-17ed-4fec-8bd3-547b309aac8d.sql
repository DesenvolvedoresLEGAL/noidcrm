-- ============================================================
-- Sprint INV 0.2 — Inventory base schema
-- ============================================================

-- 1) ENUMS
DO $$ BEGIN
  CREATE TYPE public.inventory_item_kind AS ENUM ('serialized','quantity');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_item_status AS ENUM ('available','blocked','maintenance','damaged','retired','lost');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_location_type AS ENUM ('internal','external','maintenance','event','technician','lost','retired','other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.inventory_movement_type AS ENUM (
    'initial_entry','manual_adjustment','location_change','status_change',
    'maintenance_entry','maintenance_exit','damage_report','loss_report',
    'retirement','release'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Helper function (access gate)
CREATE OR REPLACE FUNCTION public.user_can_access_inventory(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND org_role IN ('owner','admin','operations')
  );
$$;

-- 3) TABLES

-- inventory_categories
CREATE TABLE IF NOT EXISTS public.inventory_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  item_kind public.inventory_item_kind NOT NULL DEFAULT 'serialized',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_org ON public.inventory_categories(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_categories_active ON public.inventory_categories(organization_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_categories_unique_name_per_org
  ON public.inventory_categories(organization_id, lower(name));

-- inventory_locations
CREATE TABLE IF NOT EXISTS public.inventory_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  name text NOT NULL,
  description text NULL,
  location_type public.inventory_location_type NOT NULL DEFAULT 'internal',
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_org ON public.inventory_locations(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_locations_active ON public.inventory_locations(organization_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_locations_unique_name_per_org
  ON public.inventory_locations(organization_id, lower(name));

-- inventory_items
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  category_id uuid NULL REFERENCES public.inventory_categories(id) ON DELETE SET NULL,
  location_id uuid NULL REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  item_kind public.inventory_item_kind NOT NULL,
  status public.inventory_item_status NOT NULL DEFAULT 'available',
  name text NOT NULL,
  description text NULL,
  asset_code text NULL,
  serial_number text NULL,
  brand text NULL,
  model text NULL,
  unit_of_measure text NULL DEFAULT 'un',
  quantity_total numeric(12,2) NOT NULL DEFAULT 1,
  quantity_available numeric(12,2) NOT NULL DEFAULT 1,
  quantity_minimum numeric(12,2) NULL,
  acquisition_date date NULL,
  acquisition_cost numeric(12,2) NULL,
  notes text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_quantity_non_negative CHECK (
    quantity_total >= 0 AND quantity_available >= 0 AND quantity_available <= quantity_total
  ),
  CONSTRAINT inventory_items_serialized_quantity_valid CHECK (
    (item_kind = 'serialized' AND quantity_total = 1 AND quantity_available IN (0,1))
    OR (item_kind = 'quantity')
  )
);
CREATE INDEX IF NOT EXISTS idx_inventory_items_org ON public.inventory_items(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_category ON public.inventory_items(organization_id, category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_location ON public.inventory_items(organization_id, location_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_status ON public.inventory_items(organization_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_items_kind ON public.inventory_items(organization_id, item_kind);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_asset_code_unique_per_org
  ON public.inventory_items(organization_id, lower(asset_code))
  WHERE asset_code IS NOT NULL AND asset_code <> '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_inventory_items_serial_number_unique_per_org
  ON public.inventory_items(organization_id, lower(serial_number))
  WHERE serial_number IS NOT NULL AND serial_number <> '';

-- inventory_movements
CREATE TABLE IF NOT EXISTS public.inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  item_id uuid NULL REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  movement_type public.inventory_movement_type NOT NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  from_location_id uuid NULL REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  to_location_id uuid NULL REFERENCES public.inventory_locations(id) ON DELETE SET NULL,
  from_status public.inventory_item_status NULL,
  to_status public.inventory_item_status NULL,
  reason text NULL,
  notes text NULL,
  related_entity_type text NULL,
  related_entity_id uuid NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_org ON public.inventory_movements(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_item ON public.inventory_movements(organization_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_type ON public.inventory_movements(organization_id, movement_type);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created_at ON public.inventory_movements(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_related_entity
  ON public.inventory_movements(organization_id, related_entity_type, related_entity_id);

-- inventory_status_history
CREATE TABLE IF NOT EXISTS public.inventory_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  item_id uuid NOT NULL REFERENCES public.inventory_items(id) ON DELETE CASCADE,
  from_status public.inventory_item_status NULL,
  to_status public.inventory_item_status NOT NULL,
  reason text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_inventory_status_history_org ON public.inventory_status_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status_history_item ON public.inventory_status_history(organization_id, item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_status_history_created_at ON public.inventory_status_history(organization_id, created_at DESC);

-- 4) RLS
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_status_history ENABLE ROW LEVEL SECURITY;

-- Policies (SELECT/INSERT/UPDATE) — no DELETE allowed in this sprint
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'inventory_categories','inventory_locations','inventory_items',
    'inventory_movements','inventory_status_history'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "inv_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "inv_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "inv_update" ON public.%I', t);

    EXECUTE format($f$
      CREATE POLICY "inv_select" ON public.%I
        FOR SELECT TO authenticated
        USING (public.user_can_access_inventory(organization_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "inv_insert" ON public.%I
        FOR INSERT TO authenticated
        WITH CHECK (public.user_can_access_inventory(organization_id))
    $f$, t);

    EXECUTE format($f$
      CREATE POLICY "inv_update" ON public.%I
        FOR UPDATE TO authenticated
        USING (public.user_can_access_inventory(organization_id))
        WITH CHECK (public.user_can_access_inventory(organization_id))
    $f$, t);
  END LOOP;
END $$;

-- 5) Triggers — updated_at
DROP TRIGGER IF EXISTS trg_inventory_categories_updated_at ON public.inventory_categories;
CREATE TRIGGER trg_inventory_categories_updated_at
  BEFORE UPDATE ON public.inventory_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_locations_updated_at ON public.inventory_locations;
CREATE TRIGGER trg_inventory_locations_updated_at
  BEFORE UPDATE ON public.inventory_locations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
  BEFORE UPDATE ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Status history trigger
CREATE OR REPLACE FUNCTION public.fn_inventory_items_status_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.inventory_status_history (
      organization_id, item_id, from_status, to_status, created_by, metadata
    ) VALUES (
      NEW.organization_id, NEW.id, OLD.status, NEW.status, auth.uid(),
      jsonb_build_object('source','trigger')
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_items_status_history ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_status_history
  AFTER UPDATE OF status ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_items_status_history();

-- 7) Initial entry trigger
CREATE OR REPLACE FUNCTION public.fn_inventory_items_initial_entry()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.inventory_movements (
    organization_id, item_id, movement_type, quantity,
    to_location_id, to_status, reason, created_by, metadata
  ) VALUES (
    NEW.organization_id, NEW.id, 'initial_entry', NEW.quantity_total,
    NEW.location_id, NEW.status, 'Cadastro inicial do item', auth.uid(),
    jsonb_build_object('source','trigger')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_items_initial_entry ON public.inventory_items;
CREATE TRIGGER trg_inventory_items_initial_entry
  AFTER INSERT ON public.inventory_items
  FOR EACH ROW EXECUTE FUNCTION public.fn_inventory_items_initial_entry();