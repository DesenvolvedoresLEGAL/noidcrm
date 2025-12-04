-- Sprint D: Add terms_pdf_url column to proposal_layouts
ALTER TABLE public.proposal_layouts 
ADD COLUMN IF NOT EXISTS terms_pdf_url TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.proposal_layouts.terms_pdf_url IS 'URL do PDF com os termos/contrato deste layout';