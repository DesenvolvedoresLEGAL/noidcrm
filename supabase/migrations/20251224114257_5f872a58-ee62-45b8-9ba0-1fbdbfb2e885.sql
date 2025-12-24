-- Tabela de memória emocional por lead/oportunidade
CREATE TABLE IF NOT EXISTS public.lead_emotional_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES public.opportunities(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  
  -- Gatilhos
  positive_triggers TEXT[] DEFAULT '{}',
  negative_triggers TEXT[] DEFAULT '{}',
  
  -- Preferências de comunicação
  ideal_tone TEXT CHECK (ideal_tone IN ('direto', 'tecnico', 'provocativo', 'humano', 'acolhedor', 'formal')),
  response_rhythm TEXT CHECK (response_rhythm IN ('rapido', 'reflexivo', 'lento')),
  preferred_channel TEXT,
  best_contact_time TEXT,
  
  -- Objeções
  dominant_objection_type TEXT CHECK (dominant_objection_type IN ('preco', 'tempo', 'autoridade', 'necessidade', 'concorrencia', 'confianca')),
  past_objections JSONB DEFAULT '[]',
  
  -- Últimos insights
  last_interaction_summary TEXT,
  last_emotional_state TEXT,
  risk_of_vibe_break TEXT,
  vibe_break_reason TEXT,
  
  -- Padrões detectados
  communication_patterns JSONB DEFAULT '{}',
  decision_style TEXT,
  buying_signals TEXT[],
  
  -- AI metadata
  ai_confidence NUMERIC,
  last_ai_analysis_at TIMESTAMPTZ,
  analysis_version INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  
  -- Constraint única por oportunidade
  CONSTRAINT unique_opportunity_memory UNIQUE (opportunity_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_lead_emotional_memory_org ON public.lead_emotional_memory(organization_id);
CREATE INDEX IF NOT EXISTS idx_lead_emotional_memory_opp ON public.lead_emotional_memory(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_lead_emotional_memory_contact ON public.lead_emotional_memory(contact_id);
CREATE INDEX IF NOT EXISTS idx_lead_emotional_memory_risk ON public.lead_emotional_memory(risk_of_vibe_break) WHERE risk_of_vibe_break IS NOT NULL;

-- RLS
ALTER TABLE public.lead_emotional_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view emotional memory for their org"
ON public.lead_emotional_memory FOR SELECT
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can insert emotional memory for their org"
ON public.lead_emotional_memory FOR INSERT
WITH CHECK (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can update emotional memory for their org"
ON public.lead_emotional_memory FOR UPDATE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

CREATE POLICY "Users can delete emotional memory for their org"
ON public.lead_emotional_memory FOR DELETE
USING (organization_id IN (
  SELECT organization_id FROM public.profiles WHERE id = auth.uid()
));

-- Comentários
COMMENT ON TABLE public.lead_emotional_memory IS 'Memória emocional do lead para Vibe Selling - armazena gatilhos, preferências e padrões de comunicação';
COMMENT ON COLUMN public.lead_emotional_memory.positive_triggers IS 'Gatilhos que funcionam com o lead (ex: ROI, cases, urgência)';
COMMENT ON COLUMN public.lead_emotional_memory.negative_triggers IS 'Gatilhos que travam o lead (ex: pressão, termos técnicos)';
COMMENT ON COLUMN public.lead_emotional_memory.risk_of_vibe_break IS 'Nível de risco de quebra de vibe: low, medium, high, critical';

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_lead_emotional_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_lead_emotional_memory_updated_at ON public.lead_emotional_memory;
CREATE TRIGGER trigger_lead_emotional_memory_updated_at
  BEFORE UPDATE ON public.lead_emotional_memory
  FOR EACH ROW
  EXECUTE FUNCTION public.update_lead_emotional_memory_updated_at();

-- Expandir memory_entries para incluir novos tipos (se a tabela existir)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'memory_entries') THEN
    -- Adicionar novos tipos ao enum ou constraint se necessário
    ALTER TABLE public.memory_entries 
    DROP CONSTRAINT IF EXISTS memory_entries_memory_type_check;
    
    ALTER TABLE public.memory_entries 
    ADD CONSTRAINT memory_entries_memory_type_check 
    CHECK (memory_type IN (
      'key_insight', 'decision_maker', 'objection', 'preference', 
      'competitor_mention', 'budget_info', 'timeline', 'pain_point',
      'success_story', 'relationship', 'technical_requirement', 'proposal_feedback',
      -- Novos tipos Vibe Selling
      'emotional_trigger', 'ideal_approach', 'vibe_recovery', 
      'communication_preference', 'buying_signal'
    ));
  END IF;
END $$;