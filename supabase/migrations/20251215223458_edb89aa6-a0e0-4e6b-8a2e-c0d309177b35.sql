-- Fix security warning: set search_path for generate_trace_id function
CREATE OR REPLACE FUNCTION public.generate_trace_id()
RETURNS UUID
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT gen_random_uuid();
$$;