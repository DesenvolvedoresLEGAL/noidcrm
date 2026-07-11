-- STAGED — Etapa 2 (enforcement): bloqueia escritas diretas em proposals.pdf_url.
-- PRÉ-REQUISITOS (obrigatórios antes de aplicar):
--   1. 07a_pdf_url_write_audit.sql aplicado em staging.
--   2. Todos os fluxos (criação, atualização, envio, visualização, PDF) executados.
--   3. Consulta em system_events.event_type='proposals_pdf_url_write_observed' confirma
--      que APENAS role=service_role escreve na coluna.
--   4. Teste de regressão adicionado garantindo que role='authenticated' não consegue
--      alterar pdf_url (via RLS + trigger).
--
-- Rollback: DROP TRIGGER trg_block_pdf_url_persistence ON public.proposals;

CREATE OR REPLACE FUNCTION public.tg_block_pdf_url_persistence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
BEGIN
  IF NEW.pdf_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.pdf_url IS NOT DISTINCT FROM OLD.pdf_url THEN
    RETURN NEW;
  END IF;

  _role := coalesce(current_setting('request.jwt.claim.role', true), 'unknown');

  IF _role <> 'service_role' THEN
    RAISE EXCEPTION
      'proposals.pdf_url is deprecated and cannot be written by role=%. Use resolve_proposal_pdf_path + signed URL edge function.',
      _role
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
  'DEPRECATED — não persistir. Usar public.resolve_proposal_pdf_path + edge function get-proposal-pdf-signed-url. Writes fora de service_role bloqueados pelo trigger trg_block_pdf_url_persistence.';
