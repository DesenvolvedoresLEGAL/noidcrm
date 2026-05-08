-- ============================================================================
-- Sprint INV 0.9 — Pré reservas operacionais
-- ============================================================================

-- Tabela cabeçalho
CREATE TABLE IF NOT EXISTS public.inventory_pre_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  proposal_id uuid,
  opportunity_id uuid,
  account_id uuid,
  contact_id uuid,
  reservation_code text NOT NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'proposal',
  operational_start_date date NOT NULL,
  operational_end_date date NOT NULL,
  event_start_date date,
  event_end_date date,
  status text NOT NULL DEFAULT 'active',
  risk_level text NOT NULL DEFAULT 'low',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_pre_reservations_status_check
    CHECK (status IN ('draft','active','expired','cancelled','converted')),
  CONSTRAINT inventory_pre_reservations_risk_level_check
    CHECK (risk_level IN ('low','medium','high','critical')),
  CONSTRAINT inventory_pre_reservations_source_check
    CHECK (source IN ('proposal','manual','import','agent')),
  CONSTRAINT inventory_pre_reservations_date_check
    CHECK (operational_end_date >= operational_start_date),
  CONSTRAINT inventory_pre_reservations_org_code_unique
    UNIQUE (organization_id, reservation_code)
);

-- Tabela itens
CREATE TABLE IF NOT EXISTS public.inventory_pre_reservation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pre_reservation_id uuid NOT NULL REFERENCES public.inventory_pre_reservations(id) ON DELETE CASCADE,
  inventory_item_type text NOT NULL,
  serialized_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  quantity_item_id uuid REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.inventory_categories(id),
  family_id uuid REFERENCES public.inventory_families(id),
  requested_quantity numeric NOT NULL DEFAULT 1,
  pre_reserved_quantity numeric NOT NULL DEFAULT 0,
  availability_status text NOT NULL DEFAULT 'pending',
  conflict_reason text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inv_prer_items_type_check
    CHECK (inventory_item_type IN ('serialized','quantity','sku','service_no_stock')),
  CONSTRAINT inv_prer_items_availability_check
    CHECK (availability_status IN ('pending','available','partial','unavailable','no_stock_control')),
  CONSTRAINT inv_prer_items_quantity_check
    CHECK (requested_quantity >= 0 AND pre_reserved_quantity >= 0),
  CONSTRAINT inv_prer_items_reference_check
    CHECK (
      (inventory_item_type = 'serialized' AND serialized_item_id IS NOT NULL AND quantity_item_id IS NULL)
      OR (inventory_item_type = 'quantity' AND quantity_item_id IS NOT NULL AND serialized_item_id IS NULL)
      OR (inventory_item_type IN ('sku','service_no_stock'))
    )
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_inv_prer_org_status
  ON public.inventory_pre_reservations (organization_id, status);
