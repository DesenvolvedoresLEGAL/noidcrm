-- Convert pipeline_ids columns from uuid[] to text[] to support non-uuid legacy pipeline ids.
ALTER TABLE public.loss_reasons
  ALTER COLUMN pipeline_ids TYPE text[]
  USING pipeline_ids::text[];

ALTER TABLE public.win_reasons
  ALTER COLUMN pipeline_ids TYPE text[]
  USING pipeline_ids::text[];

-- Recreate function with text pipeline ids.
CREATE OR REPLACE FUNCTION public.apply_loss_win_reasons_scope_matrix(p_org_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_qual_pipeline_id text;
  v_sales_pipeline_id text;
  v_loss_matrix jsonb := '[
    {"name":"Sem evento definido","scope":"qual","category":"no_fit","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Sem data do evento","scope":"qual","category":"no_fit","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Sem local definido","scope":"qual","category":"no_fit","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Sem escopo mínimo","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":true},
    {"name":"Sem quantidade de conexões","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":true},
    {"name":"Sem finalidade clara de uso","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":true},
    {"name":"Sem urgência real","scope":"qual","category":"timing","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Sem decisor ou influência","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":false},
    {"name":"Sem próximo passo","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":false},
    {"name":"Cliente apenas pesquisando","scope":"qual","category":"timing","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Pedido genérico de preço","scope":"qual","category":"sales_process","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":false},
    {"name":"Baixa maturidade","scope":"qual","category":"no_fit","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":true},
    {"name":"Não respondeu após contato","scope":"qual","category":"sales_process","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Não visualizou proposta","scope":"qual","category":"sales_process","audience":"seller","accountability":"client","type":"disqualification","remarketing":true},
    {"name":"Fora do ICP","scope":"qual","category":"no_fit","audience":"seller","accountability":"commercial","type":"disqualification","remarketing":false},
    {"name":"Cliente muito pequeno","scope":"qual","category":"no_fit","audience":"seller","accountability":"client","type":"disqualification","remarketing":false},
    {"name":"Classificação obrigatória pendente","scope":"qual","category":"operational","audience":"seller","accountability":"unknown","type":"disqualification","remarketing":false},
    {"name":"Preço acima do orçamento","scope":"sales","category":"price","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Preço fora do orçamento","scope":"sales","category":"price","audience":"client","accountability":"market","type":"lost"},
    {"name":"Preço inviável","scope":"sales","category":"price","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Não percebeu valor suficiente","scope":"sales","category":"price","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Comprou com solução inferior","scope":"sales","category":"price","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Fechou com concorrente direto","scope":"sales","category":"competition","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Fechou com a internet do local","scope":"sales","category":"competition","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Fechou com homologada","scope":"sales","category":"competition","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Influência do organizador","scope":"sales","category":"competition","audience":"seller","accountability":"market","type":"lost"},
    {"name":"Já fechei com outro fornecedor","scope":"sales","category":"competition","audience":"client","accountability":"market","type":"lost"},
    {"name":"Perda do projeto/cliente","scope":"sales","category":"competition","audience":"both","accountability":"market","type":"lost"},
    {"name":"Evento cancelado","scope":"sales","category":"timing","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Evento adiado","scope":"sales","category":"timing","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Prazo expirado","scope":"sales","category":"timing","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Chegamos tarde no processo","scope":"sales","category":"timing","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Falta de tempo / urgência","scope":"sales","category":"timing","audience":"client","accountability":"client","type":"lost"},
    {"name":"Não era prioridade","scope":"sales","category":"timing","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Não preciso mais da solução","scope":"sales","category":"timing","audience":"client","accountability":"client","type":"lost"},
    {"name":"Não vou mais realizar o evento","scope":"sales","category":"timing","audience":"client","accountability":"client","type":"lost"},
    {"name":"Condição de pagamento incompatível","scope":"sales","category":"sales_process","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Não conseguimos avançar reunião","scope":"sales","category":"sales_process","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Não conseguimos falar com decisor","scope":"sales","category":"sales_process","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Parou de responder","scope":"sales","category":"sales_process","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Proposta não visualizada","scope":"sales","category":"sales_process","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Sumiu após envio da proposta","scope":"sales","category":"sales_process","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Sem budget aprovado","scope":"sales","category":"price","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Erro na proposta","scope":"sales","category":"internal","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Demora no atendimento","scope":"sales","category":"internal","audience":"seller","accountability":"commercial","type":"lost"},
    {"name":"Falha técnica","scope":"sales","category":"internal","audience":"seller","accountability":"operations","type":"lost"},
    {"name":"Estoque esgotado","scope":"sales","category":"internal","audience":"seller","accountability":"operations","type":"lost"},
    {"name":"Equipe despreparada","scope":"sales","category":"operational","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Falta de planejamento","scope":"sales","category":"operational","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Infraestrutura indisponível","scope":"sales","category":"operational","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Problema em equipamento","scope":"sales","category":"operational","audience":"seller","accountability":"operations","type":"lost"},
    {"name":"Sem necessidade de internet","scope":"sales","category":"operational","audience":"both","accountability":"operations","type":"lost"},
    {"name":"Utilização de equipamento próprio","scope":"sales","category":"operational","audience":"both","accountability":"operations","type":"lost"},
    {"name":"Outro","scope":"all","category":"other","audience":"seller","accountability":"unknown","type":"lost"},
    {"name":"Não precisa da solução","scope":"all","category":"no_fit","audience":"seller","accountability":"client","type":"lost"},
    {"name":"Não precisa mais da solução","scope":"all","category":"no_fit","audience":"seller","accountability":"client","type":"lost"}
  ]'::jsonb;
  v_win_matrix jsonb := '[
    {"name":"Agilidade no retorno","scope":"sales","category":"service","audience":"both"},
    {"name":"Confiança na marca","scope":"sales","category":"brand","audience":"both"},
    {"name":"Indicação/Referência","scope":"sales","category":"relationship","audience":"both"},
    {"name":"Melhor atendimento","scope":"sales","category":"service","audience":"both"},
    {"name":"Melhor custo-benefício","scope":"sales","category":"price","audience":"both"},
    {"name":"Menor risco percebido","scope":"sales","category":"brand","audience":"both"},
    {"name":"Prazo de instalação/implantação","scope":"sales","category":"timing","audience":"both"},
    {"name":"Produto/Serviço superior","scope":"sales","category":"product","audience":"both"},
    {"name":"Proposta mais clara e profissional","scope":"sales","category":"service","audience":"both"},
    {"name":"Relacionamento com vendedor","scope":"sales","category":"relationship","audience":"both"},
    {"name":"Sem concorrência","scope":"sales","category":"other","audience":"both"},
    {"name":"Suporte durante o projeto/evento","scope":"sales","category":"service","audience":"both"},
    {"name":"Timing/Urgência","scope":"sales","category":"timing","audience":"both"},
    {"name":"Qualificação aprovada","scope":"qual","category":"other","audience":"seller"}
  ]'::jsonb;
  v_item jsonb;
  v_existing record;
  v_target_pipeline text;
  v_target_ids text[];
  v_created jsonb := '[]'::jsonb;
  v_updated jsonb := '[]'::jsonb;
  v_unmapped jsonb := '[]'::jsonb;
  v_still_all jsonb := '[]'::jsonb;
  v_summary_loss jsonb;
  v_summary_win jsonb;
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'org_id is required';
  END IF;

  SELECT id INTO v_qual_pipeline_id
  FROM pipelines
  WHERE organization_id::text = p_org_id::text AND pipeline_type = 'qualification'
  ORDER BY created_at ASC LIMIT 1;

  SELECT id INTO v_sales_pipeline_id
  FROM pipelines
  WHERE organization_id::text = p_org_id::text AND pipeline_type = 'sales'
  ORDER BY created_at ASC LIMIT 1;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_loss_matrix) LOOP
    v_target_ids := NULL;
    IF v_item->>'scope' = 'qual' THEN
      v_target_pipeline := v_qual_pipeline_id;
      IF v_target_pipeline IS NOT NULL THEN v_target_ids := ARRAY[v_target_pipeline]; END IF;
    ELSIF v_item->>'scope' = 'sales' THEN
      v_target_pipeline := v_sales_pipeline_id;
      IF v_target_pipeline IS NOT NULL THEN v_target_ids := ARRAY[v_target_pipeline]; END IF;
    ELSE
      v_target_ids := NULL;
    END IF;

    SELECT * INTO v_existing
    FROM loss_reasons
    WHERE organization_id = p_org_id
      AND lower(unaccent(name)) = lower(unaccent(v_item->>'name'))
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      IF v_item->>'scope' = 'qual' AND v_qual_pipeline_id IS NOT NULL THEN
        INSERT INTO loss_reasons (
          organization_id, name, is_active, pipeline_ids,
          audience, category, loss_accountability,
          reason_type, send_to_remarketing_default
        ) VALUES (
          p_org_id, v_item->>'name', true, v_target_ids,
          v_item->>'audience', v_item->>'category', v_item->>'accountability',
          v_item->>'type', COALESCE((v_item->>'remarketing')::boolean, false)
        );
        v_created := v_created || jsonb_build_array(v_item->>'name');
      ELSE
        v_unmapped := v_unmapped || jsonb_build_array(v_item->>'name' || ' (não existe e fora do escopo PRÉ VENDAS auto)');
      END IF;
    ELSE
      UPDATE loss_reasons SET
        pipeline_ids = v_target_ids,
        category = COALESCE(NULLIF(v_item->>'category',''), category),
        audience = v_item->>'audience',
        loss_accountability = COALESCE(NULLIF(v_item->>'accountability',''), loss_accountability),
        reason_type = v_item->>'type',
        send_to_remarketing_default = COALESCE(
          (v_item->>'remarketing')::boolean,
          send_to_remarketing_default
        )
      WHERE id = v_existing.id;
      v_updated := v_updated || jsonb_build_array(v_item->>'name');
    END IF;
  END LOOP;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_win_matrix) LOOP
    v_target_ids := NULL;
    IF v_item->>'scope' = 'qual' THEN
      v_target_pipeline := v_qual_pipeline_id;
      IF v_target_pipeline IS NOT NULL THEN v_target_ids := ARRAY[v_target_pipeline]; END IF;
    ELSIF v_item->>'scope' = 'sales' THEN
      v_target_pipeline := v_sales_pipeline_id;
      IF v_target_pipeline IS NOT NULL THEN v_target_ids := ARRAY[v_target_pipeline]; END IF;
    END IF;

    SELECT id, is_active, category, audience INTO v_existing
    FROM win_reasons
    WHERE organization_id = p_org_id
      AND lower(unaccent(name)) = lower(unaccent(v_item->>'name'))
    ORDER BY is_active DESC, created_at ASC
    LIMIT 1;

    IF v_existing.id IS NULL THEN
      IF v_target_ids IS NOT NULL THEN
        BEGIN
          INSERT INTO win_reasons (organization_id, name, is_active, pipeline_ids, audience, category)
          VALUES (p_org_id, v_item->>'name', true, v_target_ids, v_item->>'audience', v_item->>'category');
          v_created := v_created || jsonb_build_array('[win] ' || (v_item->>'name'));
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      ELSE
        v_unmapped := v_unmapped || jsonb_build_array('[win] ' || (v_item->>'name'));
      END IF;
    ELSE
      UPDATE win_reasons SET
        pipeline_ids = v_target_ids,
        category = COALESCE(NULLIF(v_item->>'category',''), category),
        audience = v_item->>'audience'
      WHERE id = v_existing.id;
      v_updated := v_updated || jsonb_build_array('[win] ' || (v_item->>'name'));
    END IF;
  END LOOP;

  SELECT jsonb_agg(name ORDER BY name) INTO v_still_all
  FROM loss_reasons
  WHERE organization_id = p_org_id
    AND (pipeline_ids IS NULL OR cardinality(pipeline_ids) = 0)
    AND is_active = true;

  SELECT jsonb_build_object(
    'qual', COUNT(*) FILTER (WHERE v_qual_pipeline_id = ANY(COALESCE(pipeline_ids, ARRAY[]::text[]))),
    'sales', COUNT(*) FILTER (WHERE v_sales_pipeline_id = ANY(COALESCE(pipeline_ids, ARRAY[]::text[]))),
    'all_funnels', COUNT(*) FILTER (WHERE pipeline_ids IS NULL OR cardinality(pipeline_ids) = 0),
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active),
    'disqualification', COUNT(*) FILTER (WHERE reason_type = 'disqualification'),
    'lost', COUNT(*) FILTER (WHERE reason_type = 'lost' OR reason_type IS NULL)
  ) INTO v_summary_loss
  FROM loss_reasons WHERE organization_id = p_org_id;

  SELECT jsonb_build_object(
    'qual', COUNT(*) FILTER (WHERE v_qual_pipeline_id = ANY(COALESCE(pipeline_ids, ARRAY[]::text[]))),
    'sales', COUNT(*) FILTER (WHERE v_sales_pipeline_id = ANY(COALESCE(pipeline_ids, ARRAY[]::text[]))),
    'all_funnels', COUNT(*) FILTER (WHERE pipeline_ids IS NULL OR cardinality(pipeline_ids) = 0),
    'total', COUNT(*),
    'active', COUNT(*) FILTER (WHERE is_active)
  ) INTO v_summary_win
  FROM win_reasons WHERE organization_id = p_org_id;

  RETURN jsonb_build_object(
    'org_id', p_org_id,
    'qual_pipeline_id', v_qual_pipeline_id,
    'sales_pipeline_id', v_sales_pipeline_id,
    'created', v_created,
    'updated', v_updated,
    'unmapped', v_unmapped,
    'still_all_funnels', COALESCE(v_still_all, '[]'::jsonb),
    'summary_loss_reasons', v_summary_loss,
    'summary_win_reasons', v_summary_win
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_loss_win_reasons_scope_matrix(uuid) TO authenticated;

-- Update seed_pre_sales_disqualification_reasons signature too (p_pipeline_id should accept text)
DROP FUNCTION IF EXISTS public.seed_pre_sales_disqualification_reasons(uuid, uuid);

CREATE OR REPLACE FUNCTION public.seed_pre_sales_disqualification_reasons(
  p_org_id uuid,
  p_pipeline_id text
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reasons jsonb := '[
    {"name":"Sem evento definido","accountability":"client","remarketing":true},
    {"name":"Sem data do evento","accountability":"client","remarketing":true},
    {"name":"Sem local definido","accountability":"client","remarketing":true},
    {"name":"Sem escopo mínimo","accountability":"commercial","remarketing":true},
    {"name":"Sem quantidade de conexões","accountability":"commercial","remarketing":true},
    {"name":"Sem finalidade clara de uso","accountability":"commercial","remarketing":true},
    {"name":"Sem urgência real","accountability":"client","remarketing":true},
    {"name":"Sem decisor ou influência","accountability":"commercial","remarketing":false},
    {"name":"Sem próximo passo","accountability":"commercial","remarketing":false},
    {"name":"Cliente apenas pesquisando","accountability":"client","remarketing":true},
    {"name":"Pedido genérico de preço","accountability":"commercial","remarketing":false},
    {"name":"Baixa maturidade","accountability":"commercial","remarketing":true},
    {"name":"Não respondeu após contato","accountability":"client","remarketing":true},
    {"name":"Não visualizou proposta","accountability":"client","remarketing":true},
    {"name":"Fora do ICP","accountability":"commercial","remarketing":false},
    {"name":"Cliente muito pequeno","accountability":"client","remarketing":false},
    {"name":"Classificação obrigatória pendente","accountability":"unknown","remarketing":false}
  ]'::jsonb;
  v_item jsonb;
  v_inserted integer := 0;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_reasons) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM loss_reasons
      WHERE organization_id = p_org_id
        AND lower(unaccent(name)) = lower(unaccent(v_item->>'name'))
    ) THEN
      INSERT INTO loss_reasons (
        organization_id, name, is_active, pipeline_ids,
        audience, category, loss_accountability,
        reason_type, send_to_remarketing_default
      ) VALUES (
        p_org_id, v_item->>'name', true, ARRAY[p_pipeline_id],
        'seller', 'no_fit', v_item->>'accountability',
        'disqualification', COALESCE((v_item->>'remarketing')::boolean, false)
      );
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;
  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_pre_sales_disqualification_reasons(uuid, text) TO authenticated;