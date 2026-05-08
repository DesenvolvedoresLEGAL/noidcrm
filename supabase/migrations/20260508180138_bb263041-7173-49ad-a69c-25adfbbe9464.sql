
-- ============================================================================
-- Sprint INV 1.0 — Alocação inteligente de estoque por demanda operacional
-- ============================================================================

-- 1) Extender tipos válidos de inventory_pre_reservation_items para suportar
--    'category_family_demand' (demanda por categoria/família sem item físico).
ALTER TABLE public.inventory_pre_reservation_items
  DROP CONSTRAINT IF EXISTS inv_prer_items_type_check;

ALTER TABLE public.inventory_pre_reservation_items
  ADD CONSTRAINT inv_prer_items_type_check
  CHECK (inventory_item_type IN (
    'serialized','quantity','sku','service_no_stock','category_family_demand'
  ));

-- Atualizar a constraint de referência para permitir demandas categóricas
ALTER TABLE public.inventory_pre_reservation_items
  DROP CONSTRAINT IF EXISTS inv_prer_items_reference_check;

ALTER TABLE public.inventory_pre_reservation_items
  ADD CONSTRAINT inv_prer_items_reference_check
  CHECK (
    (inventory_item_type = 'serialized'
       AND serialized_item_id IS NOT NULL AND quantity_item_id IS NULL)
    OR (inventory_item_type = 'quantity'
       AND quantity_item_id IS NOT NULL AND serialized_item_id IS NULL)
    OR (inventory_item_type IN ('sku','service_no_stock','category_family_demand'))
  );

-- 2) Novas colunas em inventory_pre_reservation_items
ALTER TABLE public.inventory_pre_reservation_items
  ADD COLUMN IF NOT EXISTS allocation_status text NOT NULL DEFAULT 'unallocated',
  ADD COLUMN IF NOT EXISTS allocated_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS demand_label text,
  ADD COLUMN IF NOT EXISTS demand_source text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS product_id uuid,
  ADD COLUMN IF NOT EXISTS proposal_item_id uuid;

ALTER TABLE public.inventory_pre_reservation_items
  DROP CONSTRAINT IF EXISTS inv_prer_items_allocation_status_check;
ALTER TABLE public.inventory_pre_reservation_items
  ADD CONSTRAINT inv_prer_items_allocation_status_check
  CHECK (allocation_status IN (
    'unallocated','partially_allocated','allocated','over_allocated','not_required'
  ));

ALTER TABLE public.inventory_pre_reservation_items
  DROP CONSTRAINT IF EXISTS inv_prer_items_demand_source_check;
ALTER TABLE public.inventory_pre_reservation_items
  ADD CONSTRAINT inv_prer_items_demand_source_check
  CHECK (demand_source IN ('proposal_item','product_rule','manual','agent'));

CREATE INDEX IF NOT EXISTS idx_inv_prer_items_allocation_status
  ON public.inventory_pre_reservation_items (organization_id, allocation_status);

-- 3) Produtos: regras de demanda (kits lógicos)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS inventory_demand_rules jsonb NOT NULL DEFAULT '[]'::jsonb;

