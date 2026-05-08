-- ============================================================================
-- Sprint INV 1.1 — Reserva Definitiva e Conversão de Pré Reserva
-- ============================================================================

-- 1) inventory_reservations
CREATE TABLE IF NOT EXISTS public.inventory_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pre_reservation_id uuid REFERENCES public.inventory_pre_reservations(id) ON DELETE SET NULL,
  proposal_id uuid,
  opportunity_id uuid,
  account_id uuid,
  contact_id uuid,
  reservation_code text NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'pre_reservation',
  operational_start_date date NOT NULL,
  operational_end_date date NOT NULL,
  event_start_date date,
  event_end_date date,
  status text NOT NULL DEFAULT 'confirmed',
  risk_level text NOT NULL DEFAULT 'low',
  confirmation_trigger text NOT NULL DEFAULT 'manual',
  confirmed_at timestamptz,
  confirmed_by uuid REFERENCES auth.users(id),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_reservations_status_check
    CHECK (status IN ('confirmed','in_preparation','dispatched','in_operation','returned','closed','cancelled')),
  CONSTRAINT inventory_reservations_risk_level_check
    CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT inventory_reservations_source_check
    CHECK (source IN ('pre_reservation','proposal','manual','agent','import')),
  CONSTRAINT inventory_reservations_confirmation_trigger_check
    CHECK (confirmation_trigger IN ('proposal_approved','payment_confirmed','manual','agent')),
  CONSTRAINT inventory_reservations_date_check
    CHECK (operational_end_date >= operational_start_date),
  CONSTRAINT inventory_reservations_org_code_unique
    UNIQUE (organization_id, reservation_code)
);

-- 2) inventory_reservation_items
CREATE TABLE IF NOT EXISTS public.inventory_reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  source_pre_reservation_item_id uuid REFERENCES public.inventory_pre_reservation_items(id) ON DELETE SET NULL,
  inventory_item_type text NOT NULL,
  serialized_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.inventory_categories(id),
  family_id uuid REFERENCES public.inventory_families(id),
  requested_quantity numeric NOT NULL DEFAULT 1,
  reserved_quantity numeric NOT NULL DEFAULT 0,
  demand_label text,
  demand_source text NOT NULL DEFAULT 'pre_reservation',
  reservation_status text NOT NULL DEFAULT 'reserved',
  conflict_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inv_res_items_type_check
    CHECK (inventory_item_type IN ('serialized','quantity','category_family_demand','service_no_stock')),
  CONSTRAINT inv_res_items_status_check
    CHECK (reservation_status IN ('reserved','partial','unavailable','no_stock_control','cancelled')),
  CONSTRAINT inv_res_items_quantity_check
    CHECK (requested_quantity >= 0 AND reserved_quantity >= 0)
);

-- 3) inventory_reservation_allocations
CREATE TABLE IF NOT EXISTS public.inventory_reservation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid NOT NULL REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  reservation_item_id uuid NOT NULL REFERENCES public.inventory_reservation_items(id) ON DELETE CASCADE,
  source_pre_reservation_allocation_id uuid REFERENCES public.inventory_pre_reservation_allocations(id) ON DELETE SET NULL,
  allocation_item_type text NOT NULL,
  serialized_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  allocated_quantity numeric NOT NULL DEFAULT 1,
  allocation_status text NOT NULL DEFAULT 'active',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inv_res_alloc_type_check
    CHECK (allocation_item_type IN ('serialized','quantity')),
  CONSTRAINT inv_res_alloc_status_check
    CHECK (allocation_status IN ('active','cancelled','replaced')),
  CONSTRAINT inv_res_alloc_quantity_check
    CHECK (allocated_quantity > 0),
  CONSTRAINT inv_res_alloc_reference_check
    CHECK (
      (allocation_item_type = 'serialized'
        AND serialized_item_id IS NOT NULL AND quantity_item_id IS NULL)
      OR
      (allocation_item_type = 'quantity'
        AND quantity_item_id IS NOT NULL AND serialized_item_id IS NULL)
    )
);

