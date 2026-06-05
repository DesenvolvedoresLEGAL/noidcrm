-- HARDEN: ensure_proposal_dynamic_pricing_current(uuid)
-- Remove acesso anônimo direto por proposal_id.
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid) FROM PUBLIC;

-- Garante grants apenas para authenticated e service_role.
GRANT EXECUTE ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.ensure_proposal_dynamic_pricing_current(uuid) IS
  'Atualiza snapshot da tabela dinâmica de uma proposta (idempotente). Acesso restrito a authenticated/service_role. Para o link público, use ensure_public_proposal_dynamic_pricing_current(text).';

-- NEW: token-gated wrapper para o link público.
-- Recebe public_token (cru OU já hashado em sha256), valida contra
-- proposals.public_token e só então chama a RPC interna.
-- Nunca aceita proposal_id diretamente do anônimo.
CREATE OR REPLACE FUNCTION public.ensure_public_proposal_dynamic_pricing_current(
  p_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_proposal_id uuid;
  v_status text;
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR length(btrim(p_token)) = 0 THEN
    RETURN jsonb_build_object(
      'refreshed', false,
      'source', 'invalid_token',
      'warning', 'token ausente'
    );
  END IF;

  -- Resolve token: aceita raw OU sha256(raw) — mesmo padrão de
  -- get_proposal_by_public_token.
  SELECT p.id, p.status
    INTO v_proposal_id, v_status
  FROM public.proposals p
  WHERE p.public_token IS NOT NULL
    AND (
      p.public_token = p_token
      OR p.public_token = encode(extensions.digest(p_token, 'sha256'), 'hex')
    )
  LIMIT 1;

  IF v_proposal_id IS NULL THEN
    RETURN jsonb_build_object(
      'refreshed', false,
      'source', 'not_found',
      'warning', 'token inválido'
    );
  END IF;

  -- Só executa para status que ainda permitem visualização pública e edição
  -- de preço. Aceitas/rejeitadas/expiradas ficam congeladas — devolve no-op.
  IF v_status NOT IN ('draft', 'open', 'sent', 'viewed', 'pending_approval') THEN
    RETURN jsonb_build_object(
      'proposal_id', v_proposal_id,
      'refreshed', false,
      'source', 'frozen_or_closed',
      'warning', null
    );
  END IF;

  -- Delegação para a RPC interna (já SECURITY DEFINER, idempotente).
  SELECT public.ensure_proposal_dynamic_pricing_current(v_proposal_id)
    INTO v_result;

  RETURN COALESCE(v_result, jsonb_build_object(
    'proposal_id', v_proposal_id,
    'refreshed', false,
    'source', 'no_result',
    'warning', null
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_public_proposal_dynamic_pricing_current(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.ensure_public_proposal_dynamic_pricing_current(text)
  TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.ensure_public_proposal_dynamic_pricing_current(text) IS
  'Wrapper público (link da proposta) para atualização da tabela dinâmica. Valida o public_token antes de executar — nunca aceita proposal_id direto do anon.';
