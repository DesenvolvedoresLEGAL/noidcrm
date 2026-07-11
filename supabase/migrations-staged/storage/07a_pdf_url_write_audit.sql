-- STAGED — Etapa 1 (observabilidade): audita QUALQUER escrita em proposals.pdf_url
-- Objetivo: identificar frontends, RPCs, webhooks e Edge Functions que ainda escrevem
-- diretamente na coluna, ANTES de ativar o enforcement (07b).
--
-- Regras:
-- - NÃO bloqueia writes; apenas registra origem em system_events.
-- - NUNCA persiste token, JWT ou signed URL completa.
-- - Registra apenas metadados sanitizados (role, hash do valor, comprimento, TG_OP).
-- - Aplicar somente em staging até validar cobertura dos fluxos.

CREATE OR REPLACE FUNCTION public.tg_audit_pdf_url_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _role text;
  _actor uuid;
  _len int;
  _hash text;
BEGIN
  IF NEW.pdf_url IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.pdf_url IS NOT DISTINCT FROM OLD.pdf_url THEN
    RETURN NEW;
  END IF;

  _role := coalesce(current_setting('request.jwt.claim.role', true), 'unknown');
  BEGIN
    _actor := nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    _actor := NULL;
  END;
  _len := length(NEW.pdf_url);
  -- Hash truncado (sem armazenar a URL completa). Usa MD5 apenas como fingerprint não reversível a partir do log.
  _hash := left(md5(NEW.pdf_url), 12);

  INSERT INTO public.system_events(event_type, entity_type, entity_id, payload, created_at, organization_id)
  VALUES (
    'proposals_pdf_url_write_observed',
    'proposal',
    NEW.id,
    jsonb_build_object(
      'op', TG_OP,
      'role', _role,
      'actor_user_id', _actor,
      'url_len', _len,
      'url_fingerprint', _hash,
      'has_signed_marker', (position('/object/sign/' in NEW.pdf_url) > 0),
      'has_public_marker', (position('/object/public/' in NEW.pdf_url) > 0)
    ),
    now(),
    NEW.organization_id
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_pdf_url_writes ON public.proposals;
CREATE TRIGGER trg_audit_pdf_url_writes
BEFORE INSERT OR UPDATE OF pdf_url ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.tg_audit_pdf_url_writes();

COMMENT ON FUNCTION public.tg_audit_pdf_url_writes() IS
  'Etapa 1 de deprecação de proposals.pdf_url. Somente observabilidade — não bloqueia writes. Nunca registra a URL completa, JWT ou service_role.';
