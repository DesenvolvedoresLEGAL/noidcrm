-- STAGED — Impede persistência de signed URL de longa duração em proposals.pdf_url.
-- Permite apenas service_role atualizar (temporário, até coluna ser removida em release seguinte).

CREATE OR REPLACE FUNCTION public.tg_block_pdf_url_persistence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pdf_url IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.pdf_url IS DISTINCT FROM OLD.pdf_url)
     AND current_setting('request.jwt.claim.role', true) <> 'service_role' THEN
    RAISE EXCEPTION 'proposals.pdf_url is deprecated. Use resolve_proposal_pdf_path + signed URL edge function.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_pdf_url_persistence ON public.proposals;
CREATE TRIGGER trg_block_pdf_url_persistence
BEFORE INSERT OR UPDATE OF pdf_url ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_block_pdf_url_persistence();

COMMENT ON COLUMN public.proposals.pdf_url IS
  'DEPRECATED — não persistir. Usar public.resolve_proposal_pdf_path + edge function get-proposal-pdf-signed-url.';