-- 4) Tabela de alocações
CREATE TABLE IF NOT EXISTS public.inventory_pre_reservation_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  pre_reservation_id uuid NOT NULL REFERENCES public.inventory_pre_reservations(id) ON DELETE CASCADE,
  pre_reservation_item_id uuid NOT NULL REFERENCES public.inventory_pre_reservation_items(id) ON DELETE CASCADE,
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
  CONSTRAINT inv_prer_alloc_type_check
    CHECK (allocation_item_type IN ('serialized','quantity')),
  CONSTRAINT inv_prer_alloc_status_check
    CHECK (allocation_status IN ('active','cancelled','replaced')),
  CONSTRAINT inv_prer_alloc_quantity_check
    CHECK (allocated_quantity > 0),
  CONSTRAINT inv_prer_alloc_reference_check
    CHECK (
      (allocation_item_type = 'serialized'
         AND serialized_item_id IS NOT NULL AND quantity_item_id IS NULL)
      OR
      (allocation_item_type = 'quantity'
         AND quantity_item_id IS NOT NULL AND serialized_item_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_org
  ON public.inventory_pre_reservation_allocations (organization_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_reservation
  ON public.inventory_pre_reservation_allocations (organization_id, pre_reservation_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_item
  ON public.inventory_pre_reservation_allocations (organization_id, pre_reservation_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_serialized
  ON public.inventory_pre_reservation_allocations (organization_id, serialized_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_quantity
  ON public.inventory_pre_reservation_allocations (organization_id, quantity_item_id);
CREATE INDEX IF NOT EXISTS idx_inv_prer_alloc_status
  ON public.inventory_pre_reservation_allocations (organization_id, allocation_status);

-- 5) RLS
ALTER TABLE public.inventory_pre_reservation_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View pre reservation allocations from org"
  ON public.inventory_pre_reservation_allocations;
CREATE POLICY "View pre reservation allocations from org"
  ON public.inventory_pre_reservation_allocations FOR SELECT
  USING (public.user_can_access_inventory(organization_id));

DROP POLICY IF EXISTS "Manage pre reservation allocations from org"
  ON public.inventory_pre_reservation_allocations;
CREATE POLICY "Manage pre reservation allocations from org"
  ON public.inventory_pre_reservation_allocations FOR ALL
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

-- 6) updated_at trigger reuse
CREATE TRIGGER trg_inv_prer_alloc_updated_at
  BEFORE UPDATE ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.set_inventory_pre_reservation_updated_at();

-- 7) Validação de organização da alocação x demanda
CREATE OR REPLACE FUNCTION public.validate_pre_reservation_allocation_org()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  parent_org_id uuid;
  parent_reservation_id uuid;
BEGIN
  SELECT organization_id, pre_reservation_id
    INTO parent_org_id, parent_reservation_id
  FROM public.inventory_pre_reservation_items
  WHERE id = NEW.pre_reservation_item_id;

  IF parent_org_id IS NULL THEN
    RAISE EXCEPTION 'Demanda de pré reserva não encontrada.';
  END IF;
  IF NEW.organization_id <> parent_org_id THEN
    RAISE EXCEPTION 'Alocação pertence a outra organização.';
  END IF;
  IF NEW.pre_reservation_id <> parent_reservation_id THEN
    RAISE EXCEPTION 'Alocação não pertence à mesma pré reserva da demanda.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_pre_reservation_allocation_org
  ON public.inventory_pre_reservation_allocations;
CREATE TRIGGER trg_validate_pre_reservation_allocation_org
  BEFORE INSERT OR UPDATE ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_pre_reservation_allocation_org();

-- 8) Validação de item alocado (org + kind)
CREATE OR REPLACE FUNCTION public.validate_pre_reservation_allocation_inventory_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
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

DROP TRIGGER IF EXISTS trg_validate_pre_reservation_allocation_inventory_item
  ON public.inventory_pre_reservation_allocations;
CREATE TRIGGER trg_validate_pre_reservation_allocation_inventory_item
  BEFORE INSERT OR UPDATE ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.validate_pre_reservation_allocation_inventory_item();

-- 9) RPC: recalcular alocação de uma demanda
CREATE OR REPLACE FUNCTION public.recalculate_pre_reservation_item_allocation(
  p_pre_reservation_item_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demand_record record;
  total_allocated numeric := 0;
  new_status text := 'unallocated';
BEGIN
  SELECT * INTO demand_record
  FROM public.inventory_pre_reservation_items
  WHERE id = p_pre_reservation_item_id;

  IF demand_record.id IS NULL THEN
    RAISE EXCEPTION 'Demanda de pré reserva não encontrada.';
  END IF;

  SELECT COALESCE(SUM(allocated_quantity), 0)
    INTO total_allocated
  FROM public.inventory_pre_reservation_allocations
  WHERE pre_reservation_item_id = p_pre_reservation_item_id
    AND allocation_status = 'active';

  IF demand_record.inventory_item_type = 'service_no_stock' THEN
    new_status := 'not_required';
  ELSIF total_allocated = 0 THEN
    new_status := 'unallocated';
  ELSIF total_allocated < demand_record.requested_quantity THEN
    new_status := 'partially_allocated';
  ELSIF total_allocated = demand_record.requested_quantity THEN
    new_status := 'allocated';
  ELSE
    new_status := 'over_allocated';
  END IF;

  UPDATE public.inventory_pre_reservation_items
     SET allocated_quantity = total_allocated,
         allocation_status = new_status,
         pre_reserved_quantity = total_allocated,
         availability_status = CASE
           WHEN new_status = 'allocated' THEN 'available'
           WHEN new_status = 'partially_allocated' THEN 'partial'
           WHEN new_status = 'not_required' THEN 'no_stock_control'
           ELSE 'pending'
         END,
         updated_at = now()
   WHERE id = p_pre_reservation_item_id;

  RETURN jsonb_build_object(
    'pre_reservation_item_id', p_pre_reservation_item_id,
    'requested_quantity', demand_record.requested_quantity,
    'allocated_quantity', total_allocated,
    'allocation_status', new_status
  );
END;
$$;

-- 10) Trigger para recálculo após alteração na alocação
CREATE OR REPLACE FUNCTION public.recalculate_allocation_after_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_item_id uuid;
BEGIN
  target_item_id := COALESCE(NEW.pre_reservation_item_id, OLD.pre_reservation_item_id);
  PERFORM public.recalculate_pre_reservation_item_allocation(target_item_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recalc_alloc_after_insert ON public.inventory_pre_reservation_allocations;
DROP TRIGGER IF EXISTS trg_recalc_alloc_after_update ON public.inventory_pre_reservation_allocations;
DROP TRIGGER IF EXISTS trg_recalc_alloc_after_delete ON public.inventory_pre_reservation_allocations;

CREATE TRIGGER trg_recalc_alloc_after_insert
  AFTER INSERT ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_allocation_after_change();
CREATE TRIGGER trg_recalc_alloc_after_update
  AFTER UPDATE ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_allocation_after_change();
CREATE TRIGGER trg_recalc_alloc_after_delete
  AFTER DELETE ON public.inventory_pre_reservation_allocations
  FOR EACH ROW EXECUTE FUNCTION public.recalculate_allocation_after_change();

-- 11) RPC: candidatos para alocação
CREATE OR REPLACE FUNCTION public.find_inventory_allocation_candidates(
  p_pre_reservation_item_id uuid
)
RETURNS TABLE (
  candidate_type text,
  candidate_id uuid,
  candidate_name text,
  candidate_code text,
  category_id uuid,
  category_name text,
  family_id uuid,
  family_name text,
  available_quantity numeric,
  already_pre_reserved_quantity numeric,
  status text,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demand_record record;
  reservation_record record;
BEGIN
  SELECT * INTO demand_record
  FROM public.inventory_pre_reservation_items
  WHERE id = p_pre_reservation_item_id;

  IF demand_record.id IS NULL THEN
    RAISE EXCEPTION 'Demanda de pré reserva não encontrada.';
  END IF;
  IF NOT public.user_can_access_inventory(demand_record.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  SELECT * INTO reservation_record
  FROM public.inventory_pre_reservations
  WHERE id = demand_record.pre_reservation_id;
  IF reservation_record.id IS NULL THEN
    RAISE EXCEPTION 'Pré reserva não encontrada.';
  END IF;

  RETURN QUERY
  WITH serialized_candidates AS (
    SELECT
      'serialized'::text AS candidate_type,
      s.id AS candidate_id,
      COALESCE(s.name, s.serial_number, 'Item serializado')::text AS candidate_name,
      COALESCE(s.asset_code, s.serial_number, '')::text AS candidate_code,
      s.category_id,
      c.name AS category_name,
      s.family_id,
      f.name AS family_name,
      av.available_quantity,
      av.already_pre_reserved_quantity,
      av.availability_status AS status,
      av.message
    FROM public.inventory_items s
    LEFT JOIN public.inventory_categories c ON c.id = s.category_id
    LEFT JOIN public.inventory_families f ON f.id = s.family_id
    CROSS JOIN LATERAL public.check_inventory_availability_for_period(
      demand_record.organization_id,
      'serialized',
      s.id,
      NULL,
      1,
      reservation_record.operational_start_date,
      reservation_record.operational_end_date,
      reservation_record.id
    ) av
    WHERE s.organization_id = demand_record.organization_id
      AND s.item_kind = 'serialized'
      AND s.status = 'available'
      AND (demand_record.category_id IS NULL OR s.category_id = demand_record.category_id)
      AND (demand_record.family_id  IS NULL OR s.family_id  = demand_record.family_id)
  ),
  quantity_candidates AS (
    SELECT
      'quantity'::text AS candidate_type,
      q.id AS candidate_id,
      q.name::text AS candidate_name,
      COALESCE(q.asset_code, '')::text AS candidate_code,
      q.category_id,
      c.name AS category_name,
      q.family_id,
      f.name AS family_name,
      av.available_quantity,
      av.already_pre_reserved_quantity,
      av.availability_status AS status,
      av.message
    FROM public.inventory_items q
    LEFT JOIN public.inventory_categories c ON c.id = q.category_id
    LEFT JOIN public.inventory_families f ON f.id = q.family_id
    CROSS JOIN LATERAL public.check_inventory_availability_for_period(
      demand_record.organization_id,
      'quantity',
      NULL,
      q.id,
      GREATEST(demand_record.requested_quantity - demand_record.allocated_quantity, 1),
      reservation_record.operational_start_date,
      reservation_record.operational_end_date,
      reservation_record.id
    ) av
    WHERE q.organization_id = demand_record.organization_id
      AND q.item_kind = 'quantity'
      AND (demand_record.category_id IS NULL OR q.category_id = demand_record.category_id)
      AND (demand_record.family_id  IS NULL OR q.family_id  = demand_record.family_id)
  )
  SELECT * FROM serialized_candidates
  UNION ALL
  SELECT * FROM quantity_candidates
  ORDER BY
    CASE status WHEN 'available' THEN 1 WHEN 'partial' THEN 2 ELSE 3 END,
    available_quantity DESC NULLS LAST,
    candidate_name ASC;
END;
$$;

-- 12) Atualizar recalculate_inventory_pre_reservation_status para usar alocação
--     - Para demandas serialized/quantity: comportamento existente baseado em check_inventory_availability_for_period
--     - Para category_family_demand: status baseado em allocation_status
--     - Risco: critical se houver crítico/insuficiente; high se parcial; medium se pendente; low se tudo ok.
CREATE OR REPLACE FUNCTION public.recalculate_inventory_pre_reservation_status(
  p_pre_reservation_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reservation_record record;
  item_record record;
  availability_record record;
  total_items integer := 0;
  unavailable_items integer := 0;
  partial_items integer := 0;
  available_items integer := 0;
  no_stock_items integer := 0;
  pending_items integer := 0;
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

    IF item_record.inventory_item_type IN ('serialized','quantity') THEN
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
    ELSIF item_record.inventory_item_type = 'category_family_demand' THEN
      -- Recalcula com base nas alocações existentes
      PERFORM public.recalculate_pre_reservation_item_allocation(item_record.id);
      IF item_record.allocation_status = 'allocated' OR
         (SELECT allocation_status FROM public.inventory_pre_reservation_items WHERE id = item_record.id) = 'allocated' THEN
        available_items := available_items + 1;
      ELSIF (SELECT allocation_status FROM public.inventory_pre_reservation_items WHERE id = item_record.id) = 'partially_allocated' THEN
        partial_items := partial_items + 1;
      ELSE
        pending_items := pending_items + 1;
      END IF;
    ELSE
      no_stock_items := no_stock_items + 1;
      UPDATE public.inventory_pre_reservation_items
         SET availability_status = 'no_stock_control', updated_at = now()
       WHERE id = item_record.id;
    END IF;
  END LOOP;

  IF unavailable_items > 0 THEN
    new_risk_level := 'critical';
  ELSIF partial_items > 0 THEN
    new_risk_level := 'high';
  ELSIF pending_items > 0 THEN
    new_risk_level := 'medium';
  ELSIF total_items > 0 AND (available_items + no_stock_items) = total_items THEN
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
    'pending_items', pending_items,
    'no_stock_items', no_stock_items,
    'risk_level', new_risk_level
  );
END;
$$;

-- 13) Listar alocações de uma demanda com nomes do item
CREATE OR REPLACE FUNCTION public.list_pre_reservation_item_allocations(
  p_pre_reservation_item_id uuid
)
RETURNS TABLE (
  id uuid,
  allocation_item_type text,
  serialized_item_id uuid,
  quantity_item_id uuid,
  inventory_item_name text,
  inventory_item_code text,
  allocated_quantity numeric,
  allocation_status text,
  notes text,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.id,
    a.allocation_item_type,
    a.serialized_item_id,
    a.quantity_item_id,
    COALESCE(s.name, q.name)::text AS inventory_item_name,
    COALESCE(s.asset_code, s.serial_number, q.asset_code, '')::text AS inventory_item_code,
    a.allocated_quantity,
    a.allocation_status,
    a.notes,
    a.created_at
  FROM public.inventory_pre_reservation_allocations a
  LEFT JOIN public.inventory_items s ON s.id = a.serialized_item_id
  LEFT JOIN public.inventory_items q ON q.id = a.quantity_item_id
  WHERE a.pre_reservation_item_id = p_pre_reservation_item_id
    AND public.user_can_access_inventory(a.organization_id)
  ORDER BY a.created_at ASC;
$$;
