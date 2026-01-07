-- Fase 1: Adicionar coluna closed_at para registro imutável de fechamento
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMP WITH TIME ZONE;

-- Criar função de trigger para setar closed_at quando status muda para won/lost
CREATE OR REPLACE FUNCTION public.set_opportunity_closed_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Só seta closed_at se:
  -- 1. O novo status é won ou lost
  -- 2. O status anterior NÃO era won ou lost (transição real)
  -- 3. closed_at ainda não foi setado (primeira vez)
  IF NEW.status IN ('won', 'lost') 
     AND (OLD.status IS NULL OR OLD.status NOT IN ('won', 'lost'))
     AND NEW.closed_at IS NULL THEN
    NEW.closed_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Remover trigger se existir
DROP TRIGGER IF EXISTS trigger_set_opportunity_closed_at ON public.opportunities;

-- Criar trigger ANTES do update
CREATE TRIGGER trigger_set_opportunity_closed_at
BEFORE UPDATE ON public.opportunities
FOR EACH ROW
EXECUTE FUNCTION public.set_opportunity_closed_at();

-- Fase 2: Backfill - preencher closed_at para oportunidades já fechadas
-- Prioridade: usar win_loss_records.created_at quando existir, senão updated_at
UPDATE public.opportunities o
SET closed_at = COALESCE(
  (SELECT wlr.created_at FROM public.win_loss_records wlr WHERE wlr.opportunity_id = o.id ORDER BY wlr.created_at DESC LIMIT 1),
  o.updated_at
)
WHERE o.status IN ('won', 'lost')
  AND o.closed_at IS NULL;

-- Criar índice para performance em queries por closed_at
CREATE INDEX IF NOT EXISTS idx_opportunities_closed_at ON public.opportunities(closed_at) WHERE closed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_opportunities_status_closed_at ON public.opportunities(status, closed_at) WHERE status IN ('won', 'lost');