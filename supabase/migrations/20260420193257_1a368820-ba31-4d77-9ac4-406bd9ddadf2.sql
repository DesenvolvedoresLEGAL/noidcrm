-- ============================================================================
-- RAG FASE 2: Busca semântica de e-mails via pgvector
-- ============================================================================

CREATE OR REPLACE FUNCTION public.match_email_knowledge(
  query_embedding vector(1536),
  p_organization_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 5,
  filter_pipeline_stage text DEFAULT NULL,
  filter_outcome text DEFAULT NULL,
  min_quality float DEFAULT 0.0
)
RETURNS TABLE (
  id uuid,
  source_type text,
  source_id uuid,
  opportunity_id uuid,
  subject text,
  body_text text,
  metadata jsonb,
  quality_score numeric,
  similarity float
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorization: caller must belong to the organization
  IF NOT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_id = p_organization_id
      AND user_id = auth.uid()
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'Access denied: user is not a member of this organization';
  END IF;

  RETURN QUERY
  SELECT
    kb.id,
    kb.source_type,
    kb.source_id,
    kb.opportunity_id,
    kb.subject,
    kb.body_text,
    kb.metadata,
    kb.quality_score,
    1 - (kb.embedding <=> query_embedding) AS similarity
  FROM public.ai_email_knowledge_base kb
  WHERE kb.organization_id = p_organization_id
    AND kb.embedding IS NOT NULL
    AND kb.quality_score >= min_quality
    AND (filter_pipeline_stage IS NULL OR kb.metadata->>'pipeline_stage' = filter_pipeline_stage)
    AND (filter_outcome IS NULL OR kb.metadata->>'opportunity_outcome' = filter_outcome)
    AND (1 - (kb.embedding <=> query_embedding)) >= match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Increment usage counter when knowledge is consumed (called by edge function)
CREATE OR REPLACE FUNCTION public.increment_email_knowledge_usage(
  knowledge_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.ai_email_knowledge_base
  SET usage_count = usage_count + 1,
      last_used_at = now()
  WHERE id = ANY(knowledge_ids)
    AND organization_id IN (
      SELECT organization_id FROM public.organization_members
      WHERE user_id = auth.uid() AND status = 'active'
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.match_email_knowledge(vector, uuid, float, int, text, text, float) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_email_knowledge_usage(uuid[]) TO authenticated;