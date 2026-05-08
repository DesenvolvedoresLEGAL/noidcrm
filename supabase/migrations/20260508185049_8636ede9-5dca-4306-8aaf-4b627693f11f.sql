
CREATE OR REPLACE FUNCTION public.get_inventory_occupancy_calendar(
  p_start_date date,
  p_end_date date,
  p_category_id uuid DEFAULT NULL,
  p_family_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_view_mode text DEFAULT 'item'
)
RETURNS TABLE (
  occupancy_type text,
  source_type text,
  source_id uuid,
  item_type text,
  item_id uuid,
  item_name text,
  item_code text,
  category_id uuid,
  category_name text,
  family_id uuid,
  family_name text,
  start_date date,
  end_date date,
  status text,
  quantity numeric,
  client_name text,
  proposal_id uuid,
  reservation_code text,
  risk_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (SELECT public.get_user_organization_id() AS oid),
  pre AS (
    SELECT
      'pre_reserved'::text AS occupancy_type,
      'pre_reservation'::text AS source_type,
      pr.id AS source_id,
      COALESCE(pri.inventory_item_type, 'quantity') AS item_type,
      COALESCE(pri.serialized_item_id, pri.quantity_item_id) AS item_id,
      ii.name AS item_name,
      COALESCE(ii.serial_number, ii.asset_code) AS item_code,
      ii.category_id,
      ic.name AS category_name,
      ii.family_id,
      ifam.name AS family_name,
      pr.operational_start_date::date AS start_date,
      pr.operational_end_date::date AS end_date,
      pr.status,
      COALESCE(pri.pre_reserved_quantity, pri.requested_quantity, 0)::numeric AS quantity,
      COALESCE(a.nome_fantasia, a.razao_social) AS client_name,
      pr.proposal_id,
      pr.reservation_code,
      pr.risk_level
    FROM inventory_pre_reservations pr
    JOIN inventory_pre_reservation_items pri ON pri.pre_reservation_id = pr.id
    LEFT JOIN inventory_items ii ON ii.id = COALESCE(pri.serialized_item_id, pri.quantity_item_id)
    LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
    LEFT JOIN inventory_families ifam ON ifam.id = ii.family_id
    LEFT JOIN accounts a ON a.id = pr.account_id
    WHERE pr.organization_id = (SELECT oid FROM org)
      AND pr.status = 'active'
      AND pr.operational_start_date::date <= p_end_date
      AND pr.operational_end_date::date >= p_start_date
  ),
  res AS (
    SELECT
      CASE
        WHEN ra.operational_status = 'in_preparation' THEN 'in_preparation'
        WHEN ra.operational_status = 'dispatched' THEN 'dispatched'
        WHEN ra.operational_status = 'in_operation' THEN 'in_operation'
        WHEN ra.operational_status = 'returned' THEN 'returned'
        ELSE 'reserved'
      END::text AS occupancy_type,
      'reservation'::text AS source_type,
      r.id AS source_id,
      ri.inventory_item_type AS item_type,
      COALESCE(ri.serialized_item_id, ri.quantity_item_id) AS item_id,
      ii.name AS item_name,
      COALESCE(ii.serial_number, ii.asset_code) AS item_code,
      ii.category_id,
      ic.name AS category_name,
      ii.family_id,
      ifam.name AS family_name,
      r.operational_start_date::date AS start_date,
      r.operational_end_date::date AS end_date,
      r.status,
      COALESCE(ra.allocated_quantity, ri.reserved_quantity, ri.requested_quantity, 0)::numeric AS quantity,
      COALESCE(a.nome_fantasia, a.razao_social) AS client_name,
      r.proposal_id,
      r.reservation_code,
      r.risk_level
    FROM inventory_reservations r
    JOIN inventory_reservation_items ri ON ri.reservation_id = r.id
    LEFT JOIN inventory_reservation_allocations ra
      ON ra.reservation_item_id = ri.id
    LEFT JOIN inventory_items ii ON ii.id = COALESCE(ra.serialized_item_id, ra.quantity_item_id, ri.serialized_item_id, ri.quantity_item_id)
    LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
    LEFT JOIN inventory_families ifam ON ifam.id = ii.family_id
    LEFT JOIN accounts a ON a.id = r.account_id
    WHERE r.organization_id = (SELECT oid FROM org)
      AND (
        (p_status IS NULL AND r.status IN ('confirmed','in_preparation','dispatched','in_operation','returned'))
        OR (p_status IS NOT NULL AND r.status = p_status)
      )
      AND r.operational_start_date::date <= p_end_date
      AND r.operational_end_date::date >= p_start_date
  ),
  phys AS (
    SELECT
      CASE ii.status::text
        WHEN 'maintenance' THEN 'maintenance'
        WHEN 'damaged' THEN 'damaged'
        WHEN 'lost' THEN 'lost'
        ELSE ii.status::text
      END AS occupancy_type,
      'physical_status'::text AS source_type,
      ii.id AS source_id,
      CASE WHEN ii.item_kind::text = 'serialized' THEN 'serialized' ELSE 'quantity' END AS item_type,
      ii.id AS item_id,
      ii.name AS item_name,
      COALESCE(ii.serial_number, ii.asset_code) AS item_code,
      ii.category_id,
      ic.name AS category_name,
      ii.family_id,
      ifam.name AS family_name,
      p_start_date AS start_date,
      p_end_date AS end_date,
      ii.status::text AS status,
      CASE WHEN ii.item_kind::text = 'serialized' THEN 1
           ELSE COALESCE(ii.maintenance_quantity,0) + COALESCE(ii.damaged_quantity,0) + COALESCE(ii.lost_quantity,0) END::numeric AS quantity,
      NULL::text AS client_name,
      NULL::uuid AS proposal_id,
      NULL::text AS reservation_code,
      'baixo'::text AS risk_level
    FROM inventory_items ii
    LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
    LEFT JOIN inventory_families ifam ON ifam.id = ii.family_id
    WHERE ii.organization_id = (SELECT oid FROM org)
      AND (
        ii.status::text IN ('maintenance','damaged','lost')
        OR COALESCE(ii.maintenance_quantity,0) + COALESCE(ii.damaged_quantity,0) + COALESCE(ii.lost_quantity,0) > 0
      )
  ),
  unioned AS (
    SELECT * FROM pre
    UNION ALL
    SELECT * FROM res
    UNION ALL
    SELECT * FROM phys
  )
  SELECT *
  FROM unioned u
  WHERE (p_category_id IS NULL OR u.category_id = p_category_id)
    AND (p_family_id IS NULL OR u.family_id = p_family_id)
    AND (p_status IS NULL OR u.status = p_status OR u.occupancy_type = p_status)
  ORDER BY u.item_name, u.start_date;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_occupancy_calendar(date,date,uuid,uuid,text,text) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_inventory_capacity_by_period(
  p_start_date date,
  p_end_date date,
  p_category_id uuid DEFAULT NULL,
  p_family_id uuid DEFAULT NULL
)
RETURNS TABLE (
  category_id uuid,
  category_name text,
  family_id uuid,
  family_name text,
  total_units numeric,
  available_units numeric,
  pre_reserved_units numeric,
  reserved_units numeric,
  in_preparation_units numeric,
  dispatched_units numeric,
  in_operation_units numeric,
  returned_units numeric,
  maintenance_units numeric,
  damaged_units numeric,
  lost_units numeric,
  occupancy_rate numeric,
  risk_level text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH org AS (SELECT public.get_user_organization_id() AS oid),
  totals AS (
    SELECT
      ii.category_id,
      ic.name AS category_name,
      ii.family_id,
      ifam.name AS family_name,
      SUM(CASE WHEN ii.item_kind::text = 'serialized' THEN 1 ELSE COALESCE(ii.quantity_total,0) END)::numeric AS total_units,
      SUM(COALESCE(ii.maintenance_quantity,0) + CASE WHEN ii.status::text = 'maintenance' AND ii.item_kind::text = 'serialized' THEN 1 ELSE 0 END)::numeric AS maintenance_units,
      SUM(COALESCE(ii.damaged_quantity,0) + CASE WHEN ii.status::text = 'damaged' AND ii.item_kind::text = 'serialized' THEN 1 ELSE 0 END)::numeric AS damaged_units,
      SUM(COALESCE(ii.lost_quantity,0) + CASE WHEN ii.status::text = 'lost' AND ii.item_kind::text = 'serialized' THEN 1 ELSE 0 END)::numeric AS lost_units
    FROM inventory_items ii
    LEFT JOIN inventory_categories ic ON ic.id = ii.category_id
    LEFT JOIN inventory_families ifam ON ifam.id = ii.family_id
    WHERE ii.organization_id = (SELECT oid FROM org)
      AND (p_category_id IS NULL OR ii.category_id = p_category_id)
      AND (p_family_id IS NULL OR ii.family_id = p_family_id)
    GROUP BY ii.category_id, ic.name, ii.family_id, ifam.name
  ),
  occ AS (
    SELECT c.category_id, c.family_id, c.occupancy_type, SUM(c.quantity) AS qty
    FROM public.get_inventory_occupancy_calendar(p_start_date, p_end_date, p_category_id, p_family_id, NULL, 'category') c
    WHERE c.source_type IN ('pre_reservation','reservation')
    GROUP BY c.category_id, c.family_id, c.occupancy_type
  ),
  pivoted AS (
    SELECT
      o.category_id, o.family_id,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='pre_reserved'),0) AS pre_reserved_units,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='reserved'),0) AS reserved_units,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='in_preparation'),0) AS in_preparation_units,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='dispatched'),0) AS dispatched_units,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='in_operation'),0) AS in_operation_units,
      COALESCE(SUM(o.qty) FILTER (WHERE o.occupancy_type='returned'),0) AS returned_units
    FROM occ o
    GROUP BY o.category_id, o.family_id
  ),
  joined AS (
    SELECT
      t.category_id, t.category_name, t.family_id, t.family_name,
      t.total_units,
      COALESCE(p.pre_reserved_units,0) AS pre_reserved_units,
      COALESCE(p.reserved_units,0) AS reserved_units,
      COALESCE(p.in_preparation_units,0) AS in_preparation_units,
      COALESCE(p.dispatched_units,0) AS dispatched_units,
      COALESCE(p.in_operation_units,0) AS in_operation_units,
      COALESCE(p.returned_units,0) AS returned_units,
      t.maintenance_units, t.damaged_units, t.lost_units
    FROM totals t
    LEFT JOIN pivoted p
      ON p.category_id IS NOT DISTINCT FROM t.category_id
     AND p.family_id IS NOT DISTINCT FROM t.family_id
  )
  SELECT
    j.category_id, j.category_name, j.family_id, j.family_name,
    j.total_units,
    GREATEST(j.total_units - (j.pre_reserved_units + j.reserved_units + j.in_preparation_units + j.dispatched_units + j.in_operation_units + j.returned_units + j.maintenance_units + j.damaged_units + j.lost_units), 0) AS available_units,
    j.pre_reserved_units, j.reserved_units, j.in_preparation_units, j.dispatched_units, j.in_operation_units, j.returned_units,
    j.maintenance_units, j.damaged_units, j.lost_units,
    CASE WHEN j.total_units > 0
      THEN (j.pre_reserved_units + j.reserved_units + j.in_preparation_units + j.dispatched_units + j.in_operation_units + j.returned_units) / j.total_units
      ELSE 0 END AS occupancy_rate,
    CASE
      WHEN j.total_units = 0 THEN 'baixo'
      WHEN (j.pre_reserved_units + j.reserved_units + j.in_preparation_units + j.dispatched_units + j.in_operation_units + j.returned_units) / NULLIF(j.total_units,0) >= 0.9 THEN 'critico'
      WHEN (j.pre_reserved_units + j.reserved_units + j.in_preparation_units + j.dispatched_units + j.in_operation_units + j.returned_units) / NULLIF(j.total_units,0) >= 0.75 THEN 'alto'
      WHEN (j.pre_reserved_units + j.reserved_units + j.in_preparation_units + j.dispatched_units + j.in_operation_units + j.returned_units) / NULLIF(j.total_units,0) >= 0.5 THEN 'medio'
      ELSE 'baixo'
    END AS risk_level
  FROM joined j
  ORDER BY j.category_name NULLS LAST, j.family_name NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_capacity_by_period(date,date,uuid,uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.get_inventory_availability_snapshot(
  p_start_date date,
  p_end_date date,
  p_category_id uuid DEFAULT NULL,
  p_family_id uuid DEFAULT NULL,
  p_requested_quantity numeric DEFAULT 1
)
RETURNS TABLE (
  available_quantity numeric,
  pre_reserved_quantity numeric,
  reserved_quantity numeric,
  operational_quantity numeric,
  maintenance_quantity numeric,
  can_fulfill boolean,
  risk_level text,
  message text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric := 0;
  v_avail numeric := 0;
  v_pre numeric := 0;
  v_res numeric := 0;
  v_op numeric := 0;
  v_maint numeric := 0;
  v_rate numeric := 0;
  v_risk text := 'baixo';
  v_can boolean := false;
  v_msg text := '';
BEGIN
  SELECT
    COALESCE(SUM(c.total_units),0),
    COALESCE(SUM(c.available_units),0),
    COALESCE(SUM(c.pre_reserved_units),0),
    COALESCE(SUM(c.reserved_units),0),
    COALESCE(SUM(c.in_preparation_units + c.dispatched_units + c.in_operation_units + c.returned_units),0),
    COALESCE(SUM(c.maintenance_units),0)
  INTO v_total, v_avail, v_pre, v_res, v_op, v_maint
  FROM public.get_inventory_capacity_by_period(p_start_date, p_end_date, p_category_id, p_family_id) c;

  IF v_total > 0 THEN
    v_rate := (v_pre + v_res + v_op) / v_total;
    v_risk := CASE
      WHEN v_rate >= 0.9 THEN 'critico'
      WHEN v_rate >= 0.75 THEN 'alto'
      WHEN v_rate >= 0.5 THEN 'medio'
      ELSE 'baixo'
    END;
  END IF;

  v_can := v_avail >= COALESCE(p_requested_quantity, 0);
  v_msg := CASE
    WHEN v_can THEN 'Capacidade disponível para atender a demanda.'
    ELSE 'Disponibilidade parcial. Existem apenas ' || v_avail::text || ' unidades livres para uma demanda de ' || COALESCE(p_requested_quantity,0)::text || '.'
  END;

  RETURN QUERY SELECT v_avail, v_pre, v_res, v_op, v_maint, v_can, v_risk, v_msg;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_availability_snapshot(date,date,uuid,uuid,numeric) TO authenticated;
