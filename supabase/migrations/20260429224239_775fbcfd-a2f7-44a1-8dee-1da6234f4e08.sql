ALTER TABLE public.enrichment_jobs
  ADD COLUMN IF NOT EXISTS estimated_credits INT,
  ADD COLUMN IF NOT EXISTS trigger_source TEXT,
  ADD COLUMN IF NOT EXISTS skip_reason TEXT,
  ADD COLUMN IF NOT EXISTS response_summary JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_enrichment_jobs_prospect_created
  ON public.enrichment_jobs (prospect_id, created_at DESC);