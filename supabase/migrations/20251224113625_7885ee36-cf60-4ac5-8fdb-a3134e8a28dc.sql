-- Adicionar campos de Vibe Selling à tabela opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS vibe_state TEXT DEFAULT 'neutral',
ADD COLUMN IF NOT EXISTS energy_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS timing_score INTEGER DEFAULT 50,
ADD COLUMN IF NOT EXISTS response_velocity NUMERIC;

-- Criar constraint para vibe_state
ALTER TABLE public.opportunities 
DROP CONSTRAINT IF EXISTS opportunities_vibe_state_check;

ALTER TABLE public.opportunities 
ADD CONSTRAINT opportunities_vibe_state_check 
CHECK (vibe_state IN (
  'neutral',        -- Neutro (inicial)
  'curious',        -- Curioso
  'exploratory',    -- Exploratório
  'skeptical',      -- Cético
  'comparative',    -- Comparativo
  'deciding',       -- Em decisão
  'blocked',        -- Travado emocionalmente
  'hot_silent',     -- Quente silencioso
  'ready_insecure'  -- Pronto mas inseguro
));

-- Comentários para documentação
COMMENT ON COLUMN public.opportunities.vibe_state IS 'Estado emocional/humano do lead (Vibe Selling)';
COMMENT ON COLUMN public.opportunities.energy_score IS 'Score de energia do lead (0-100) - engagement + interesse';
COMMENT ON COLUMN public.opportunities.timing_score IS 'Score de timing (0-100) - momento favorável para ação';
COMMENT ON COLUMN public.opportunities.response_velocity IS 'Velocidade média de resposta do lead em horas';

-- Índice para queries por vibe_state
CREATE INDEX IF NOT EXISTS idx_opportunities_vibe_state ON public.opportunities(vibe_state);

-- Tabela de log para mudanças de vibe (auditoria)
CREATE TABLE IF NOT EXISTS public.vibe_state_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  previous_state TEXT,
  new_state TEXT NOT NULL,
  detected_by TEXT DEFAULT 'manual', -- 'manual', 'ai', 'system'
  confidence_score NUMERIC,
  detection_factors JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS para vibe_state_history
ALTER TABLE public.vibe_state_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view vibe history for their org"
ON public.vibe_state_history FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert vibe history for their org"
ON public.vibe_state_history FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));