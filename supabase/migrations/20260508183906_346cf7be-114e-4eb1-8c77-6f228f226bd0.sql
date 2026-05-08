-- INV 1.2 step 2: operational columns, events table, RPCs.

-- 1. Allocation operational columns
ALTER TABLE public.inventory_reservation_allocations
  ADD COLUMN IF NOT EXISTS operational_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS prepared_at timestamptz,
  ADD COLUMN IF NOT EXISTS prepared_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS in_operation_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz,
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS released_at timestamptz,
  ADD COLUMN IF NOT EXISTS released_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS return_condition text,
  ADD COLUMN IF NOT EXISTS return_notes text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inv_res_alloc_operational_status_check') THEN
    ALTER TABLE public.inventory_reservation_allocations
      ADD CONSTRAINT inv_res_alloc_operational_status_check
      CHECK (operational_status IN (
        'pending','prepared','dispatched','in_operation',
        'returned','released','damaged','lost','maintenance','cancelled'
      ));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inv_res_alloc_return_condition_check') THEN
    ALTER TABLE public.inventory_reservation_allocations
      ADD CONSTRAINT inv_res_alloc_return_condition_check
      CHECK (return_condition IS NULL OR return_condition IN ('ok','damaged','lost','maintenance_required'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_inv_res_alloc_operational_status
  ON public.inventory_reservation_allocations (organization_id, operational_status);

-- 2. Operational quantity buckets on inventory_items (only meaningful for quantity kind)
ALTER TABLE public.inventory_items
  ADD COLUMN IF NOT EXISTS reserved_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_preparation_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dispatched_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS in_operation_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS returned_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS maintenance_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS damaged_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS lost_quantity numeric NOT NULL DEFAULT 0;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inventory_items_operational_quantities_check') THEN
    ALTER TABLE public.inventory_items
      ADD CONSTRAINT inventory_items_operational_quantities_check
      CHECK (
        reserved_quantity >= 0
        AND in_preparation_quantity >= 0
        AND dispatched_quantity >= 0
        AND in_operation_quantity >= 0
        AND returned_quantity >= 0
        AND maintenance_quantity >= 0
        AND damaged_quantity >= 0
        AND lost_quantity >= 0
      );
  END IF;
END $$;

-- 3. Operation events table
CREATE TABLE IF NOT EXISTS public.inventory_operation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  reservation_id uuid REFERENCES public.inventory_reservations(id) ON DELETE CASCADE,
  reservation_item_id uuid REFERENCES public.inventory_reservation_items(id) ON DELETE SET NULL,
  reservation_allocation_id uuid REFERENCES public.inventory_reservation_allocations(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  from_status text,
  to_status text,
  allocation_item_type text,
  serialized_item_id uuid,
  quantity_item_id uuid,
  quantity numeric NOT NULL DEFAULT 1,
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_operation_events_event_type_check CHECK (event_type IN (
    'reservation_status_changed','item_prepared','item_dispatched','item_in_operation',
    'item_returned','item_released','item_damaged','item_lost','item_sent_to_maintenance','manual_adjustment'
  )),
  CONSTRAINT inventory_operation_events_quantity_check CHECK (quantity > 0)
);

CREATE INDEX IF NOT EXISTS idx_inventory_operation_events_org_reservation
  ON public.inventory_operation_events (organization_id, reservation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_operation_events_serialized
  ON public.inventory_operation_events (organization_id, serialized_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_operation_events_quantity
  ON public.inventory_operation_events (organization_id, quantity_item_id, created_at DESC);

ALTER TABLE public.inventory_operation_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='inventory_operation_events'
      AND policyname='Users can view inventory operation events from their organization'
  ) THEN
    CREATE POLICY "Users can view inventory operation events from their organization"
      ON public.inventory_operation_events FOR SELECT
      USING (public.user_can_access_inventory(organization_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='inventory_operation_events'
      AND policyname='Users can create inventory operation events from their organization'
  ) THEN
    CREATE POLICY "Users can create inventory operation events from their organization"
      ON public.inventory_operation_events FOR INSERT
      WITH CHECK (public.user_can_access_inventory(organization_id));
  END IF;
END $$;

-- 4. RPC: update reservation operational status with physical effects
CREATE OR REPLACE FUNCTION public.update_inventory_reservation_operational_status(
  p_reservation_id uuid,
  p_new_status text,
  p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  rsv record;
  alloc record;
  pending_conditions integer := 0;
  v_actor uuid := auth.uid();
  v_event_type text;
BEGIN
  SELECT * INTO rsv FROM public.inventory_reservations WHERE id = p_reservation_id;
  IF rsv.id IS NULL THEN RAISE EXCEPTION 'Reserva não encontrada.'; END IF;
  IF NOT public.user_can_access_inventory(rsv.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;

  -- Validate transition
  IF NOT (
    (rsv.status = 'confirmed'      AND p_new_status IN ('in_preparation','cancelled'))
    OR (rsv.status = 'in_preparation' AND p_new_status IN ('dispatched','cancelled'))
    OR (rsv.status = 'dispatched'     AND p_new_status = 'in_operation')
    OR (rsv.status = 'in_operation'   AND p_new_status = 'returned')
    OR (rsv.status = 'returned'       AND p_new_status = 'closed')
  ) THEN
    RAISE EXCEPTION 'Transição inválida: % -> %', rsv.status, p_new_status;
  END IF;

  IF p_new_status = 'closed' THEN
    SELECT COUNT(*) INTO pending_conditions
      FROM public.inventory_reservation_allocations
     WHERE reservation_id = p_reservation_id
       AND allocation_status = 'active'
       AND operational_status = 'returned'
       AND return_condition IS NULL;
    IF pending_conditions > 0 THEN
      RAISE EXCEPTION 'Existem itens retornados sem condição de retorno informada.';
    END IF;
  END IF;

  -- Apply per-allocation effects
  FOR alloc IN
    SELECT * FROM public.inventory_reservation_allocations
     WHERE reservation_id = p_reservation_id
       AND allocation_status = 'active'
       AND operational_status NOT IN ('cancelled','released','damaged','lost','maintenance')
  LOOP
    IF p_new_status = 'in_preparation' THEN
      v_event_type := 'item_prepared';
      IF alloc.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items
           SET status = 'in_preparation', updated_at = now()
         WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
      ELSE
        UPDATE public.inventory_items
           SET reserved_quantity = GREATEST(reserved_quantity - alloc.allocated_quantity, 0),
               in_preparation_quantity = in_preparation_quantity + alloc.allocated_quantity,
               updated_at = now()
         WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
      END IF;
      UPDATE public.inventory_reservation_allocations
         SET operational_status='prepared', prepared_at=now(), prepared_by=v_actor, updated_at=now()
       WHERE id = alloc.id;

    ELSIF p_new_status = 'dispatched' THEN
      v_event_type := 'item_dispatched';
      IF alloc.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items
           SET status = 'dispatched', updated_at = now()
         WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
      ELSE
        UPDATE public.inventory_items
           SET in_preparation_quantity = GREATEST(in_preparation_quantity - alloc.allocated_quantity, 0),
               dispatched_quantity = dispatched_quantity + alloc.allocated_quantity,
               updated_at = now()
         WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
      END IF;
      UPDATE public.inventory_reservation_allocations
         SET operational_status='dispatched', dispatched_at=now(), dispatched_by=v_actor, updated_at=now()
       WHERE id = alloc.id;

    ELSIF p_new_status = 'in_operation' THEN
      v_event_type := 'item_in_operation';
      IF alloc.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items
           SET status = 'in_operation', updated_at = now()
         WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
      ELSE
        UPDATE public.inventory_items
           SET dispatched_quantity = GREATEST(dispatched_quantity - alloc.allocated_quantity, 0),
               in_operation_quantity = in_operation_quantity + alloc.allocated_quantity,
               updated_at = now()
         WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
      END IF;
      UPDATE public.inventory_reservation_allocations
         SET operational_status='in_operation', in_operation_at=now(), updated_at=now()
       WHERE id = alloc.id;

    ELSIF p_new_status = 'returned' THEN
      v_event_type := 'item_returned';
      IF alloc.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items
           SET status = 'returned', updated_at = now()
         WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
      ELSE
        UPDATE public.inventory_items
           SET in_operation_quantity = GREATEST(in_operation_quantity - alloc.allocated_quantity, 0),
               returned_quantity = returned_quantity + alloc.allocated_quantity,
               updated_at = now()
         WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
      END IF;
      UPDATE public.inventory_reservation_allocations
         SET operational_status='returned', returned_at=now(), returned_by=v_actor, updated_at=now()
       WHERE id = alloc.id;

    ELSIF p_new_status = 'closed' THEN
      -- Apply baixa per return_condition
      IF alloc.return_condition = 'ok' THEN
        v_event_type := 'item_released';
        IF alloc.allocation_item_type = 'serialized' THEN
          UPDATE public.inventory_items SET status='available', updated_at=now()
           WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
        ELSE
          UPDATE public.inventory_items
             SET returned_quantity = GREATEST(returned_quantity - alloc.allocated_quantity, 0),
                 quantity_available = quantity_available + alloc.allocated_quantity,
                 updated_at = now()
           WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
        END IF;
        UPDATE public.inventory_reservation_allocations
           SET operational_status='released', released_at=now(), released_by=v_actor, updated_at=now()
         WHERE id = alloc.id;

      ELSIF alloc.return_condition = 'damaged' THEN
        v_event_type := 'item_damaged';
        IF alloc.allocation_item_type = 'serialized' THEN
          UPDATE public.inventory_items SET status='damaged', updated_at=now()
           WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
        ELSE
          UPDATE public.inventory_items
             SET returned_quantity = GREATEST(returned_quantity - alloc.allocated_quantity, 0),
                 damaged_quantity = damaged_quantity + alloc.allocated_quantity,
                 updated_at = now()
           WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
        END IF;
        UPDATE public.inventory_reservation_allocations
           SET operational_status='damaged', released_at=now(), released_by=v_actor, updated_at=now()
         WHERE id = alloc.id;

      ELSIF alloc.return_condition = 'lost' THEN
        v_event_type := 'item_lost';
        IF alloc.allocation_item_type = 'serialized' THEN
          UPDATE public.inventory_items SET status='lost', updated_at=now()
           WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
        ELSE
          UPDATE public.inventory_items
             SET returned_quantity = GREATEST(returned_quantity - alloc.allocated_quantity, 0),
                 lost_quantity = lost_quantity + alloc.allocated_quantity,
                 updated_at = now()
           WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
        END IF;
        UPDATE public.inventory_reservation_allocations
           SET operational_status='lost', released_at=now(), released_by=v_actor, updated_at=now()
         WHERE id = alloc.id;

      ELSIF alloc.return_condition = 'maintenance_required' THEN
        v_event_type := 'item_sent_to_maintenance';
        IF alloc.allocation_item_type = 'serialized' THEN
          UPDATE public.inventory_items SET status='maintenance', updated_at=now()
           WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id;
        ELSE
          UPDATE public.inventory_items
             SET returned_quantity = GREATEST(returned_quantity - alloc.allocated_quantity, 0),
                 maintenance_quantity = maintenance_quantity + alloc.allocated_quantity,
                 updated_at = now()
           WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
        END IF;
        UPDATE public.inventory_reservation_allocations
           SET operational_status='maintenance', released_at=now(), released_by=v_actor, updated_at=now()
         WHERE id = alloc.id;
      END IF;

    ELSIF p_new_status = 'cancelled' THEN
      v_event_type := 'manual_adjustment';
      -- Release physical commitment
      IF alloc.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items SET status='available', updated_at=now()
         WHERE id = alloc.serialized_item_id AND organization_id = alloc.organization_id
           AND status IN ('reserved','in_preparation');
      ELSE
        UPDATE public.inventory_items
           SET reserved_quantity = GREATEST(reserved_quantity - alloc.allocated_quantity, 0),
               in_preparation_quantity = GREATEST(in_preparation_quantity - 0, 0),
               quantity_available = quantity_available + alloc.allocated_quantity,
               updated_at = now()
         WHERE id = alloc.quantity_item_id AND organization_id = alloc.organization_id;
      END IF;
      UPDATE public.inventory_reservation_allocations
         SET operational_status='cancelled', updated_at=now()
       WHERE id = alloc.id;
    END IF;

    -- Log per-allocation event
    INSERT INTO public.inventory_operation_events (
      organization_id, reservation_id, reservation_item_id, reservation_allocation_id,
      event_type, from_status, to_status, allocation_item_type,
      serialized_item_id, quantity_item_id, quantity, notes, created_by
    ) VALUES (
      alloc.organization_id, p_reservation_id, alloc.reservation_item_id, alloc.id,
      v_event_type, rsv.status, p_new_status, alloc.allocation_item_type,
      alloc.serialized_item_id, alloc.quantity_item_id, alloc.allocated_quantity, p_notes, v_actor
    );
  END LOOP;

  -- Update reservation header
  UPDATE public.inventory_reservations
     SET status = p_new_status, updated_at = now()
   WHERE id = p_reservation_id;

  -- Log reservation status change
  INSERT INTO public.inventory_operation_events (
    organization_id, reservation_id, event_type, from_status, to_status, notes, created_by
  ) VALUES (
    rsv.organization_id, p_reservation_id, 'reservation_status_changed',
    rsv.status, p_new_status, p_notes, v_actor
  );

  RETURN jsonb_build_object('success', true, 'reservation_id', p_reservation_id, 'new_status', p_new_status);
END;
$function$;

-- 5. RPC: set return condition for a single allocation
CREATE OR REPLACE FUNCTION public.set_inventory_return_condition(
  p_reservation_allocation_id uuid,
  p_return_condition text,
  p_return_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  alloc record;
  rsv record;
BEGIN
  SELECT * INTO alloc FROM public.inventory_reservation_allocations WHERE id = p_reservation_allocation_id;
  IF alloc.id IS NULL THEN RAISE EXCEPTION 'Alocação não encontrada.'; END IF;
  IF NOT public.user_can_access_inventory(alloc.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF p_return_condition NOT IN ('ok','damaged','lost','maintenance_required') THEN
    RAISE EXCEPTION 'Condição de retorno inválida.';
  END IF;
  SELECT * INTO rsv FROM public.inventory_reservations WHERE id = alloc.reservation_id;
  IF rsv.status <> 'returned' THEN
    RAISE EXCEPTION 'Só é possível registrar condição em reservas com status retornado.';
  END IF;
  IF alloc.operational_status <> 'returned' THEN
    RAISE EXCEPTION 'Alocação não está em status retornado.';
  END IF;

  UPDATE public.inventory_reservation_allocations
     SET return_condition = p_return_condition,
         return_notes = p_return_notes,
         returned_by = COALESCE(returned_by, auth.uid()),
         updated_at = now()
   WHERE id = p_reservation_allocation_id;

  RETURN jsonb_build_object('success', true, 'allocation_id', p_reservation_allocation_id, 'return_condition', p_return_condition);
END;
$function$;

-- 6. Update convert function to commit physical stock on creation
CREATE OR REPLACE FUNCTION public.convert_pre_reservation_to_reservation(
  p_pre_reservation_id uuid,
  p_confirmation_trigger text DEFAULT 'manual'::text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  pre_record record;
  new_reservation_id uuid;
  item_record record;
  allocation_record record;
  new_reservation_item_id uuid;
  new_alloc_id uuid;
  conflict_record record;
  has_conflict boolean := false;
  conflict_messages jsonb := '[]'::jsonb;
  qty_avail numeric;
BEGIN
  SELECT * INTO pre_record FROM public.inventory_pre_reservations WHERE id = p_pre_reservation_id;
  IF pre_record.id IS NULL THEN RAISE EXCEPTION 'Pré reserva não encontrada.'; END IF;
  IF NOT public.user_can_access_inventory(pre_record.organization_id) THEN
    RAISE EXCEPTION 'Acesso negado.';
  END IF;
  IF pre_record.status <> 'active' THEN
    RAISE EXCEPTION 'Apenas pré reservas ativas podem ser convertidas.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.inventory_reservations r
    WHERE r.pre_reservation_id = p_pre_reservation_id AND r.status <> 'cancelled'
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

  -- Conflict check
  FOR allocation_record IN
    SELECT a.* FROM public.inventory_pre_reservation_allocations a
    WHERE a.pre_reservation_id = p_pre_reservation_id AND a.allocation_status = 'active'
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
      conflict_messages := conflict_messages || jsonb_build_array(jsonb_build_object(
        'allocation_id', allocation_record.id,
        'item_type', allocation_record.allocation_item_type,
        'serialized_item_id', allocation_record.serialized_item_id,
        'quantity_item_id', allocation_record.quantity_item_id,
        'message', conflict_record.message
      ));
    END IF;
  END LOOP;

  IF has_conflict THEN
    RETURN jsonb_build_object('success', false, 'reason', 'reservation_conflict',
      'message', 'Existem conflitos com reservas definitivas no mesmo período.', 'conflicts', conflict_messages);
  END IF;

  INSERT INTO public.inventory_reservations (
    organization_id, pre_reservation_id, proposal_id, opportunity_id,
    account_id, contact_id, title, source,
    operational_start_date, operational_end_date, event_start_date, event_end_date,
    status, risk_level, confirmation_trigger, confirmed_at, confirmed_by, notes, created_by
  ) VALUES (
    pre_record.organization_id, pre_record.id, pre_record.proposal_id, pre_record.opportunity_id,
    pre_record.account_id, pre_record.contact_id, pre_record.title, 'pre_reservation',
    pre_record.operational_start_date, pre_record.operational_end_date,
    pre_record.event_start_date, pre_record.event_end_date,
    'confirmed', pre_record.risk_level, p_confirmation_trigger, now(), auth.uid(),
    pre_record.notes, auth.uid()
  ) RETURNING id INTO new_reservation_id;

  FOR item_record IN
    SELECT * FROM public.inventory_pre_reservation_items WHERE pre_reservation_id = p_pre_reservation_id
  LOOP
    INSERT INTO public.inventory_reservation_items (
      organization_id, reservation_id, source_pre_reservation_item_id,
      inventory_item_type, serialized_item_id, quantity_item_id,
      category_id, family_id, requested_quantity, reserved_quantity,
      demand_label, demand_source, reservation_status, conflict_reason, notes
    ) VALUES (
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
    ) RETURNING id INTO new_reservation_item_id;

    FOR allocation_record IN
      SELECT * FROM public.inventory_pre_reservation_allocations
       WHERE pre_reservation_item_id = item_record.id AND allocation_status = 'active'
    LOOP
      INSERT INTO public.inventory_reservation_allocations (
        organization_id, reservation_id, reservation_item_id,
        source_pre_reservation_allocation_id, allocation_item_type,
        serialized_item_id, quantity_item_id, allocated_quantity,
        allocation_status, operational_status, notes, created_by
      ) VALUES (
        allocation_record.organization_id, new_reservation_id, new_reservation_item_id,
        allocation_record.id, allocation_record.allocation_item_type,
        allocation_record.serialized_item_id, allocation_record.quantity_item_id,
        allocation_record.allocated_quantity, 'active', 'pending',
        allocation_record.notes, auth.uid()
      ) RETURNING id INTO new_alloc_id;

      -- Commit physical stock (mark as reserved)
      IF allocation_record.allocation_item_type = 'serialized' THEN
        UPDATE public.inventory_items
           SET status = 'reserved', updated_at = now()
         WHERE id = allocation_record.serialized_item_id
           AND organization_id = allocation_record.organization_id
           AND status = 'available';
      ELSE
        SELECT quantity_available INTO qty_avail
          FROM public.inventory_items
         WHERE id = allocation_record.quantity_item_id
           AND organization_id = allocation_record.organization_id
         FOR UPDATE;
        IF qty_avail IS NULL OR qty_avail < allocation_record.allocated_quantity THEN
          RAISE EXCEPTION 'Quantidade disponível insuficiente para o item % (necessário %, disponível %).',
            allocation_record.quantity_item_id, allocation_record.allocated_quantity, COALESCE(qty_avail,0);
        END IF;
        UPDATE public.inventory_items
           SET quantity_available = quantity_available - allocation_record.allocated_quantity,
               reserved_quantity = reserved_quantity + allocation_record.allocated_quantity,
               updated_at = now()
         WHERE id = allocation_record.quantity_item_id
           AND organization_id = allocation_record.organization_id;
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.inventory_pre_reservations
     SET status = 'converted', updated_at = now()
   WHERE id = p_pre_reservation_id;

  -- Log creation event
  INSERT INTO public.inventory_operation_events (
    organization_id, reservation_id, event_type, from_status, to_status, notes, created_by
  ) VALUES (
    pre_record.organization_id, new_reservation_id, 'reservation_status_changed',
    NULL, 'confirmed', 'Reserva criada por conversão da pré reserva.', auth.uid()
  );

  RETURN jsonb_build_object('success', true, 'reservation_id', new_reservation_id,
    'pre_reservation_id', p_pre_reservation_id, 'message', 'Pré reserva convertida em reserva definitiva.');
END;
$function$;

-- 7. Permissions
GRANT EXECUTE ON FUNCTION public.update_inventory_reservation_operational_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_inventory_return_condition(uuid, text, text) TO authenticated;