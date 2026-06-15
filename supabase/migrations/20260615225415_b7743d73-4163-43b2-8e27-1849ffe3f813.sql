
-- ============================================================
-- P0 HOTFIX — Qualification gate enforcement (server-side)
-- Schema additions (idempotent) + gate function + trigger + backfill
-- ============================================================

-- 1) stages.is_qualified_stage (idempotent; safe if previous partial run added it)
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS is_qualified_stage boolean NOT NULL DEFAULT false;

UPDATE public.stages
SET is_qualified_stage = true
WHERE is_qualified_stage = false
  AND (
    name ILIKE 'qualificado%'
    OR name ILIKE 'qualified%'
    OR name ILIKE 'sql%'
    OR name ILIKE 'handoff%'
    OR name ILIKE 'passagem%'
    OR name ILIKE 'pronto para venda%'
  );

-- 2) opportunities.handoff_status
ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS handoff_status text;

-- 3) custom_form_values: handoff metadata
ALTER TABLE public.custom_form_values
  ADD COLUMN IF NOT EXISTS source_opportunity_id uuid,
  ADD COLUMN IF NOT EXISTS is_readonly_handoff boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_custom_form_values_source_opportunity_id
  ON public.custom_form_values(source_opportunity_id)
  WHERE source_opportunity_id IS NOT NULL;

-- ============================================================
-- 4) Gate function
-- ============================================================
CREATE OR REPLACE FUNCTION public.crm_check_qualification_gate(_opportunity_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_opp record;
  v_values jsonb := '{}'::jsonb;
  v_blockers text[] := ARRAY[]::text[];
  v_field_map jsonb;
  v_key text;
  v_uuid text;
  v_val jsonb;
  v_by_key jsonb := '{}'::jsonb;
  v_perm text;
  v_valid_perms text[] := ARRAY['cliente_pediu_proposta','cliente_validou_escopo','cliente_confirmou_interesse'];
  v_required_keys text[] := ARRAY['nome_evento','data_evento','local_evento','conexoes_simultaneas','finalidade_uso','urgencia_real','poder_decisao','proximo_passo'];
  k text;
  v_has_account boolean;
  v_has_contact boolean;
  v_label text;
BEGIN
  SELECT o.*
  INTO v_opp
  FROM public.opportunities o
  WHERE o.id = _opportunity_id;

  IF v_opp.id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason_code', 'OPPORTUNITY_NOT_FOUND',
      'blockers', jsonb_build_array('Oportunidade não encontrada')
    );
  END IF;

  v_has_account := v_opp.account_id IS NOT NULL;
  v_has_contact := v_opp.contact_id IS NOT NULL;

  SELECT cfv.values
  INTO v_values
  FROM public.custom_form_values cfv
  JOIN public.custom_forms cf ON cf.id = cfv.custom_form_id
  WHERE cfv.entity_id = _opportunity_id
    AND cfv.entity_type = 'opportunity'
    AND (
      cf.name ILIKE 'checklist obrigat%qualifica%'
      OR cf.name ILIKE 'checklist de qualifica%'
    )
  ORDER BY cfv.updated_at DESC NULLS LAST
  LIMIT 1;

  v_values := COALESCE(v_values, '{}'::jsonb);

  SELECT jsonb_object_agg(id::text, field_key)
  INTO v_field_map
  FROM public.custom_fields
  WHERE entity_type = 'opportunity'
    AND field_key = ANY (ARRAY[
      'nome_evento','data_evento','local_evento','conexoes_simultaneas',
      'equipamentos','finalidade_uso','urgencia_real','poder_decisao',
      'proximo_passo','permissao_proposta'
    ]);
  v_field_map := COALESCE(v_field_map, '{}'::jsonb);

  FOR v_key, v_val IN SELECT * FROM jsonb_each(v_values) LOOP
    IF v_key LIKE 'custom-opportunity-%' THEN
      v_uuid := substring(v_key from length('custom-opportunity-') + 1);
    ELSIF v_key LIKE 'custom-%' THEN
      v_uuid := substring(v_key from position('-' in substring(v_key from 8)) + 8);
    ELSE
      v_uuid := v_key;
    END IF;
    IF v_field_map ? v_uuid THEN
      v_by_key := v_by_key || jsonb_build_object(v_field_map ->> v_uuid, v_val);
    END IF;
  END LOOP;

  IF NOT v_has_account THEN
    v_blockers := array_append(v_blockers, 'Nome da empresa');
  END IF;
  IF NOT v_has_contact THEN
    v_blockers := array_append(v_blockers, 'Nome do contato');
  END IF;

  FOREACH k IN ARRAY v_required_keys LOOP
    IF NOT (v_by_key ? k)
       OR v_by_key -> k IS NULL
       OR v_by_key ->> k IS NULL
       OR btrim(v_by_key ->> k) = '' THEN
      v_label := CASE k
        WHEN 'nome_evento' THEN 'Nome do evento'
        WHEN 'data_evento' THEN 'Data do evento'
        WHEN 'local_evento' THEN 'Local do evento'
        WHEN 'conexoes_simultaneas' THEN 'Quantidade de conexões'
        WHEN 'finalidade_uso' THEN 'Finalidade de uso'
        WHEN 'urgencia_real' THEN 'Urgência real'
        WHEN 'poder_decisao' THEN 'Poder ou influência'
        WHEN 'proximo_passo' THEN 'Próximo passo combinado'
        ELSE k
      END;
      v_blockers := array_append(v_blockers, v_label);
    END IF;
  END LOOP;

  v_perm := COALESCE(v_by_key ->> 'permissao_proposta', '');
  IF NOT (v_perm = ANY (v_valid_perms)) THEN
    v_blockers := array_append(v_blockers, 'Permissão real para proposta válida');
  END IF;

  RETURN jsonb_build_object(
    'ok', cardinality(v_blockers) = 0,
    'reason_code', CASE WHEN cardinality(v_blockers) = 0 THEN 'OK' ELSE 'QUALIFICATION_GATE_BLOCKED' END,
    'blockers', COALESCE(to_jsonb(v_blockers), '[]'::jsonb),
    'has_form_values', v_values <> '{}'::jsonb,
    'opportunity_id', _opportunity_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_check_qualification_gate(uuid) TO authenticated, service_role;

-- ============================================================
-- 5) Trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.trg_opportunities_qualification_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_stage record;
  v_target_pipeline record;
  v_gate jsonb;
  v_bypass text;
  v_blockers_text text;
