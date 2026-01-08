-- Fix function search path for set_closed_at_on_status_change
CREATE OR REPLACE FUNCTION public.set_closed_at_on_status_change()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost')) THEN
    NEW.closed_at := COALESCE(NEW.closed_at, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;