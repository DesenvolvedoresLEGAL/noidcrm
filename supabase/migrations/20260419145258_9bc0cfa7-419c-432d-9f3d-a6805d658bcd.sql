DO $$
DECLARE
  v_agent_id uuid := 'b48649bd-534b-4557-845f-3eeef18b0ca0';
  v_version_id uuid := '1249122d-3c2d-4bbc-969f-f496de4a91df';
  v_org_id uuid := 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d';
BEGIN

DELETE FROM ai_agent_triggers WHERE agent_version_id = v_version_id;
DELETE FROM ai_agent_tools WHERE agent_version_id = v_version_id;
DELETE FROM ai_agent_prompt_layers WHERE agent_version_id = v_version_id;
DELETE FROM ai_agent_escalation_policies WHERE agent_version_id = v_version_id;
DELETE FROM ai_agent_memory_profiles WHERE agent_version_id = v_version_id;

INSERT INTO ai_agent_triggers (organization_id, agent_id, agent_version_id, trigger_kind, trigger_name, entity_type, event_name, condition_json, priority, is_active) VALUES
(v_org_id, v_agent_id, v_version_id, 'event', 'Atividade de email vencida', 'activity', 'activity_overdue',
 '{"type":"email","status":"pending","overdue_hours":24}'::jsonb, 10, true),
(v_org_id, v_agent_id, v_version_id, 'event', 'Oportunidade entrou em nova etapa', 'opportunity', 'stage_enter',
 '{"requires_email_followup":true}'::jsonb, 20, true),
(v_org_id, v_agent_id, v_version_id, 'event', 'Proposta visualizada sem resposta', 'proposal', 'proposal_viewed',
 '{"no_response_hours":48,"status":"sent"}'::jsonb, 30, true);

INSERT INTO ai_agent_tools (organization_id, agent_id, agent_version_id, tool_id, is_enabled, execution_mode, config_json)
SELECT v_org_id, v_agent_id, v_version_id, id, true,
  CASE WHEN risk_level IN ('high','critical') THEN 'approval_required' ELSE 'allowed' END,
  '{}'::jsonb
FROM ai_tools_registry
WHERE key IN ('read_opportunity','read_contact','read_proposal','read_activity_history','send_email','log_internal_note');

INSERT INTO ai_agent_prompt_layers (
  organization_id, agent_id, agent_version_id,
  system_prompt, role_prompt, deliberation_prompt, generation_prompt, review_prompt,
  output_contract_json, style_rules_json, forbidden_patterns_json
) VALUES (
  v_org_id, v_agent_id, v_version_id,
  'Você é o EMAIL AGENT da Humanoid OS, especialista em comunicação comercial B2B em português brasileiro. Seu objetivo é gerar emails de follow-up contextualizados, humanos e que aceleram fechamento — nunca spam. Você opera no modo ASSISTED: gera rascunhos para revisão humana antes do envio. Sempre considere histórico, estágio do funil e sinais de engajamento antes de propor uma comunicação.',
  'Você atua como SDR/Closer assistente do vendedor. Sua voz é consultiva, direta, sem jargões corporativos. Tom: confiante mas humilde, focado em ajudar o cliente a tomar a melhor decisão — não em empurrar venda.',
  'Antes de gerar o email, RACIOCINE explicitamente: 1) Qual é o estágio atual da oportunidade e o que faz sentido enviar AGORA? 2) Quando foi o último contato? Há sinal de fadiga (>3 emails sem resposta = pausar)? 3) Qual é o objetivo deste email: abrir conversa, marcar reunião, retomar proposta, qualificar? 4) Existe contexto recente (proposta visualizada, atividade vencida, mudança de etapa) que justifica este envio? 5) RISCO: este email pode soar invasivo ou repetitivo? Se sim, recomende NÃO enviar. Saída: should_send (boolean), reasoning (string), confidence (0-1).',
  'Gere o email seguindo: Subject máximo 50 caracteres, sem CAPS, sem emojis, sem clickbait. Body 60-120 palavras, parágrafos curtos (máx 2 linhas cada). Personalização real: cite nome, empresa, contexto específico — nunca placeholders genéricos. CTA único e claro: "podemos conversar 15min na quinta?" ou similar. Sem PS, sem assinatura institucional, sem disclaimers. Português brasileiro nativo, segunda pessoa (você), sem gerundismo.',
  'Revise o rascunho contra: Subject < 50 chars? Body < 120 palavras? Há CTA claro e único? Soa humano ou robótico? Algum padrão proibido? Se reprovar, ajuste e gere v2. Máximo 2 iterações.',
  '{"should_send":{"type":"boolean","required":true},"subject":{"type":"string","required":true,"max_length":80},"body":{"type":"string","required":true,"min_words":40,"max_words":150},"tone":{"type":"string","enum":["consultive","direct","followup","reactivation"]},"cta":{"type":"string","required":true},"confidence":{"type":"number","required":true,"min":0,"max":1},"risk_score":{"type":"number","required":true,"min":0,"max":1},"reasoning":{"type":"string","required":true},"send_mode":{"type":"string","enum":["draft_for_review","auto_send"],"default":"draft_for_review"}}'::jsonb,
  '["Português brasileiro, segunda pessoa (você)","Tom consultivo, nunca agressivo","Subject sem emoji e sem CAPS","Body entre 60-120 palavras","CTA único e específico","Personalização real com nome e contexto"]'::jsonb,
  '["Olá, tudo bem?","Espero que esteja bem","Estou passando aqui para","Conforme combinado","Apenas dando um follow-up","{{nome}}","{{empresa}}","Aproveitando o contato","URGENTE","ÚLTIMA CHANCE"]'::jsonb
);

