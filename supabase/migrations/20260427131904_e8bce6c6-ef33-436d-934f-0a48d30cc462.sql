-- Sprint A: ajustes finos
ALTER TABLE public.enrichment_runs
  ADD COLUMN IF NOT EXISTS missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS quality_label TEXT CHECK (quality_label IN ('high_confidence','usable','low_confidence','insufficient')),
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

ALTER TABLE public.enrichment_normalized
  ADD COLUMN IF NOT EXISTS missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS quality_label TEXT CHECK (quality_label IN ('high_confidence','usable','low_confidence','insufficient')),
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;