CREATE INDEX IF NOT EXISTS idx_inv_prer_proposal
  ON public.inventory_pre_reservations (organization_id, proposal_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_period
  ON public.inventory_pre_reservations (organization_id, operational_start_date, operational_end_date);
CREATE INDEX IF NOT EXISTS idx_inv_prer_items_reservation
  ON public.inventory_pre_reservation_items (organization_id, pre_reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_items_serialized
  ON public.inventory_pre_reservation_items (organization_id, serialized_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_items_quantity
  ON public.inventory_pre_reservation_items (organization_id, quantity_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_items_availability
  ON public.inventory_pre_reservation_items (organization_id, availability_status);

-- RLS
ALTER TABLE public.inventory_pre_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_pre_reservation_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View pre reservations from org"
  ON public.inventory_pre_reservations FOR SELECT
  USING (public.user_can_access_inventory(organization_id));
CREATE POLICY "Create pre reservations from org"
  ON public.inventory_pre_reservations FOR INSERT
  WITH CHECK (public.user_can_access_inventory(organization_id));
CREATE POLICY "Update pre reservations from org"
  ON public.inventory_pre_reservations FOR UPDATE
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));
CREATE POLICY "Admins delete pre reservations"
  ON public.inventory_pre_reservations FOR DELETE
  USING (public.user_is_org_admin(organization_id));

CREATE POLICY "View pre reservation items from org"
  ON public.inventory_pre_reservation_items FOR SELECT
  USING (public.user_can_access_inventory(organization_id));
CREATE POLICY "Manage pre reservation items from org"
  ON public.inventory_pre_reservation_items FOR ALL
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_inventory_pre_reservation_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_inv_prer_updated_at
  BEFORE UPDATE ON public.inventory_pre_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_pre_reservation_updated_at();

CREATE TRIGGER trg_inv_prer_items_updated_at
  BEFORE UPDATE ON public.inventory_pre_reservation_items
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_pre_reservation_updated_at();

-- Code generator
CREATE OR REPLACE FUNCTION public.generate_inventory_pre_reservation_code(org_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  next_number integer;
BEGIN
  SELECT COUNT(*) + 1 INTO next_number
  FROM public.inventory_pre_reservations
  WHERE organization_id = org_id;
  RETURN 'PRERES-' || to_char(now(), 'YYYY') || '-' || lpad(next_number::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.set_inventory_pre_reservation_code()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.reservation_code IS NULL OR trim(NEW.reservation_code) = '' THEN
    NEW.reservation_code := public.generate_inventory_pre_reservation_code(NEW.organization_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_set_inv_prer_code
  BEFORE INSERT ON public.inventory_pre_reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_pre_reservation_code();

-- Validate org consistency on items
CREATE OR REPLACE FUNCTION public.validate_pre_reservation_item_org()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  parent_org_id uuid;
BEGIN
  SELECT organization_id INTO parent_org_id
  FROM public.inventory_pre_reservations
  WHERE id = NEW.pre_reservation_id;
  IF parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Pré reserva não encontrada.';
  END IF;
  IF NEW.organization_id <> parent_org_id THEN
    RAISE EXCEPTION 'Item da pré reserva pertence a outra organização.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_pre_reservation_item_org
  BEFORE INSERT OR UPDATE ON public.inventory_pre_reservation_items
  FOR EACH ROW EXECUTE FUNCTION public.validate_pre_reservation_item_org();

-- RPC: check availability in period
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
        WHEN reserved_in_period >= 1 THEN 'Item já está pré reservado neste período.'
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

    RETURN QUERY SELECT
      CASE
        WHEN GREATEST(base_available - reserved_in_period, 0) >= p_requested_quantity THEN 'available'
        WHEN GREATEST(base_available - reserved_in_period, 0) > 0 THEN 'partial'
        ELSE 'unavailable'
      END,
      GREATEST(base_available - reserved_in_period, 0),
      reserved_in_period,
      (
        SELECT COUNT(*)::bigint
        FROM public.inventory_pre_reservation_items i
        JOIN public.inventory_pre_reservations r ON r.id = i.pre_reservation_id
        WHERE i.organization_id = p_organization_id
          AND i.quantity_item_id = p_quantity_item_id
          AND r.status = 'active'
          AND (p_ignore_pre_reservation_id IS NULL OR r.id <> p_ignore_pre_reservation_id)
          AND daterange(r.operational_start_date, r.operational_end_date, '[]')
              && daterange(p_start_date, p_end_date, '[]')
      ),
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

-- RPC: recalculate
CREATE OR REPLACE FUNCTION public.recalculate_inventory_pre_reservation_status(
  p_pre_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reservation_record record;
  item_record record;
  availability_record record;
  total_items integer := 0;
  unavailable_items integer := 0;
  partial_items integer := 0;
  available_items integer := 0;
  no_stock_items integer := 0;
  new_risk_level text := 'low';
BEGIN
  SELECT * INTO reservation_record
  FROM public.inventory_pre_reservations
  WHERE id = p_pre_reservation_id;

  IF reservation_record.id IS NULL THEN
    RAISE EXCEPTION 'Pré reserva não encontrada.';
  END IF;
  IF NOT public.user_can_access_inventory(reservation_record.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  FOR item_record IN
    SELECT * FROM public.inventory_pre_reservation_items
    WHERE pre_reservation_id = p_pre_reservation_id
  LOOP
    total_items := total_items + 1;

    SELECT * INTO availability_record
    FROM public.check_inventory_availability_for_period(
      item_record.organization_id,
      item_record.inventory_item_type,
      item_record.serialized_item_id,
      item_record.quantity_item_id,
      item_record.requested_quantity,
      reservation_record.operational_start_date,
      reservation_record.operational_end_date,
      p_pre_reservation_id
    ) LIMIT 1;

    UPDATE public.inventory_pre_reservation_items
    SET availability_status = availability_record.availability_status,
        pre_reserved_quantity = CASE
          WHEN availability_record.availability_status = 'available' THEN item_record.requested_quantity
          WHEN availability_record.availability_status = 'partial' THEN availability_record.available_quantity
          ELSE 0
        END,
        conflict_reason = CASE
          WHEN availability_record.availability_status IN ('partial','unavailable')
            THEN availability_record.message
          ELSE NULL
        END,
        updated_at = now()
    WHERE id = item_record.id;

    IF availability_record.availability_status = 'available' THEN
      available_items := available_items + 1;
    ELSIF availability_record.availability_status = 'partial' THEN
      partial_items := partial_items + 1;
    ELSIF availability_record.availability_status = 'unavailable' THEN
      unavailable_items := unavailable_items + 1;
    ELSIF availability_record.availability_status = 'no_stock_control' THEN
      no_stock_items := no_stock_items + 1;
    END IF;
  END LOOP;

  IF unavailable_items > 0 THEN
    new_risk_level := 'critical';
  ELSIF partial_items > 0 THEN
    new_risk_level := 'high';
  ELSIF total_items > 0 AND available_items = total_items THEN
    new_risk_level := 'low';
  ELSE
    new_risk_level := 'medium';
  END IF;

  UPDATE public.inventory_pre_reservations
  SET risk_level = new_risk_level, updated_at = now()
  WHERE id = p_pre_reservation_id;

  RETURN jsonb_build_object(
    'pre_reservation_id', p_pre_reservation_id,
    'total_items', total_items,
    'available_items', available_items,
    'partial_items', partial_items,
    'unavailable_items', unavailable_items,
    'no_stock_items', no_stock_items,
    'risk_level', new_risk_level
  );
END;
$$;

-- RPC: overview
CREATE OR REPLACE FUNCTION public.get_inventory_pre_reservations_overview()
RETURNS TABLE (
  active_pre_reservations bigint,
  pre_reserved_items bigint,
  availability_conflicts bigint,
  critical_risk_reservations bigint,
  next_operational_start date
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'active')::bigint,
    COUNT(i.id) FILTER (WHERE r.status = 'active')::bigint,
    COUNT(i.id) FILTER (
      WHERE r.status = 'active'
        AND i.availability_status IN ('partial','unavailable')
    )::bigint,
    COUNT(DISTINCT r.id) FILTER (
      WHERE r.status = 'active'
        AND r.risk_level IN ('high','critical')
    )::bigint,
    MIN(r.operational_start_date) FILTER (
      WHERE r.status = 'active'
        AND r.operational_start_date >= current_date
    )
  FROM public.inventory_pre_reservations r
  LEFT JOIN public.inventory_pre_reservation_items i ON i.pre_reservation_id = r.id
  WHERE public.user_can_access_inventory(r.organization_id);
$$;

-- RPC: per-item summary
CREATE OR REPLACE FUNCTION public.get_inventory_item_pre_reservation_summary(
  p_inventory_item_type text,
  p_serialized_item_id uuid DEFAULT NULL,
  p_quantity_item_id uuid DEFAULT NULL
)
RETURNS TABLE (
  active_pre_reservations bigint,
  pre_reserved_quantity numeric,
  next_reserved_until date
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    COUNT(DISTINCT r.id)::bigint,
    COALESCE(SUM(i.pre_reserved_quantity), 0)::numeric,
    MAX(r.operational_end_date)
  FROM public.inventory_pre_reservation_items i
  JOIN public.inventory_pre_reservations r ON r.id = i.pre_reservation_id
  WHERE r.status = 'active'
    AND public.user_can_access_inventory(i.organization_id)
    AND (
      (p_inventory_item_type = 'serialized' AND i.serialized_item_id = p_serialized_item_id)
      OR
      (p_inventory_item_type = 'quantity' AND i.quantity_item_id = p_quantity_item_id)
    );
$$;

-- ============================================================================
-- Products extension
-- ============================================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_control_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS default_inventory_item_type text,
  ADD COLUMN IF NOT EXISTS default_serialized_item_id uuid,
  ADD COLUMN IF NOT EXISTS default_quantity_item_id uuid,
  ADD COLUMN IF NOT EXISTS default_inventory_category_id uuid,
  ADD COLUMN IF NOT EXISTS default_inventory_family_id uuid,
  ADD COLUMN IF NOT EXISTS inventory_quantity_multiplier numeric NOT NULL DEFAULT 1;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_inventory_control_mode_check'
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_inventory_control_mode_check
      CHECK (inventory_control_mode IN ('none','direct_quantity_item','direct_serialized_item','category_family_demand'));
  END IF;
END $$;