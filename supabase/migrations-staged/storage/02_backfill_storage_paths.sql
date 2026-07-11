-- STAGED — Backfill idempotente das colunas storage_path a partir das URLs públicas existentes.
-- Executar após 01_add_storage_path_columns.sql.

-- proposal_layouts.terms_pdf_url tem formato:
--   https://<ref>.supabase.co/storage/v1/object/public/proposal-layouts/<org>/<layout>/<file>
UPDATE public.proposal_layouts
SET storage_path = regexp_replace(terms_pdf_url, '^.*/object/(public|sign)/proposal-layouts/', '')
WHERE storage_path IS NULL
  AND terms_pdf_url IS NOT NULL
  AND terms_pdf_url ~ '/object/(public|sign)/proposal-layouts/';

UPDATE public.proposal_layout_pages
SET storage_path = regexp_replace(file_url, '^.*/object/(public|sign)/proposal-layouts/', '')
WHERE storage_path IS NULL
  AND file_url IS NOT NULL
  AND file_url ~ '/object/(public|sign)/proposal-layouts/';

-- proposals.pdf_url tem formato de signed URL contra proposal-pdfs
UPDATE public.proposals
SET pdf_storage_path = regexp_replace(pdf_url, '^.*/object/(public|sign)/proposal-pdfs/([^?]+).*', '\2')
WHERE pdf_storage_path IS NULL
  AND pdf_url IS NOT NULL
  AND pdf_url ~ '/object/(public|sign)/proposal-pdfs/';

-- Fallback: reconstruir usando convenção histórica <organization_id>/<proposal_id>.html
UPDATE public.proposals
SET pdf_storage_path = organization_id::text || '/' || id::text || '.html'
WHERE pdf_storage_path IS NULL
  AND pdf_url IS NOT NULL;

-- Auditoria
INSERT INTO public.system_events(event_type, entity_type, payload, created_at)
SELECT 'storage_backfill_paths', 'migration',
       jsonb_build_object(
         'proposal_layouts_backfilled', (SELECT count(*) FROM public.proposal_layouts WHERE storage_path IS NOT NULL),
         'proposal_layout_pages_backfilled', (SELECT count(*) FROM public.proposal_layout_pages WHERE storage_path IS NOT NULL),
         'proposals_backfilled', (SELECT count(*) FROM public.proposals WHERE pdf_storage_path IS NOT NULL)
       ),
       now();
