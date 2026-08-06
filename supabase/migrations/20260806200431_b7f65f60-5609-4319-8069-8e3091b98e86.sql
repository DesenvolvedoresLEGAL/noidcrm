CREATE OR REPLACE FUNCTION public.prevent_seller_self_role_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     AND auth.uid() = OLD.user_id
     AND NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'moderator')) THEN
    RAISE EXCEPTION 'Sellers cannot change their own role';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_seller_self_role_change ON public.sellers;
CREATE TRIGGER trg_prevent_seller_self_role_change
BEFORE UPDATE ON public.sellers
FOR EACH ROW EXECUTE FUNCTION public.prevent_seller_self_role_change();