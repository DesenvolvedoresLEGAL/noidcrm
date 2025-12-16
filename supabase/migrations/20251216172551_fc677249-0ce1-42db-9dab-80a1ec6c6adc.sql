-- =====================================================
-- MOTOR DE MEMÓRIA ORGANIZACIONAL
-- Tabelas: memories, memory_reads
-- Funções: get_relevant_memories, update_memory_stats
-- =====================================================

-- Tipos de memória
CREATE TYPE memory_type AS ENUM (
  'objection',           -- Objeções e como foram tratadas
  'win_pattern',         -- Padrões de ganho
  'loss_pattern',        -- Padrões de perda
  'churn_signal',        -- Sinais de churn
  'converting_language', -- Linguagem que converte
  'countermeasure'       -- Contramedidas eficazes
);

-- Tabela principal de memórias
CREATE TABLE public.memories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Tipo e conteúdo
  memory_type memory_type NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  keywords TEXT[] DEFAULT '{}',
  
  -- Contexto de origem
  source_type TEXT NOT NULL CHECK (source_type IN ('win_loss', 'playbook', 'churn', 'activity', 'manual')),
  source_id UUID,
  source_metadata JSONB DEFAULT '{}',
  
  -- Classificações para matching
  industry TEXT,
  deal_size TEXT CHECK (deal_size IN ('small', 'medium', 'large', 'enterprise')),
  persona TEXT,
  stage TEXT,
  pipeline_id TEXT,
  
  -- Métricas de qualidade
  confidence_score NUMERIC DEFAULT 0.5 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  success_rate NUMERIC CHECK (success_rate >= 0 AND success_rate <= 1),
  usage_count INTEGER DEFAULT 0,
  positive_outcomes INTEGER DEFAULT 0,
  negative_outcomes INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  
  -- Validação manual
  validated BOOLEAN DEFAULT FALSE,
  validated_by UUID,
  validated_at TIMESTAMPTZ,
  
  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deprecated')),
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para busca eficiente
CREATE INDEX idx_memories_org_type ON memories(organization_id, memory_type);
CREATE INDEX idx_memories_org_status ON memories(organization_id, status);
CREATE INDEX idx_memories_keywords ON memories USING GIN(keywords);
CREATE INDEX idx_memories_industry ON memories(industry) WHERE industry IS NOT NULL;
CREATE INDEX idx_memories_stage ON memories(stage) WHERE stage IS NOT NULL;
CREATE INDEX idx_memories_source ON memories(source_type, source_id);
CREATE INDEX idx_memories_usage ON memories(usage_count DESC);
CREATE INDEX idx_memories_success ON memories(success_rate DESC NULLS LAST);

-- Tabela de leituras/uso de memórias
CREATE TABLE public.memory_reads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  memory_id UUID NOT NULL REFERENCES memories(id) ON DELETE CASCADE,
  
  -- Contexto de uso
  read_context TEXT NOT NULL CHECK (read_context IN (
    'suggestion', 'playbook', 'forecast', 'email', 'meeting_prep', 
    'objection_handling', 'deal_analysis', 'coaching', 'manual_view'
  )),
  entity_type TEXT,
  entity_id UUID,
  
  -- Quem/o quê usou
  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('user', 'ai_function', 'cron', 'automation')),
  user_id UUID,
  ai_function TEXT,
  
  -- Resultado do uso
  outcome TEXT CHECK (outcome IN ('applied', 'ignored', 'rejected', 'pending')),
  outcome_reason TEXT,
  effectiveness_score NUMERIC CHECK (effectiveness_score >= 0 AND effectiveness_score <= 1),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memory_reads_memory ON memory_reads(memory_id);
CREATE INDEX idx_memory_reads_org ON memory_reads(organization_id);
CREATE INDEX idx_memory_reads_context ON memory_reads(read_context, entity_type, entity_id);
CREATE INDEX idx_memory_reads_outcome ON memory_reads(outcome) WHERE outcome IS NOT NULL;

-- Enable RLS
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for memories
CREATE POLICY "Users can view org memories" ON memories
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "Users can create org memories" ON memories
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

CREATE POLICY "Users can update org memories" ON memories
  FOR UPDATE USING (organization_id = get_user_organization_id());

CREATE POLICY "Admins can delete memories" ON memories
  FOR DELETE USING (user_is_org_admin(organization_id));

-- RLS Policies for memory_reads
CREATE POLICY "Users can view org memory_reads" ON memory_reads
  FOR SELECT USING (organization_id = get_user_organization_id());

CREATE POLICY "System can insert memory_reads" ON memory_reads
  FOR INSERT WITH CHECK (organization_id = get_user_organization_id());

