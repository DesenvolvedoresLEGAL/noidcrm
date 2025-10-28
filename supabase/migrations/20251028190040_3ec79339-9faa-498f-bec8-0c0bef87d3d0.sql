-- Fix function search_path for increment_usage
DROP FUNCTION IF EXISTS public.increment_usage(uuid, text, text, int);

CREATE OR REPLACE FUNCTION public.increment_usage(
  p_org_id uuid,
  p_metric text,
  p_period text,
  p_inc int DEFAULT 1
) RETURNS void AS $$
BEGIN
  INSERT INTO public.usage_counters(organization_id, metric, period, value)
  VALUES (p_org_id, p_metric, p_period, p_inc)
  ON CONFLICT (organization_id, metric, period) 
  DO UPDATE SET value = public.usage_counters.value + p_inc;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';