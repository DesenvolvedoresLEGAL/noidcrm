-- Fase 2: Trigger automático para updated_at em opportunities
-- Garante que QUALQUER update automaticamente atualize o campo updated_at

-- Criar ou substituir a função de trigger
CREATE OR REPLACE FUNCTION public.trigger_update_opportunities_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Remover trigger se existir (para evitar duplicação)
DROP TRIGGER IF EXISTS trigger_opportunities_updated_at ON public.opportunities;

-- Criar o trigger
CREATE TRIGGER trigger_opportunities_updated_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.trigger_update_opportunities_timestamp();