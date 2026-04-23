
-- ============================================================
-- Fase 1: Função SQL determinística CNAE → Segmento
-- Espelha src/lib/cnae-to-segmento.ts
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_cnae_to_segmento(p_cnae TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  digits TEXT;
  division INT;
  grp INT;
  klass INT;
BEGIN
  IF p_cnae IS NULL THEN RETURN NULL; END IF;
  digits := regexp_replace(p_cnae, '\D', '', 'g');
  IF length(digits) < 2 THEN RETURN NULL; END IF;

  division := substring(digits, 1, 2)::INT;
  grp := CASE WHEN length(digits) >= 3 THEN substring(digits, 1, 3)::INT ELSE NULL END;
  klass := CASE WHEN length(digits) >= 4 THEN substring(digits, 1, 4)::INT ELSE NULL END;

  -- Special cases (mais específicos que divisão)
  IF grp IN (731, 732) THEN RETURN 'Marketing'; END IF;
  IF klass = 8230 THEN RETURN 'Eventos'; END IF;
  IF klass = 5620 THEN RETURN 'Eventos'; END IF;

  -- Division-based
  IF division BETWEEN 1 AND 3 THEN RETURN 'Agronegócio'; END IF;
  IF division BETWEEN 5 AND 9 THEN RETURN 'Indústria'; END IF;
  IF division BETWEEN 10 AND 33 THEN RETURN 'Indústria'; END IF;
  IF division BETWEEN 35 AND 39 THEN RETURN 'Indústria'; END IF;
  IF division BETWEEN 41 AND 43 THEN RETURN 'Construção'; END IF;
  IF division IN (45, 46) THEN RETURN 'Comércio'; END IF;
  IF division = 47 THEN RETURN 'Varejo'; END IF;
  IF division BETWEEN 49 AND 53 THEN RETURN 'Serviços'; END IF;
  IF division = 55 THEN RETURN 'Serviços'; END IF;
  IF division = 56 THEN RETURN 'Serviços'; END IF;
  IF division BETWEEN 58 AND 63 THEN RETURN 'Tecnologia'; END IF;
  IF division BETWEEN 64 AND 66 THEN RETURN 'Financeiro'; END IF;
  IF division = 68 THEN RETURN 'Serviços'; END IF;
  IF division BETWEEN 69 AND 75 THEN RETURN 'Serviços'; END IF;
  IF division BETWEEN 77 AND 82 THEN RETURN 'Serviços'; END IF;
  IF division = 85 THEN RETURN 'Educação'; END IF;
  IF division BETWEEN 86 AND 88 THEN RETURN 'Saúde'; END IF;
  IF division BETWEEN 90 AND 93 THEN RETURN 'Eventos'; END IF;
  IF division BETWEEN 94 AND 96 THEN RETURN 'Serviços'; END IF;

  RETURN 'Outro';
END;
$$;

-- ============================================================
-- Fase 3: Inferência por palavras-chave no nome (fallback)
-- ============================================================
CREATE OR REPLACE FUNCTION public.fn_infer_segmento_from_name(p_nome TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  n TEXT;
BEGIN
  IF p_nome IS NULL THEN RETURN NULL; END IF;
  -- normaliza: minúsculo + sem acento
  n := lower(translate(p_nome,
    'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
    'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'));

  -- Saúde
  IF n ~ '\m(clinica|hospital|odontolog|odonto|saude|medic|farmac|laborator|fisioterapia|psicolog|veterinar|estetic|dermatolog|oftalmol|cardiolog)\M' THEN
    RETURN 'Saúde';
  END IF;
  -- Educação
  IF n ~ '\m(escola|colegio|universidade|faculdade|curso|educac|ensino|treinamento|aprendiz|capacitac|idiomas)\M' THEN
    RETURN 'Educação';
  END IF;
  -- Construção
  IF n ~ '\m(construtor|construc|engenharia|incorporador|empreiteir|edificac|obras|reformas)\M' THEN
    RETURN 'Construção';
  END IF;
  -- Tecnologia
  IF n ~ '\m(tech|tecnolog|software|sistemas|digital|ti |inform|dev |solutions|labs|app |startup|cloud|data |ia |ai |bytes|code|web |dev$|tic )\M' THEN
    RETURN 'Tecnologia';
  END IF;
  -- Marketing
  IF n ~ '\m(marketing|publicidade|propaganda|midia|agencia|comunicac|branding|design|criat|mkt)\M' THEN
    RETURN 'Marketing';
  END IF;
  -- Eventos
  IF n ~ '\m(eventos|buffet|festas|cerimonial|producoes|show|entreteniment|turism|viagens)\M' THEN
    RETURN 'Eventos';
  END IF;
  -- Financeiro
  IF n ~ '\m(banco|financeir|credito|investiment|seguros|seguradora|corretor|contabil|consultor.*financ|fintech)\M' THEN
    RETURN 'Financeiro';
  END IF;
  -- Indústria
  IF n ~ '\m(industria|industrial|fabrica|metalurgic|quimic|plastic|textil|alimentos|laticini|frigorific|usina|manufatur)\M' THEN
    RETURN 'Indústria';
  END IF;
  -- Agronegócio
  IF n ~ '\m(agro|agronegocio|fazenda|rural|agricola|pecuari|sementes|insumos|cooperativa)\M' THEN
    RETURN 'Agronegócio';
  END IF;
  -- Varejo
  IF n ~ '\m(loja|magazine|mercado|supermercado|varejo|store|shop|boutique|atacado|distribuidor)\M' THEN
    RETURN 'Varejo';
  END IF;
  -- Comércio
  IF n ~ '\m(comercio|comercial|representac|importac|exportac)\M' THEN
    RETURN 'Comércio';
  END IF;
  -- Serviços (catch-all específico)
  IF n ~ '\m(servic|consultori|assessori|advocac|advogad|escritorio|logistic|transport|seguranc|limpeza|manutenc)\M' THEN
    RETURN 'Serviços';
  END IF;

  RETURN NULL; -- sem match → não preenche
END;
$$;

-- ============================================================
-- Aplicar backfill
-- ============================================================

-- 1) Contas com CNAE: usa CNAE → Segmento (sobrescreve)
UPDATE public.accounts
SET segmento = public.fn_cnae_to_segmento(cnae),
    updated_at = now()
WHERE deleted_at IS NULL
  AND cnae IS NOT NULL
  AND public.fn_cnae_to_segmento(cnae) IS NOT NULL
  AND (segmento IS DISTINCT FROM public.fn_cnae_to_segmento(cnae));

-- 2) Contas com CNPJ mas sem CNAE: tenta inferir pelo nome (não sobrescreve se já houver segmento válido)
UPDATE public.accounts
SET segmento = public.fn_infer_segmento_from_name(razao_social),
    updated_at = now()
WHERE deleted_at IS NULL
  AND cnpj IS NOT NULL
  AND cnae IS NULL
  AND public.fn_infer_segmento_from_name(razao_social) IS NOT NULL;

-- 3) Contas SEM CNPJ: heurística por nome só preenche os vazios (preserva manuais)
UPDATE public.accounts
SET segmento = public.fn_infer_segmento_from_name(razao_social),
    updated_at = now()
WHERE deleted_at IS NULL
  AND cnpj IS NULL
  AND (segmento IS NULL OR segmento = '')
  AND public.fn_infer_segmento_from_name(razao_social) IS NOT NULL;
