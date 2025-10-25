-- Fix function security by setting search_path
CREATE OR REPLACE FUNCTION update_days_since_contact()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.last_contact_date IS NOT NULL THEN
    NEW.days_since_contact := EXTRACT(DAY FROM (now() - NEW.last_contact_date));
  END IF;
  RETURN NEW;
END;
$$;