-- Function to get relevant memories for a context
CREATE OR REPLACE FUNCTION get_relevant_memories(
  p_organization_id UUID,
  p_context TEXT,
  p_memory_types memory_type[] DEFAULT NULL,
  p_industry TEXT DEFAULT NULL,
  p_stage TEXT DEFAULT NULL,
  p_pipeline_id TEXT DEFAULT NULL,
  p_keywords TEXT[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  memory_type memory_type,
  title TEXT,
  content TEXT,
  keywords TEXT[],
  source_type TEXT,
  source_metadata JSONB,
  industry TEXT,
  stage TEXT,
  confidence_score NUMERIC,
  success_rate NUMERIC,
  usage_count INTEGER,
  relevance_score NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    m.id,
    m.memory_type,
    m.title,
    m.content,
    m.keywords,
    m.source_type,
    m.source_metadata,
    m.industry,
    m.stage,
    m.confidence_score,
    m.success_rate,
    m.usage_count,
    -- Calculate relevance score
    (
      COALESCE(m.confidence_score, 0.5) * 0.3 +
      COALESCE(m.success_rate, 0.5) * 0.3 +
      CASE WHEN m.industry = p_industry THEN 0.15 ELSE 0 END +
      CASE WHEN m.stage = p_stage THEN 0.1 ELSE 0 END +
      CASE WHEN m.pipeline_id = p_pipeline_id THEN 0.1 ELSE 0 END +
      CASE WHEN m.keywords && p_keywords THEN 0.05 ELSE 0 END
    )::NUMERIC AS relevance_score
  FROM memories m
  WHERE m.organization_id = p_organization_id
    AND m.status = 'active'
    AND (p_memory_types IS NULL OR m.memory_type = ANY(p_memory_types))
    AND (p_industry IS NULL OR m.industry IS NULL OR m.industry = p_industry)
    AND (p_stage IS NULL OR m.stage IS NULL OR m.stage = p_stage)
    AND (m.expires_at IS NULL OR m.expires_at > NOW())
  ORDER BY relevance_score DESC, m.usage_count DESC, m.created_at DESC
  LIMIT p_limit;
END;
$$;

-- Function to update memory stats after read
CREATE OR REPLACE FUNCTION update_memory_stats_on_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update usage count and last_used_at
  UPDATE memories
  SET 
    usage_count = usage_count + 1,
    last_used_at = NOW(),
    -- Update positive/negative outcomes if provided
    positive_outcomes = positive_outcomes + CASE WHEN NEW.outcome = 'applied' THEN 1 ELSE 0 END,
    negative_outcomes = negative_outcomes + CASE WHEN NEW.outcome = 'rejected' THEN 1 ELSE 0 END,
    -- Recalculate success rate
    success_rate = CASE 
      WHEN (positive_outcomes + negative_outcomes + 
            CASE WHEN NEW.outcome IN ('applied', 'rejected') THEN 1 ELSE 0 END) > 0 
      THEN (positive_outcomes + CASE WHEN NEW.outcome = 'applied' THEN 1 ELSE 0 END)::NUMERIC / 
           (positive_outcomes + negative_outcomes + 
            CASE WHEN NEW.outcome IN ('applied', 'rejected') THEN 1 ELSE 0 END)
      ELSE NULL 
    END,
    updated_at = NOW()
  WHERE id = NEW.memory_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_memory_stats
  AFTER INSERT ON memory_reads
  FOR EACH ROW
  EXECUTE FUNCTION update_memory_stats_on_read();

-- Function to record memory read
CREATE OR REPLACE FUNCTION record_memory_read(
  p_organization_id UUID,
  p_memory_id UUID,
  p_context TEXT,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_triggered_by TEXT DEFAULT 'ai_function',
  p_user_id UUID DEFAULT NULL,
  p_ai_function TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_read_id UUID;
BEGIN
  INSERT INTO memory_reads (
    organization_id, memory_id, read_context, entity_type, entity_id,
    triggered_by, user_id, ai_function, outcome
  ) VALUES (
    p_organization_id, p_memory_id, p_context, p_entity_type, p_entity_id,
    p_triggered_by, p_user_id, p_ai_function, 'pending'
  )
  RETURNING id INTO v_read_id;
  
  RETURN v_read_id;
END;
$$;

-- Trigger to extract memories from win_loss_records
CREATE OR REPLACE FUNCTION trigger_extract_memories_from_win_loss()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Fire edge function to extract memories (async via pg_net if available)
  -- For now, we'll mark for processing
  INSERT INTO system_events (
    organization_id,
    event_type,
    event_category,
    entity_type,
    entity_id,
    payload
  ) VALUES (
    NEW.organization_id,
    'memory_extraction_requested',
    'ai',
    'win_loss_record',
    NEW.id,
    jsonb_build_object(
      'outcome', NEW.outcome,
      'reason_id', NEW.reason_id,
      'win_reason_id', NEW.win_reason_id,
      'objections_faced', NEW.objections_faced,
      'strengths_mentioned', NEW.strengths_mentioned,
      'weaknesses_mentioned', NEW.weaknesses_mentioned,
      'lessons_learned', NEW.lessons_learned,
      'key_differentiator', NEW.key_differentiator,
      'customer_feedback', NEW.customer_feedback
    )
  );
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_win_loss_memory_extraction
  AFTER INSERT ON win_loss_records
  FOR EACH ROW
  EXECUTE FUNCTION trigger_extract_memories_from_win_loss();

-- Updated_at trigger
CREATE TRIGGER update_memories_updated_at
  BEFORE UPDATE ON memories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();