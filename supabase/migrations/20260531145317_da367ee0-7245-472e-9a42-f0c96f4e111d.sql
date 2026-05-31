
-- 1. Add status/publishing columns to release_notes
ALTER TABLE public.release_notes
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS generated_by text,
  ADD COLUMN IF NOT EXISTS source_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.release_notes
  DROP CONSTRAINT IF EXISTS release_notes_status_check;
ALTER TABLE public.release_notes
  ADD CONSTRAINT release_notes_status_check
  CHECK (status IN ('draft','published','discarded'));

-- Backfill existing rows as published
UPDATE public.release_notes
SET published_at = COALESCE(published_at, created_at)
WHERE status = 'published' AND published_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_release_notes_status ON public.release_notes(status);

-- 2. Public view (only published)
CREATE OR REPLACE VIEW public.v_release_notes_public AS
SELECT id, version, title, description, release_date, changes, is_major,
       organization_id, created_at, published_at
FROM public.release_notes
WHERE status = 'published';

GRANT SELECT ON public.v_release_notes_public TO anon, authenticated;

-- 3. Ingestion log
CREATE TABLE IF NOT EXISTS public.release_notes_ingestion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('github','system_events','action_executions','migrations','ai_runs')),
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  included_in_release uuid REFERENCES public.release_notes(id) ON DELETE SET NULL,
  ingested_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_release_ingestion_source_external
  ON public.release_notes_ingestion_log(source, external_id);
CREATE INDEX IF NOT EXISTS idx_release_ingestion_release
  ON public.release_notes_ingestion_log(included_in_release);

GRANT SELECT ON public.release_notes_ingestion_log TO authenticated;
GRANT ALL ON public.release_notes_ingestion_log TO service_role;

ALTER TABLE public.release_notes_ingestion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Platform admins read ingestion log"
  ON public.release_notes_ingestion_log FOR SELECT TO authenticated
  USING (public.is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Service role manages ingestion log"
  ON public.release_notes_ingestion_log FOR ALL TO service_role
  USING (true) WITH CHECK (true);