-- 4) Indexes
CREATE INDEX IF NOT EXISTS idx_inv_res_org_status
  ON public.inventory_reservations (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_res_pre_reservation
  ON public.inventory_reservations (organization_id, pre_reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_proposal
  ON public.inventory_reservations (organization_id, proposal_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_period
  ON public.inventory_reservations (organization_id, operational_start_date, operational_end_date);

CREATE INDEX IF NOT EXISTS idx_inv_res_items_reservation
  ON public.inventory_reservation_items (organization_id, reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_items_serialized
  ON public.inventory_reservation_items (organization_id, serialized_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_items_quantity
  ON public.inventory_reservation_items (organization_id, quantity_item_id);

CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_reservation
  ON public.inventory_reservation_allocations (organization_id, reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_item
  ON public.inventory_reservation_allocations (organization_id, reservation_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_serialized
  ON public.inventory_reservation_allocations (organization_id, serialized_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_quantity
  ON public.inventory_reservation_allocations (organization_id, quantity_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_status
  ON public.inventory_reservation_allocations (organization_id, allocation_status);

-- 5) RLS
ALTER TABLE public.inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_reservation_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View inventory reservations from org"
  ON public.inventory_reservations FOR SELECT
  USING (public.user_can_access_inventory(organization_id));
CREATE POLICY "Create inventory reservations from org"
  ON public.inventory_reservations FOR INSERT
  WITH CHECK (public.user_can_access_inventory(organization_id));
CREATE POLICY "Update inventory reservations from org"
  ON public.inventory_reservations FOR UPDATE
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));
CREATE POLICY "Admins delete inventory reservations"
  ON public.inventory_reservations FOR DELETE
  USING (public.user_is_org_admin(organization_id));

CREATE POLICY "View inventory reservation items from org"
  ON public.inventory_reservation_items FOR SELECT
  USING (public.user_can_access_inventory(organization_id));
CREATE POLICY "Manage inventory reservation items from org"
  ON public.inventory_reservation_items FOR ALL
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE POLICY "View inventory reservation allocations from org"
  ON public.inventory_reservation_allocations FOR SELECT
  USING (public.user_can_access_inventory(organization_id));
CREATE POLICY "Manage inventory reservation allocations from org"
  ON public.inventory_reservation_allocations FOR ALL
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

-- 6) updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_inventory_reservation_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inv_res_updated_at
  BEFORE UPDATE ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_reservation_updated_at();
CREATE TRIGGER trg_inv_res_items_updated_at
  BEFORE UPDATE ON public.inventory_reservation_items
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_reservation_updated_at();
CREATE TRIGGER trg_inv_res_alloc_updated_at
  BEFORE UPDATE ON public.inventory_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_reservation_updated_at();

-- 7) Code generator
CREATE OR REPLACE FUNCTION public.generate_inventory_reservation_code(org_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COUNT(*) + 1 INTO next_number
  FROM public.inventory_reservations
  WHERE organization_id = org_id;
  RETURN 'RES-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_reservation_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reservation_code IS NULL OR trim(NEW.reservation_code) = '' THEN
    NEW.reservation_code := public.generate_inventory_reservation_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_inv_res_code
  BEFORE INSERT ON public.inventory_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_reservation_code();

-- 8) Validate org consistency on items
CREATE OR REPLACE FUNCTION public.validate_inventory_reservation_item_org()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_org_id uuid;
BEGIN
  SELECT organization_id INTO parent_org_id
  FROM public.inventory_reservations
  WHERE id = NEW.reservation_id;
  IF parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Reserva não encontrada.';
  END IF;
  IF NEW.organization_id <> parent_org_id THEN
    RAISE EXCEPTION 'Item da reserva pertence a outra organização.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_inv_res_item_org
  BEFORE INSERT OR UPDATE ON public.inventory_reservation_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_reservation_item_org();

-- 9) Validate org consistency on allocations
CREATE OR REPLACE FUNCTION public.validate_inventory_reservation_allocation_org()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_org_id uuid;
  parent_reservation_id uuid;
BEGIN
  SELECT organization_id, reservation_id
    INTO parent_org_id, parent_reservation_id
  FROM public.inventory_reservation_items
  WHERE id = NEW.reservation_item_id;
  IF parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Item da reserva não encontrado.';
  END IF;
  IF NEW.organization_id <> parent_org_id THEN
    RAISE EXCEPTION 'Alocação pertence a outra organização.';
  END IF;
  IF NEW.reservation_id <> parent_reservation_id THEN
    RAISE EXCEPTION 'Alocação não pertence à mesma reserva do item.';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_inv_res_alloc_org
  BEFORE INSERT OR UPDATE ON public.inventory_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_reservation_allocation_org();

-- 10) Validate physical inventory item on allocations
CREATE OR REPLACE FUNCTION public.validate_inventory_reservation_allocation_inventory_item()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  item_org_id uuid;
  item_kind_value text;
BEGIN
  IF NEW.allocation_item_type = 'serialized' THEN
    SELECT organization_id, item_kind::text
      INTO item_org_id, item_kind_value
    FROM public.inventory_items
    WHERE id = NEW.serialized_item_id;
    IF item_org_id IS NULL THEN
      RAISE EXCEPTION 'Item serializado não encontrado.';
    END IF;
    IF item_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Item serializado pertence a outra organização.';
    END IF;
    IF item_kind_value <> 'serialized' THEN
      RAISE EXCEPTION 'Item informado não é serializado.';
    END IF;
  END IF;
  IF NEW.allocation_item_type = 'quantity' THEN
    SELECT organization_id, item_kind::text
      INTO item_org_id, item_kind_value
    FROM public.inventory_items
    WHERE id = NEW.quantity_item_id;
    IF item_org_id IS NULL THEN
      RAISE EXCEPTION 'Item por quantidade não encontrado.';
    END IF;
    IF item_org_id <> NEW.organization_id THEN
      RAISE EXCEPTION 'Item por quantidade pertence a outra organização.';
    END IF;
    IF item_kind_value <> 'quantity' THEN
      RAISE EXCEPTION 'Item informado não é por quantidade.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_inv_res_alloc_item
  BEFORE INSERT OR UPDATE ON public.inventory_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_inventory_reservation_allocation_inventory_item();

-- 11) Conflict checker against other definitive reservations
CREATE OR REPLACE FUNCTION public.check_inventory_reservation_conflict(
  p_organization_id uuid,
  p_allocation_item_type text,
  p_serialized_item_id uuid,
  p_quantity_item_id uuid,
  p_requested_quantity numeric,
  p_start_date date,
  p_end_date date,
  p_ignore_reservation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  conflict_status text,
  available_quantity numeric,
  already_reserved_quantity numeric,
  conflict_count bigint,
  message text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_available numeric := 0;
  reserved_in_period numeric := 0;
BEGIN
  IF NOT public.user_can_access_inventory(p_organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  IF p_allocation_item_type = 'serialized' THEN
    SELECT CASE WHEN status IN ('available','reserved') THEN 1 ELSE 0 END
      INTO base_available
    FROM public.inventory_items
    WHERE id = p_serialized_item_id
      AND organization_id = p_organization_id
      AND item_kind = 'serialized';

    SELECT COALESCE(SUM(a.allocated_quantity), 0)
      INTO reserved_in_period
    FROM public.inventory_reservation_allocations a
    JOIN public.inventory_reservations r ON r.id = a.reservation_id
    WHERE a.organization_id = p_organization_id
      AND a.serialized_item_id = p_serialized_item_id
      AND a.allocation_status = 'active'
      AND r.status IN ('confirmed','in_preparation','dispatched','in_operation')
      AND (p_ignore_reservation_id IS NULL OR r.id <> p_ignore_reservation_id)
      AND daterange(r.operational_start_date, r.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    RETURN QUERY SELECT
      CASE
        WHEN base_available <= 0 THEN 'unavailable'
        WHEN reserved_in_period >= 1 THEN 'conflict'
        ELSE 'available'
      END,
      GREATEST(base_available - reserved_in_period, 0),
      reserved_in_period,
      CASE WHEN reserved_in_period > 0 THEN 1::bigint ELSE 0::bigint END,
      CASE
        WHEN base_available <= 0 THEN 'Item serializado não está disponível.'
        WHEN reserved_in_period >= 1 THEN 'Item já possui reserva definitiva neste período.'
        ELSE 'Item disponível para reserva definitiva.'
      END;

  ELSIF p_allocation_item_type = 'quantity' THEN
    SELECT COALESCE(quantity_available, 0)
      INTO base_available
    FROM public.inventory_items
    WHERE id = p_quantity_item_id
      AND organization_id = p_organization_id
      AND item_kind = 'quantity';

    SELECT COALESCE(SUM(a.allocated_quantity), 0)
      INTO reserved_in_period
    FROM public.inventory_reservation_allocations a
    JOIN public.inventory_reservations r ON r.id = a.reservation_id
    WHERE a.organization_id = p_organization_id
      AND a.quantity_item_id = p_quantity_item_id
      AND a.allocation_status = 'active'
      AND r.status IN ('confirmed','in_preparation','dispatched','in_operation')
      AND (p_ignore_reservation_id IS NULL OR r.id <> p_ignore_reservation_id)
      AND daterange(r.operational_start_date, r.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    RETURN QUERY SELECT
      CASE
        WHEN GREATEST(base_available - reserved_in_period, 0) >= p_requested_quantity THEN 'available'
        WHEN GREATEST(base_available - reserved_in_period, 0) > 0 THEN 'partial'
        ELSE 'conflict'
      END,
      GREATEST(base_available - reserved_in_period, 0),
      reserved_in_period,
      (
        SELECT COUNT(*)::bigint
        FROM public.inventory_reservation_allocations a
        JOIN public.inventory_reservations r ON r.id = a.reservation_id
        WHERE a.organization_id = p_organization_id
          AND a.quantity_item_id = p_quantity_item_id
          AND a.allocation_status = 'active'
          AND r.status IN ('confirmed','in_preparation','dispatched','in_operation')
          AND (p_ignore_reservation_id IS NULL OR r.id <> p_ignore_reservation_id)
          AND daterange(r.operational_start_date, r.operational_end_date, '[]')
              && daterange(p_start_date, p_end_date, '[]')
      ),
      CASE
        WHEN GREATEST(base_available - reserved_in_period, 0) >= p_requested_quantity
          THEN 'Item disponível para reserva definitiva.'
        WHEN GREATEST(base_available - reserved_in_period, 0) > 0
          THEN 'Disponibilidade parcial para reserva definitiva.'
        ELSE 'Item sem disponibilidade para reserva definitiva.'
      END;
  ELSE
    RETURN QUERY SELECT
      'no_stock_control'::text,
      0::numeric,
      0::numeric,
      0::bigint,
      'Item sem controle de estoque.'::text;
  END IF;
END;
$$;

-- 12) Update check_inventory_availability_for_period to also subtract definitive reservation allocations
CREATE OR REPLACE FUNCTION public.check_inventory_availability_for_period(
  p_organization_id uuid,
  p_inventory_item_type text,
  p_serialized_item_id uuid,
  p_quantity_item_id uuid,
  p_requested_quantity numeric,
  p_start_date date,
  p_end_date date,
  p_ignore_pre_reservation_id uuid DEFAULT NULL
)
RETURNS TABLE (
  availability_status text,
  available_quantity numeric,
  already_pre_reserved_quantity numeric,
  conflict_count bigint,
  message text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  base_available numeric := 0;
  reserved_in_period numeric := 0;
  reservation_blocked numeric := 0;
BEGIN
  IF NOT public.user_can_access_inventory(p_organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Período inválido.';
  END IF;

  IF p_inventory_item_type = 'serialized' THEN
    SELECT CASE WHEN status = 'available' THEN 1 ELSE 0 END
      INTO base_available
    FROM public.inventory_items
    WHERE id = p_serialized_item_id
      AND organization_id = p_organization_id
      AND item_kind = 'serialized';

    SELECT COALESCE(SUM(i.pre_reserved_quantity), 0)
      INTO reserved_in_period
    FROM public.inventory_pre_reservation_items i
    JOIN public.inventory_pre_reservations r ON r.id = i.pre_reservation_id
    WHERE i.organization_id = p_organization_id
      AND i.serialized_item_id = p_serialized_item_id
      AND r.status = 'active'
      AND (p_ignore_pre_reservation_id IS NULL OR r.id <> p_ignore_pre_reservation_id)
      AND daterange(r.operational_start_date, r.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    SELECT COALESCE(SUM(a.allocated_quantity), 0)
      INTO reservation_blocked
    FROM public.inventory_reservation_allocations a
    JOIN public.inventory_reservations rr ON rr.id = a.reservation_id
    WHERE a.organization_id = p_organization_id
      AND a.serialized_item_id = p_serialized_item_id
      AND a.allocation_status = 'active'
      AND rr.status IN ('confirmed','in_preparation','dispatched','in_operation')
      AND daterange(rr.operational_start_date, rr.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    reserved_in_period := reserved_in_period + reservation_blocked;

    RETURN QUERY SELECT
      CASE
        WHEN base_available <= 0 THEN 'unavailable'
        WHEN reserved_in_period >= 1 THEN 'unavailable'
        ELSE 'available'
      END,
      GREATEST(base_available - reserved_in_period, 0),
      reserved_in_period,
      CASE WHEN reserved_in_period > 0 THEN 1::bigint ELSE 0::bigint END,
      CASE
        WHEN base_available <= 0 THEN 'Item serializado não está disponível.'
        WHEN reserved_in_period >= 1 THEN 'Item já está reservado neste período.'
        ELSE 'Item disponível para pré reserva.'
      END;

  ELSIF p_inventory_item_type = 'quantity' THEN
    SELECT COALESCE(quantity_available, 0)
      INTO base_available
    FROM public.inventory_items
    WHERE id = p_quantity_item_id
      AND organization_id = p_organization_id
      AND item_kind = 'quantity';

    SELECT COALESCE(SUM(i.pre_reserved_quantity), 0)
      INTO reserved_in_period
    FROM public.inventory_pre_reservation_items i
    JOIN public.inventory_pre_reservations r ON r.id = i.pre_reservation_id
    WHERE i.organization_id = p_organization_id
      AND i.quantity_item_id = p_quantity_item_id
      AND r.status = 'active'
      AND (p_ignore_pre_reservation_id IS NULL OR r.id <> p_ignore_pre_reservation_id)
      AND daterange(r.operational_start_date, r.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    SELECT COALESCE(SUM(a.allocated_quantity), 0)
      INTO reservation_blocked
    FROM public.inventory_reservation_allocations a
    JOIN public.inventory_reservations rr ON rr.id = a.reservation_id
    WHERE a.organization_id = p_organization_id
      AND a.quantity_item_id = p_quantity_item_id
      AND a.allocation_status = 'active'
      AND rr.status IN ('confirmed','in_preparation','dispatched','in_operation')
      AND daterange(rr.operational_start_date, rr.operational_end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]');

    reserved_in_period := reserved_in_period + reservation_blocked;

    RETURN QUERY SELECT
      CASE
        WHEN GREATEST(base_available - reserved_in_period, 0) >= p_requested_quantity THEN 'available'
        WHEN GREATEST(base_available - reserved_in_period, 0) > 0 THEN 'partial'
        ELSE 'unavailable'
      END,
      GREATEST(base_available - reserved_in_period, 0),
      reserved_in_period,
      CASE WHEN reserved_in_period > 0 THEN 1::bigint ELSE 0::bigint END,
      CASE
        WHEN GREATEST(base_available - reserved_in_period, 0) >= p_requested_quantity
          THEN 'Quantidade disponível para pré reserva.'
        WHEN GREATEST(base_available - reserved_in_period, 0) > 0
          THEN 'Disponibilidade parcial no período.'
        ELSE 'Sem disponibilidade no período.'
      END;
  ELSE
    RETURN QUERY SELECT
      'no_stock_control'::text,
      0::numeric,
      0::numeric,
      0::bigint,
      'Item sem controle de estoque.'::text;
  END IF;
END;
$$;

-- 13) Convert pre-reservation -> definitive reservation
CREATE OR REPLACE FUNCTION public.convert_pre_reservation_to_reservation(
  p_pre_reservation_id uuid,
  p_confirmation_trigger text DEFAULT 'manual'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  pre_record record;
  new_reservation_id uuid;
  item_record record;
  allocation_record record;
  new_reservation_item_id uuid;
  conflict_record record;
  has_conflict boolean := false;
  conflict_messages jsonb := '[]'::jsonb;
BEGIN
  SELECT * INTO pre_record
  FROM public.inventory_pre_reservations
  WHERE id = p_pre_reservation_id;

  IF pre_record.id IS NULL THEN
    RAISE EXCEPTION 'Pré reserva não encontrada.';
  END IF;
  IF NOT public.user_can_access_inventory(pre_record.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF pre_record.status <> 'active' THEN
    RAISE EXCEPTION 'Apenas pré reservas ativas podem ser convertidas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_reservations r
    WHERE r.pre_reservation_id = p_pre_reservation_id
      AND r.status <> 'cancelled'
  ) THEN
    RAISE EXCEPTION 'Esta pré reserva já foi convertida em reserva definitiva.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_pre_reservation_items i
    WHERE i.pre_reservation_id = p_pre_reservation_id
      AND i.inventory_item_type <> 'service_no_stock'
      AND COALESCE(i.allocated_quantity, 0) < COALESCE(i.requested_quantity, 0)
  ) THEN
    RAISE EXCEPTION 'Existem demandas não alocadas ou parcialmente alocadas. Conclua a alocação antes de converter.';
  END IF;

  -- Conflict check across active definitive reservations
  FOR allocation_record IN
    SELECT a.*
    FROM public.inventory_pre_reservation_allocations a
    WHERE a.pre_reservation_id = p_pre_reservation_id
      AND a.allocation_status = 'active'
  LOOP
    SELECT * INTO conflict_record
    FROM public.check_inventory_reservation_conflict(
      allocation_record.organization_id,
      allocation_record.allocation_item_type,
      allocation_record.serialized_item_id,
      allocation_record.quantity_item_id,
      allocation_record.allocated_quantity,
      pre_record.operational_start_date,
      pre_record.operational_end_date,
      NULL
    ) LIMIT 1;
    IF conflict_record.conflict_status IN ('conflict','unavailable') THEN
      has_conflict := true;
      conflict_messages := conflict_messages || jsonb_build_array(
        jsonb_build_object(
          'allocation_id', allocation_record.id,
          'item_type', allocation_record.allocation_item_type,
          'serialized_item_id', allocation_record.serialized_item_id,
          'quantity_item_id', allocation_record.quantity_item_id,
          'message', conflict_record.message
        )
      );
    END IF;
  END LOOP;

  IF has_conflict THEN
    RETURN jsonb_build_object(
      'success', false,
      'reason', 'reservation_conflict',
      'message', 'Existem conflitos com reservas definitivas no mesmo período.',
      'conflicts', conflict_messages
    );
  END IF;

  INSERT INTO public.inventory_reservations (
    organization_id, pre_reservation_id, proposal_id, opportunity_id,
    account_id, contact_id, title, source,
    operational_start_date, operational_end_date, event_start_date, event_end_date,
    status, risk_level, confirmation_trigger, confirmed_at, confirmed_by, notes, created_by
  )
  VALUES (
    pre_record.organization_id, pre_record.id, pre_record.proposal_id, pre_record.opportunity_id,
    pre_record.account_id, pre_record.contact_id, pre_record.title, 'pre_reservation',
    pre_record.operational_start_date, pre_record.operational_end_date,
    pre_record.event_start_date, pre_record.event_end_date,
    'confirmed', pre_record.risk_level, p_confirmation_trigger, now(), auth.uid(),
    pre_record.notes, auth.uid()
  )
  RETURNING id INTO new_reservation_id;

  FOR item_record IN
    SELECT * FROM public.inventory_pre_reservation_items
    WHERE pre_reservation_id = p_pre_reservation_id
  LOOP
    INSERT INTO public.inventory_reservation_items (
      organization_id, reservation_id, source_pre_reservation_item_id,
      inventory_item_type, serialized_item_id, quantity_item_id,
      category_id, family_id, requested_quantity, reserved_quantity,
      demand_label, demand_source, reservation_status, conflict_reason, notes
    )
    VALUES (
      item_record.organization_id, new_reservation_id, item_record.id,
      item_record.inventory_item_type, item_record.serialized_item_id, item_record.quantity_item_id,
      item_record.category_id, item_record.family_id,
      item_record.requested_quantity, COALESCE(item_record.allocated_quantity, 0),
      item_record.demand_label, COALESCE(item_record.demand_source, 'pre_reservation'),
      CASE
        WHEN item_record.inventory_item_type = 'service_no_stock' THEN 'no_stock_control'
        WHEN COALESCE(item_record.allocated_quantity, 0) >= COALESCE(item_record.requested_quantity, 0) THEN 'reserved'
        WHEN COALESCE(item_record.allocated_quantity, 0) > 0 THEN 'partial'
        ELSE 'unavailable'
      END,
      item_record.conflict_reason, item_record.notes
    )
    RETURNING id INTO new_reservation_item_id;

    FOR allocation_record IN
      SELECT * FROM public.inventory_pre_reservation_allocations
      WHERE pre_reservation_item_id = item_record.id
        AND allocation_status = 'active'
    LOOP
      INSERT INTO public.inventory_reservation_allocations (
        organization_id, reservation_id, reservation_item_id,
        source_pre_reservation_allocation_id, allocation_item_type,
        serialized_item_id, quantity_item_id, allocated_quantity,
        allocation_status, notes, created_by
      )
      VALUES (
        allocation_record.organization_id, new_reservation_id, new_reservation_item_id,
        allocation_record.id, allocation_record.allocation_item_type,
        allocation_record.serialized_item_id, allocation_record.quantity_item_id,
        allocation_record.allocated_quantity, 'active', allocation_record.notes, auth.uid()
      );
    END LOOP;
  END LOOP;

  UPDATE public.inventory_pre_reservations
  SET status = 'converted', updated_at = now()
  WHERE id = p_pre_reservation_id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', new_reservation_id,
    'pre_reservation_id', p_pre_reservation_id,
    'message', 'Pré reserva convertida em reserva definitiva.'
  );
END;
$$;

-- 14) Overview RPC
CREATE OR REPLACE FUNCTION public.get_inventory_reservations_overview()
RETURNS TABLE (
  active_reservations bigint,
  reserved_items bigint,
  reservations_in_preparation bigint,
  reservations_dispatched bigint,
  reservations_in_operation bigint,
  next_operational_start date
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(DISTINCT r.id) FILTER (
      WHERE r.status IN ('confirmed','in_preparation','dispatched','in_operation')
    )::bigint AS active_reservations,
    COUNT(a.id) FILTER (
      WHERE r.status IN ('confirmed','in_preparation','dispatched','in_operation')
        AND a.allocation_status = 'active'
    )::bigint AS reserved_items,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'in_preparation')::bigint AS reservations_in_preparation,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'dispatched')::bigint AS reservations_dispatched,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'in_operation')::bigint AS reservations_in_operation,
    MIN(r.operational_start_date) FILTER (
      WHERE r.status IN ('confirmed','in_preparation','dispatched','in_operation')
        AND r.operational_start_date >= CURRENT_DATE
    ) AS next_operational_start
  FROM public.inventory_reservations r
  LEFT JOIN public.inventory_reservation_allocations a ON a.reservation_id = r.id
  WHERE public.user_can_access_inventory(r.organization_id);
$$;