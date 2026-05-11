DROP FUNCTION IF EXISTS public.list_pre_reservation_item_allocations(uuid);

CREATE OR REPLACE FUNCTION public.list_pre_reservation_item_allocations(p_pre_reservation_item_id uuid)
 RETURNS TABLE(
   id uuid,
   allocation_item_type text,
   serialized_item_id uuid,
   quantity_item_id uuid,
   inventory_item_name text,
   inventory_item_code text,
   allocated_quantity numeric,
   allocation_status text,
   notes text,
   created_at timestamp with time zone,
   equipment_profile text,
   custom_config jsonb
 )
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
     a.created_at,
     COALESCE(cs.equipment_profile, cq.equipment_profile, 'generic')::text AS equipment_profile,
     a.custom_config
   FROM public.inventory_pre_reservation_allocations a
   LEFT JOIN public.inventory_items s ON s.id = a.serialized_item_id
   LEFT JOIN public.inventory_items q ON q.id = a.quantity_item_id
   LEFT JOIN public.inventory_categories cs ON cs.id = s.category_id
   LEFT JOIN public.inventory_categories cq ON cq.id = q.category_id
   WHERE a.pre_reservation_item_id = p_pre_reservation_item_id
     AND public.user_can_access_inventory(a.organization_id)
   ORDER BY a.created_at ASC;
$function$;

GRANT EXECUTE ON FUNCTION public.list_pre_reservation_item_allocations(uuid) TO authenticated;