INSERT INTO ai_agent_escalation_policies (
  organization_id, agent_id, agent_version_id,
  escalation_mode, confidence_threshold, risk_threshold,
  escalation_targets_json, approval_rules_json, fallback_actions_json
) VALUES (
  v_org_id, v_agent_id, v_version_id,
  'conditional', 0.7, 'medium',
  '[{"role":"opportunity_owner","channel":"in_app"},{"role":"sales_manager","channel":"slack","trigger":"high_risk"}]'::jsonb,
  '[{"rule":"always_draft_for_review","applies_to":"all_emails","reason":"modo assisted"},{"rule":"block_if_risk_high","threshold":0.8,"action":"discard"},{"rule":"require_manager_if_deal_value","threshold":50000,"action":"escalate"}]'::jsonb,
  '[{"on":"low_confidence","action":"save_as_draft_with_warning"},{"on":"missing_context","action":"skip_and_log"},{"on":"send_failure","action":"retry_once_then_escalate"}]'::jsonb
);

INSERT INTO ai_agent_memory_profiles (
  organization_id, agent_id, agent_version_id,
  short_term_enabled, operational_memory_enabled, learning_memory_enabled,
  short_term_window, context_sources_json, retention_policy_json
) VALUES (
  v_org_id, v_agent_id, v_version_id,
  true, true, false, 15,
  '[{"source":"opportunity_history","limit":20},{"source":"activity_log","entity":"contact","limit":10},{"source":"email_thread","limit":5},{"source":"proposal_status"}]'::jsonb,
  '{"short_term_ttl_hours":24,"operational_ttl_days":90,"purge_on_deal_close":true}'::jsonb
);

UPDATE ai_agent_versions
SET builder_status = 'draft_ready',
    config_summary_json = jsonb_build_object(
      'trigger_count', 3,
      'tool_count', 6,
      'has_memory', true,
      'has_prompts', true,
      'has_escalation', true,
      'configured_at', now()
    )
WHERE id = v_version_id;

INSERT INTO ai_agent_audit (organization_id, agent_id, action_type, payload_json)
VALUES (v_org_id, v_agent_id, 'config_bootstrap',
  jsonb_build_object('source','system_repair','triggers',3,'tools',6,'prompts','5_layers','policy','conditional','memory','short+operational'));

END $$;