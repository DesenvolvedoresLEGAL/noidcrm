
-- 1. Recreate trigger function with correct column name (user_id instead of seller_id)
CREATE OR REPLACE FUNCTION public.sync_seller_active_on_member_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    IF NEW.status = 'suspended' THEN
      UPDATE public.sellers
      SET active = false, updated_at = now()
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id;

      UPDATE public.ote_seller_config
      SET end_date = CURRENT_DATE, updated_at = now()
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id
        AND end_date IS NULL;

    ELSIF NEW.status = 'active' THEN
      UPDATE public.sellers
      SET active = true, updated_at = now()
      WHERE user_id = NEW.user_id
        AND organization_id = NEW.organization_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Create trigger on organization_members
DROP TRIGGER IF EXISTS trg_sync_seller_active_on_member_status ON public.organization_members;
CREATE TRIGGER trg_sync_seller_active_on_member_status
  AFTER UPDATE ON public.organization_members
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_seller_active_on_member_status();

-- 3. Immediate cleanup: deactivate João Parolini
UPDATE public.sellers
SET active = false, updated_at = now()
WHERE user_id = '0a33e0ba-ee0b-49c3-8ddf-898487c38ec5';

UPDATE public.ote_seller_config
SET end_date = CURRENT_DATE, updated_at = now()
WHERE user_id = '0a33e0ba-ee0b-49c3-8ddf-898487c38ec5'
AND end_date IS NULL;
