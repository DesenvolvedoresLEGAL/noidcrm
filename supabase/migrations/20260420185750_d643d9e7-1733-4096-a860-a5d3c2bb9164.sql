-- Fase 1 RAG: pgvector + Knowledge Base de emails

-- 1) Habilitar extensão vector
CREATE EXTENSION IF NOT EXISTS vector;

-- 2) Tabela de knowledge base
CREATE TABLE public.ai_email_knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  agent_id uuid REFERENCES public.ai_agents(id) ON DELETE SET NULL,
  source_type text NOT NULL CHECK (source_type IN ('manual_email', 'agent_email', 'playbook', 'won_deal_thread', 'negative_example')),
  source_id uuid,
  source_table text,
  opportunity_id uuid,
  subject text,
  body_text text NOT NULL,
  embedding vector(1536),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality_score numeric NOT NULL DEFAULT 0.5 CHECK (quality_score >= 0 AND quality_score <= 1),
  usage_count integer NOT NULL DEFAULT 0,
  last_used_at timestamptz,
  indexed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Índices
CREATE INDEX idx_ai_email_kb_org_quality ON public.ai_email_knowledge_base(organization_id, quality_score DESC);
CREATE INDEX idx_ai_email_kb_org_source ON public.ai_email_knowledge_base(organization_id, source_type);
CREATE INDEX idx_ai_email_kb_metadata_gin ON public.ai_email_knowledge_base USING GIN(metadata);
CREATE INDEX idx_ai_email_kb_source_dedup ON public.ai_email_knowledge_base(organization_id, source_table, source_id);

-- IVFFlat index para busca por similaridade (cosine)
CREATE INDEX idx_ai_email_kb_embedding ON public.ai_email_knowledge_base 
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- 4) RLS
ALTER TABLE public.ai_email_knowledge_base ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org knowledge base"
  ON public.ai_email_knowledge_base FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    )
  );

CREATE POLICY "Service role manages knowledge base"
  ON public.ai_email_knowledge_base FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Admins can manage org knowledge base"
  ON public.ai_email_knowledge_base FOR ALL
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active' AND role IN ('owner', 'admin')
    )
  );

-- 5) Trigger updated_at
CREATE TRIGGER trg_ai_email_kb_updated_at
  BEFORE UPDATE ON public.ai_email_knowledge_base
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) RPC de busca por similaridade
CREATE OR REPLACE FUNCTION public.match_email_knowledge(
  p_organization_id uuid,
  p_query_embedding vector(1536),
  p_pipeline_stage text DEFAULT NULL,
  p_min_quality numeric DEFAULT 0.4,
  p_match_count integer DEFAULT 5
)
RETURNS TABLE(
  id uuid,
  subject text,
  body_text text,
  metadata jsonb,
  quality_score numeric,
  similarity numeric,
  source_type text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.subject,
    kb.body_text,
    kb.metadata,
    kb.quality_score,
    (1 - (kb.embedding <=> p_query_embedding))::numeric AS similarity,
    kb.source_type
  FROM public.ai_email_knowledge_base kb
  WHERE kb.organization_id = p_organization_id
    AND kb.embedding IS NOT NULL
    AND kb.quality_score >= p_min_quality
    AND (p_pipeline_stage IS NULL OR kb.metadata->>'pipeline_stage' = p_pipeline_stage OR kb.metadata->>'pipeline_stage' IS NULL)
  ORDER BY kb.embedding <=> p_query_embedding
  LIMIT p_match_count;
END;
$$;

-- 7) RPC para incrementar uso
CREATE OR REPLACE FUNCTION public.increment_email_kb_usage(p_kb_ids uuid[])
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ai_email_knowledge_base
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = ANY(p_kb_ids);
$$;

-- 8) RPC de re-score baseado em outcome da oportunidade
CREATE OR REPLACE FUNCTION public.recalculate_email_kb_quality(p_opportunity_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  v_boost numeric := 0;
BEGIN
  SELECT status INTO v_status FROM public.opportunities WHERE id = p_opportunity_id;
  IF v_status = 'won' THEN v_boost := 0.3;
  ELSIF v_status = 'lost' THEN v_boost := -0.2;
  END IF;

  IF v_boost = 0 THEN RETURN; END IF;

  UPDATE public.ai_email_knowledge_base
  SET quality_score = GREATEST(0, LEAST(1, quality_score + v_boost)),
      metadata = metadata || jsonb_build_object('opportunity_outcome', v_status)
  WHERE opportunity_id = p_opportunity_id;
END;
$$;

-- 9) Trigger automático: ao mudar status da opp para won/lost, re-pontuar
CREATE OR REPLACE FUNCTION public.trg_recalculate_email_kb_on_opp_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('won', 'lost') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.recalculate_email_kb_quality(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_opportunity_status_kb_rescore
  AFTER UPDATE OF status ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalculate_email_kb_on_opp_status();