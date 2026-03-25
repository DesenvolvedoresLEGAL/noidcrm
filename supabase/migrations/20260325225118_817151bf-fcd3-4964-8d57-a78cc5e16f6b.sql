
-- Fix search_path for the function
CREATE OR REPLACE FUNCTION public.ensure_single_primary_pipeline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_primary = true THEN
    UPDATE public.pipelines 
    SET is_primary = false 
    WHERE organization_id = NEW.organization_id 
      AND id != NEW.id 
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$;
