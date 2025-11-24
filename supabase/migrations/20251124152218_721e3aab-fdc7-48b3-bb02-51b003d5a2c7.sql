-- Fix security warning: set search_path on function
-- First drop the trigger, then recreate function with proper search_path
DROP TRIGGER IF EXISTS set_activity_sync_source ON public.activities;

CREATE OR REPLACE FUNCTION public.set_default_sync_source()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.sync_source IS NULL THEN
    NEW.sync_source := 'manual';
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER set_activity_sync_source
  BEFORE INSERT ON public.activities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_default_sync_source();