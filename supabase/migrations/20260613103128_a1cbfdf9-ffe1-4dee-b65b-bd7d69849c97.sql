
CREATE OR REPLACE FUNCTION public.apply_qualification_template_legal()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org UUID;
  v_user UUID;
  v_fw UUID;
  v_c_evento UUID;
  v_c_demanda UUID;
  v_c_data_local UUID;
  v_c_urgencia UUID;
  v_c_poder UUID;
  v_c_proximo UUID;
  v_c_permissao UUID;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization_not_found';
  END IF;

  -- Replace previous LEGAL template for this org (idempotent)
  DELETE FROM public.qualification_frameworks
   WHERE organization_id = v_org AND template_key = 'legal_eventos_conectividade';

  INSERT INTO public.qualification_frameworks (
    organization_id, name, description, is_active,
    minimum_score_to_advance, template_key, created_by, updated_by, metadata
  ) VALUES (
    v_org,
    'Régua de Qualificação LEGAL',
    'Régua oficial para qualificação de oportunidades de eventos e conectividade.',
    false,
    75,
    'legal_eventos_conectividade',
    v_user, v_user,
    jsonb_build_object('source_pipeline_name','PRÉ VENDAS','target_pipeline_name','VENDAS')
  ) RETURNING id INTO v_fw;

  -- Criteria
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Evento identificado', 'Nome, data e local do evento conhecidos', 20, 1, true, 'evento') RETURNING id INTO v_c_evento;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Demanda clara', 'Necessidade técnica entendida', 20, 2, true, 'demanda') RETURNING id INTO v_c_demanda;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Data e local definidos', 'Reforço do critério de planejamento', 15, 3, true, 'data_local') RETURNING id INTO v_c_data_local;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Urgência real', 'Janela real de tempo', 15, 4, true, 'urgencia') RETURNING id INTO v_c_urgencia;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Poder ou influência', 'Decisor / influenciador identificado', 15, 5, true, 'poder') RETURNING id INTO v_c_poder;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Próximo passo combinado', 'Ação concreta acordada', 10, 6, true, 'proximo_passo') RETURNING id INTO v_c_proximo;
  INSERT INTO public.qualification_criteria (framework_id, organization_id, name, description, weight, order_index, is_required, criterion_key)
  VALUES (v_fw, v_org, 'Permissão real para proposta', 'Cliente autorizou envio da proposta', 5, 7, true, 'permissao') RETURNING id INTO v_c_permissao;

  -- Fields
  INSERT INTO public.qualification_criterion_fields
    (framework_id, criterion_id, organization_id, field_source, field_key, field_label, field_type, points, is_required_for_score, is_required_for_advance, invalid_values, order_index)
  VALUES
    (v_fw, v_c_evento, v_org, 'custom_field', 'nome_evento', 'Nome do evento', 'text', 7, true, true, ARRAY['evento','feira','stand','a definir','não sei','indefinido'], 1),
    (v_fw, v_c_evento, v_org, 'custom_field', 'data_evento', 'Data do evento', 'date', 7, true, true, ARRAY[]::text[], 2),
    (v_fw, v_c_evento, v_org, 'custom_field', 'local_evento', 'Local do evento', 'text', 6, true, true, ARRAY['a definir','não sei','sem local'], 3),
    (v_fw, v_c_demanda, v_org, 'custom_field', 'conexoes_simultaneas', 'Quantidade de conexões simultâneas', 'number', 8, true, true, ARRAY[]::text[], 1),
    (v_fw, v_c_demanda, v_org, 'custom_field', 'equipamentos', 'Equipamentos que deseja conectar', 'multiselect', 6, true, true, ARRAY[]::text[], 2),
    (v_fw, v_c_demanda, v_org, 'custom_field', 'finalidade_uso', 'Finalidade de uso', 'select', 6, true, true, ARRAY['internet','wifi','wi-fi','uso geral','não sei'], 3),
    (v_fw, v_c_data_local, v_org, 'custom_field', 'data_evento', 'Data do evento', 'date', 8, true, true, ARRAY[]::text[], 1),
    (v_fw, v_c_data_local, v_org, 'custom_field', 'local_evento', 'Local do evento', 'text', 7, true, true, ARRAY[]::text[], 2);

  INSERT INTO public.qualification_criterion_fields
    (framework_id, criterion_id, organization_id, field_source, field_key, field_label, field_type, points, is_required_for_score, is_required_for_advance, options, order_index)
  VALUES
    (v_fw, v_c_urgencia, v_org, 'custom_field', 'urgencia_real', 'Urgência real', 'select', 15, true, true,
      '[{"value":"ate_3_dias","label":"Evento em até 3 dias","points":15},
        {"value":"4_a_9_dias","label":"Evento em 4 a 9 dias","points":15},
        {"value":"10_a_20_dias","label":"Evento em 10 a 20 dias","points":12},
        {"value":"21_a_30_dias","label":"Evento em 21 a 30 dias","points":10},
        {"value":"acima_30_dias","label":"Evento acima de 30 dias","points":6},
        {"value":"sem_data","label":"Sem data definida","points":0}]'::jsonb, 1),
    (v_fw, v_c_poder, v_org, 'custom_field', 'poder_decisao', 'Poder ou influência na decisão', 'select', 15, true, true,
      '[{"value":"decisor_final","label":"Decisor final","points":15},
        {"value":"influenciador_direto","label":"Influenciador direto","points":12},
        {"value":"comprador_financeiro","label":"Comprador/financeiro","points":10},
        {"value":"usuario_tecnico","label":"Usuário técnico","points":6},
        {"value":"apenas_pesquisando","label":"Apenas pesquisando","points":2},
        {"value":"nao_identificado","label":"Não identificado","points":0}]'::jsonb, 1),
    (v_fw, v_c_proximo, v_org, 'custom_field', 'proximo_passo', 'Próximo passo combinado', 'select', 10, true, true,
      '[{"value":"enviar_proposta","label":"Enviar proposta","points":10},
        {"value":"agendar_reuniao","label":"Agendar reunião","points":8},
        {"value":"validar_escopo","label":"Validar escopo","points":6},
        {"value":"validar_orcamento","label":"Validar orçamento","points":6},
        {"value":"aguardar_retorno","label":"Aguardar retorno do cliente","points":3},
        {"value":"sem_proximo_passo","label":"Sem próximo passo","points":0}]'::jsonb, 1),
    (v_fw, v_c_permissao, v_org, 'custom_field', 'permissao_proposta', 'Permissão real para proposta', 'select', 5, true, true,
      '[{"value":"cliente_pediu_proposta","label":"Cliente pediu proposta","points":5,"valid_permission":true},
        {"value":"cliente_validou_escopo","label":"Cliente validou escopo e pediu preço","points":5,"valid_permission":true},
        {"value":"cliente_confirmou_interesse","label":"Cliente confirmou interesse real","points":5,"valid_permission":true},
        {"value":"sdr_sugerindo","label":"SDR está sugerindo proposta sem pedido claro","points":0,"valid_permission":false},
        {"value":"sem_permissao","label":"Não houve permissão para proposta","points":0,"valid_permission":false}]'::jsonb, 1);

  -- Score ranges
  INSERT INTO public.qualification_score_ranges
    (framework_id, organization_id, label, range_key, min_score, max_score, color, description, is_sql, is_priority, order_index)
  VALUES
    (v_fw, v_org, 'Frio', 'cold', 0, 39, 'slate', 'Não vai para Vendas', false, false, 1),
    (v_fw, v_org, 'Em desenvolvimento', 'developing', 40, 59, 'yellow', 'Manter em Pré-vendas', false, false, 2),
    (v_fw, v_org, 'SQL fraco', 'sql_weak', 60, 74, 'orange', 'Ainda não vai para Vendas', false, false, 3),
    (v_fw, v_org, 'SQL válido', 'sql_valid', 75, 89, 'blue', 'Pode ir para Vendas se checklist obrigatório estiver completo', true, false, 4),
    (v_fw, v_org, 'SQL prioritário', 'sql_priority', 90, 100, 'purple', 'Pode ir para Vendas com prioridade', true, true, 5);

  -- Blocking rule
  INSERT INTO public.qualification_blocking_rules
    (framework_id, organization_id, action_key, action_label, minimum_score, require_all_required_fields, require_valid_proposal_permission, block_message_title, block_message_body)
  VALUES
    (v_fw, v_org, 'move_pipeline_pre_to_sales', 'Mover do funil PRÉ VENDAS para o funil VENDAS', 75, true, true,
     'Lead ainda não pode ir para Vendas',
     'Este lead ainda não atingiu a régua mínima de qualificação. Para passar para Vendas, ele precisa ter score mínimo de 75 pontos, checklist obrigatório completo e permissão real para proposta.');

  -- Disqualification reasons
  INSERT INTO public.qualification_disqualification_reasons
    (framework_id, organization_id, reason_label, reason_key, category, accountability, send_to_remarketing_default, order_index)
  VALUES
    (v_fw, v_org, 'Sem evento definido', 'sem_evento', 'Qualificação incompleta', 'cliente', true, 1),
    (v_fw, v_org, 'Sem data do evento', 'sem_data', 'Qualificação incompleta', 'cliente', true, 2),
    (v_fw, v_org, 'Sem local definido', 'sem_local', 'Qualificação incompleta', 'cliente', true, 3),
    (v_fw, v_org, 'Sem escopo mínimo', 'sem_escopo_minimo', 'Sem demanda', 'cliente', true, 4),
    (v_fw, v_org, 'Sem quantidade de conexões', 'sem_conexoes', 'Qualificação incompleta', 'cliente', true, 5),
    (v_fw, v_org, 'Sem finalidade clara de uso', 'sem_finalidade', 'Sem demanda', 'cliente', true, 6),
    (v_fw, v_org, 'Sem urgência real', 'sem_urgencia', 'Sem timing', 'cliente', true, 7),
    (v_fw, v_org, 'Sem decisor ou influência', 'sem_decisor', 'Sem autoridade', 'comercial', true, 8),
    (v_fw, v_org, 'Sem próximo passo', 'sem_proximo_passo', 'Qualificação incompleta', 'comercial', true, 9),
    (v_fw, v_org, 'Cliente apenas pesquisando', 'cliente_pesquisando', 'Sem timing', 'cliente', true, 10),
    (v_fw, v_org, 'Pedido genérico de preço', 'pedido_generico_preco', 'Qualificação incompleta', 'comercial', true, 11),
    (v_fw, v_org, 'Baixa maturidade', 'baixa_maturidade', 'Sem fit', 'marketing', true, 12),
    (v_fw, v_org, 'Não respondeu após contato', 'nao_respondeu', 'Sem resposta', 'cliente', false, 13),
    (v_fw, v_org, 'Não visualizou proposta', 'nao_visualizou_proposta', 'Sem resposta', 'cliente', false, 14),
    (v_fw, v_org, 'Não precisa mais da solução', 'nao_precisa_solucao', 'Sem demanda', 'cliente', false, 15),
    (v_fw, v_org, 'Fora do ICP', 'fora_icp', 'Sem fit', 'marketing', false, 16),
    (v_fw, v_org, 'Concorrente escolhido', 'concorrente_escolhido', 'Concorrência', 'mercado', false, 17),
    (v_fw, v_org, 'Preço inviável', 'preco_inviavel', 'Preço', 'mercado', false, 18),
    (v_fw, v_org, 'Outro', 'outro', 'Outro', 'indefinido', false, 19);

  -- Automation
  INSERT INTO public.qualification_automations
    (framework_id, organization_id, trigger_key, name, description, config, is_active, order_index)
  VALUES
    (v_fw, v_org, 'on_disqualify', 'Desqualificação padrão LEGAL',
     'Move para etapa Desqualificado, encerra como perdida, duplica para Remarketing evitando duplicidade',
     jsonb_build_object(
       'move_to_stage','desqualificado',
       'mark_as_lost', true,
       'duplicate_to_remarketing', true,
       'link_original_opportunity', true,
       'avoid_remarketing_duplicate', true,
       'log_history', true
     ), true, 1);

  RETURN v_fw;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_qualification_template_legal() TO authenticated;
