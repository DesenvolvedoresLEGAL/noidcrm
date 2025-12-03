-- Sprint 1: Rastreabilidade SDR → Closer

-- 1. Adicionar campos de rastreabilidade na tabela opportunities
ALTER TABLE public.opportunities 
ADD COLUMN IF NOT EXISTS source_opportunity_id UUID REFERENCES public.opportunities(id),
ADD COLUMN IF NOT EXISTS qualified_by_user_id UUID,
ADD COLUMN IF NOT EXISTS qualified_at TIMESTAMPTZ;

-- 2. Adicionar campo pipeline_type na tabela pipelines para métricas separadas
ALTER TABLE public.pipelines 
ADD COLUMN IF NOT EXISTS pipeline_type TEXT DEFAULT 'sales' 
CHECK (pipeline_type IN ('qualification', 'sales', 'onboarding', 'renewal'));

-- 3. Atualizar pipelines existentes com os tipos corretos
UPDATE public.pipelines SET pipeline_type = 'qualification' WHERE name ILIKE '%PRE%VENDAS%' OR name ILIKE '%PRÉ%VENDAS%';
UPDATE public.pipelines SET pipeline_type = 'sales' WHERE name ILIKE '%ALUGUE%VENDAS%';

-- 4. Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_opportunities_source_opportunity_id ON public.opportunities(source_opportunity_id);
CREATE INDEX IF NOT EXISTS idx_opportunities_qualified_by_user_id ON public.opportunities(qualified_by_user_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_pipeline_type ON public.pipelines(pipeline_type);

-- 5. Comentários para documentação
COMMENT ON COLUMN public.opportunities.source_opportunity_id IS 'ID da oportunidade original que foi duplicada (rastreabilidade SDR→Closer)';
COMMENT ON COLUMN public.opportunities.qualified_by_user_id IS 'ID do usuário (SDR) que qualificou o lead originalmente';
COMMENT ON COLUMN public.opportunities.qualified_at IS 'Data/hora em que o lead foi qualificado';
COMMENT ON COLUMN public.pipelines.pipeline_type IS 'Tipo do pipeline: qualification (pré-vendas), sales (vendas), onboarding, renewal';