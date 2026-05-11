-- 1. Equipment profile in categories
ALTER TABLE public.inventory_categories
  ADD COLUMN IF NOT EXISTS equipment_profile text NOT NULL DEFAULT 'generic';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inventory_categories_equipment_profile_check'
  ) THEN
    ALTER TABLE public.inventory_categories
      ADD CONSTRAINT inventory_categories_equipment_profile_check
      CHECK (equipment_profile IN ('generic', 'router', 'sim_card'));
  END IF;
END $$;

COMMENT ON COLUMN public.inventory_categories.equipment_profile IS
  'Perfil de equipamento que dispara campos extras no item: generic | router | sim_card.';

-- 2. Custom config per allocation
ALTER TABLE public.inventory_reservation_allocations
  ADD COLUMN IF NOT EXISTS custom_config jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inventory_reservation_allocations.custom_config IS
  'Configuração personalizada da alocação. Shape: { router: { ssid_custom, wifi_password_custom, notes }, sim_card: { apn_operational, notes } }.';

-- 3. Trigger blocking dispatch without custom config for router/sim_card
CREATE OR REPLACE FUNCTION public.validate_router_allocation_dispatch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile text;
  v_router jsonb;
  v_sim jsonb;
BEGIN
  -- Only check on transition into 'dispatched'
  IF NEW.operational_status IS DISTINCT FROM 'dispatched' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.operational_status = 'dispatched' THEN
    RETURN NEW;
  END IF;

  IF NEW.serialized_item_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.equipment_profile INTO v_profile
  FROM public.inventory_items i
  JOIN public.inventory_categories c ON c.id = i.category_id
  WHERE i.id = NEW.serialized_item_id;

  IF v_profile IS NULL OR v_profile = 'generic' THEN
    RETURN NEW;
  END IF;

  IF v_profile = 'router' THEN
    v_router := COALESCE(NEW.custom_config -> 'router', '{}'::jsonb);
    IF COALESCE(v_router ->> 'ssid_custom', '') = ''
       OR COALESCE(v_router ->> 'wifi_password_custom', '') = '' THEN
      RAISE EXCEPTION 'Configure SSID e senha personalizados antes de despachar este roteador.'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_profile = 'sim_card' THEN
    v_sim := COALESCE(NEW.custom_config -> 'sim_card', '{}'::jsonb);
    IF COALESCE(v_sim ->> 'apn_operational', '') = '' THEN
      RAISE EXCEPTION 'Configure o APN operacional antes de despachar este chip.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_router_allocation_dispatch ON public.inventory_reservation_allocations;
CREATE TRIGGER trg_validate_router_allocation_dispatch
  BEFORE INSERT OR UPDATE OF operational_status, custom_config
  ON public.inventory_reservation_allocations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_router_allocation_dispatch();