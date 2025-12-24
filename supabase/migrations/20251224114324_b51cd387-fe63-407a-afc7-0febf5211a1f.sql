-- Corrigir search_path da função criada
CREATE OR REPLACE FUNCTION public.update_lead_emotional_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;