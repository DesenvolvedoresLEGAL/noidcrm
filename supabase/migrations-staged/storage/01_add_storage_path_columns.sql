-- STAGED — NÃO aplicar em produção antes de staging + aprovação.
-- Adiciona colunas de storage_path para migrar de public URL para signed URL sob demanda.

ALTER TABLE public.proposal_layouts
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.proposal_layout_pages
  ADD COLUMN IF NOT EXISTS storage_path text;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS pdf_storage_path text;

COMMENT ON COLUMN public.proposal_layouts.storage_path IS
  'Caminho relativo dentro do bucket proposal-layouts. Fonte de verdade após privatização; substituir uso de terms_pdf_url.';

COMMENT ON COLUMN public.proposal_layout_pages.storage_path IS
  'Caminho relativo dentro do bucket proposal-layouts. Fonte de verdade após privatização; substituir uso de file_url.';

COMMENT ON COLUMN public.proposals.pdf_storage_path IS
  'Caminho relativo dentro do bucket proposal-pdfs. Fonte de verdade — nunca persistir signed URL.';
