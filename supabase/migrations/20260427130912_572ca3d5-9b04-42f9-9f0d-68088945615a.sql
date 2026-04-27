-- Sprint A: Harden do Enrichment

-- 1. Estender enrichment_runs
ALTER TABLE public.enrichment_runs
  ADD COLUMN IF NOT EXISTS quality_score INT,
  ADD COLUMN IF NOT EXISTS quality_grade TEXT CHECK (quality_grade IN ('A','B','C','D')),
  ADD COLUMN IF NOT EXISTS fallback_used BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS content_length INT,
  ADD COLUMN IF NOT EXISTS fallback_pages_fetched JSONB NOT NULL DEFAULT '[]'::jsonb;

-- 2. Nova tabela enrichment_raw_sources
CREATE TABLE IF NOT EXISTS public.enrichment_raw_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  enrichment_run_id UUID REFERENCES public.enrichment_runs(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  url TEXT,
  raw_content TEXT,
  content_length INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_raw_sources_org_prospect
  ON public.enrichment_raw_sources(organization_id, prospect_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_raw_sources_run
  ON public.enrichment_raw_sources(enrichment_run_id);

ALTER TABLE public.enrichment_raw_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_enrichment_raw_sources"
  ON public.enrichment_raw_sources FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_insert_enrichment_raw_sources"
  ON public.enrichment_raw_sources FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

-- 3. Nova tabela enrichment_normalized
CREATE TABLE IF NOT EXISTS public.enrichment_normalized (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES public.prospects(id) ON DELETE CASCADE,
  enrichment_run_id UUID REFERENCES public.enrichment_runs(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  confidence_score INT,
  quality_grade TEXT CHECK (quality_grade IN ('A','B','C','D')),
  fallback_used BOOLEAN NOT NULL DEFAULT false,
  content_length INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_normalized_org_prospect
  ON public.enrichment_normalized(organization_id, prospect_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enrichment_normalized_run
  ON public.enrichment_normalized(enrichment_run_id);

ALTER TABLE public.enrichment_normalized ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_members_select_enrichment_normalized"
  ON public.enrichment_normalized FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "org_members_insert_enrichment_normalized"
  ON public.enrichment_normalized FOR INSERT
  WITH CHECK (organization_id IN (
    SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid()
  ));