BEGIN
  BEGIN
    v_bypass := current_setting('request.qualification_gate_bypass', true);
  EXCEPTION WHEN OTHERS THEN
    v_bypass := NULL;
  END;
  IF v_bypass = 'on' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.source_opportunity_id IS NOT NULL THEN
      SELECT * INTO v_target_pipeline FROM public.pipelines WHERE id = NEW.pipeline_id;
      IF v_target_pipeline.pipeline_type = 'sales' THEN
        v_gate := public.crm_check_qualification_gate(NEW.source_opportunity_id);
        IF NOT (v_gate ->> 'ok')::boolean THEN
          v_blockers_text := COALESCE(
            array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_gate -> 'blockers')), ', '),
            ''
          );
          RAISE EXCEPTION 'QUALIFICATION_GATE_BLOCKED: handoff para Vendas bloqueado — checklist incompleto: %', v_blockers_text
            USING ERRCODE = 'check_violation', HINT = v_gate::text;
        END IF;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL THEN
    SELECT * INTO v_target_stage FROM public.stages WHERE id = NEW.stage_id;
    IF v_target_stage.is_qualified_stage IS TRUE THEN
      v_gate := public.crm_check_qualification_gate(NEW.id);
      IF NOT (v_gate ->> 'ok')::boolean THEN
        v_blockers_text := COALESCE(
          array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_gate -> 'blockers')), ', '),
          ''
        );
        RAISE EXCEPTION 'QUALIFICATION_GATE_BLOCKED: lead não pode avançar para "%": checklist incompleto: %', v_target_stage.name, v_blockers_text
          USING ERRCODE = 'check_violation', HINT = v_gate::text;
      END IF;
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'qualified' THEN
    v_gate := public.crm_check_qualification_gate(NEW.id);
    IF NOT (v_gate ->> 'ok')::boolean THEN
      v_blockers_text := COALESCE(
        array_to_string(ARRAY(SELECT jsonb_array_elements_text(v_gate -> 'blockers')), ', '),
        ''
      );
      RAISE EXCEPTION 'QUALIFICATION_GATE_BLOCKED: lead não pode ser marcado como qualificado: %', v_blockers_text
        USING ERRCODE = 'check_violation', HINT = v_gate::text;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_opportunities_qualification_gate ON public.opportunities;
CREATE TRIGGER trg_opportunities_qualification_gate
  BEFORE INSERT OR UPDATE ON public.opportunities
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_opportunities_qualification_gate();

-- ============================================================
-- 6) Backfill handoff_status
-- ============================================================
DO $$
DECLARE
  r record;
  g jsonb;
  cur text;
BEGIN
  FOR r IN
    SELECT o.id, o.source_opportunity_id, o.handoff_status
    FROM public.opportunities o
    JOIN public.pipelines p ON p.id = o.pipeline_id
    WHERE p.pipeline_type = 'sales'
      AND o.source_opportunity_id IS NOT NULL
      AND o.deleted_at IS NULL
  LOOP
    g := public.crm_check_qualification_gate(r.source_opportunity_id);
    IF NOT (g ->> 'ok')::boolean THEN
      IF COALESCE(r.handoff_status, '') <> 'qualification_missing' THEN
        UPDATE public.opportunities SET handoff_status = 'qualification_missing' WHERE id = r.id;
      END IF;
    ELSE
      IF COALESCE(r.handoff_status, '') = '' THEN
        UPDATE public.opportunities SET handoff_status = 'approved' WHERE id = r.id;
      END IF;
    END IF;
  END LOOP;
END $$;
