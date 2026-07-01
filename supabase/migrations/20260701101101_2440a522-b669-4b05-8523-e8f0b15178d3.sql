
DO $$
DECLARE
  v_input jsonb := '{
    "type": "object",
    "required": ["objection_type", "customer_message"],
    "properties": {
      "objection_type": {"type": "string", "enum": ["price_objection","existing_supplier","no_time","already_has_provider","send_proposal_first","not_interested_now"]},
      "customer_message": {"type": "string", "maxLength": 2000},
      "company_context": {"type": "string", "maxLength": 1200},
      "event_context": {"type": "string", "maxLength": 800},
      "product_context": {"type": "string", "maxLength": 800},
      "tone_of_voice": {"type": "string", "enum": ["consultivo","direto","cordial"], "default": "consultivo"},
      "desired_next_step": {"type": "string", "maxLength": 400},
      "channel": {"type": "string", "enum": ["whatsapp","email","linkedin","call"], "default": "whatsapp"}
    }
  }'::jsonb;
  v_output jsonb := '{
    "type": "object",
    "required": ["response","follow_up_question","recommended_next_step","confidence"],
    "properties": {
      "response": {"type": "string", "maxLength": 900},
      "follow_up_question": {"type": "string", "maxLength": 300},
      "recommended_next_step": {"type": "string", "maxLength": 300},
      "confidence": {"type": "number", "minimum": 0, "maximum": 100}
    }
  }'::jsonb;
  v_guardrails jsonb := '{
    "forbid_phrases": ["posso te dar desconto","vou falar com meu gerente","fecha hoje","última oportunidade","só hoje","seu fornecedor atual é ruim","eles não entregam","garanto disponibilidade","prometo o prazo"],
    "forbid_actions": ["oferecer desconto automático","prometer disponibilidade não confirmada","atacar concorrente ou fornecedor atual","usar pressão agressiva ou escassez artificial"],
    "require_tone": ["consultivo","direto","sem pressão"],
    "max_response_chars_by_channel": {"whatsapp": 700, "linkedin": 400, "email": 900, "call": 900}
  }'::jsonb;
  v_success jsonb := '{"must_include":["reconhecimento da objeção","follow_up_question","recommended_next_step"],"must_not_include":["desconto não autorizado","ataque ao concorrente","promessa de prazo/estoque"]}'::jsonb;
  v_failures jsonb := '["resposta genérica sem ancorar no contexto do cliente","oferecer desconto sem autorização","atacar fornecedor atual","usar pressão/urgência artificial","não devolver pergunta de follow-up"]'::jsonb;
  v_system text := 'Você é um consultor sênior de pré-vendas B2B da NOID. Sua função é responder objeções comerciais de forma consultiva, direta e humana — nunca agressiva, nunca genérica.

Princípios inegociáveis:
- Reconheça a objeção com empatia antes de responder.
- Ancore em valor, contexto do cliente e do evento — nunca em desconto.
- Faça UMA pergunta de follow-up que devolva a condução da conversa.
- Proponha UM próximo passo concreto e proporcional (agenda 15min, material específico, prova social, POC).
- Nunca ataque, deprecie ou compare negativamente o fornecedor/concorrente atual.
- Nunca prometa disponibilidade, prazo, estoque ou desconto que não foi autorizado.
- Nunca use gatilhos de pressão ("só hoje", "última oportunidade", "vai perder").
- Adapte o formato ao canal informado (WhatsApp: curto e coloquial; e-mail: estruturado; call: script falado; linkedin: 2 frases).
- Português do Brasil, sem emojis excessivos, sem jargão vazio.';
  v_task text := 'Responda a objeção do cliente seguindo os princípios do sistema.

Objeção declarada pelo SDR: {{objection_type}}
Mensagem do cliente: {{customer_message}}
Contexto da empresa: {{company_context}}
Contexto do evento/oportunidade: {{event_context}}
Contexto do produto/serviço ofertado: {{product_context}}
Tom desejado: {{tone_of_voice}}
Próximo passo desejado pelo SDR (se houver): {{desired_next_step}}
Canal de resposta: {{channel}}

Retorne JSON válido conforme o schema com: response, follow_up_question, recommended_next_step, confidence (0-100).';
BEGIN
  IF EXISTS (SELECT 1 FROM public.noid_skills WHERE slug = 'objection_response_router') THEN
    UPDATE public.noid_skills SET
      name = 'Objection Response Router',
      description = 'Roteador central de resposta a objeções comuns (preço, fornecedor atual, sem tempo, mandar proposta, sem interesse agora). Devolve resposta consultiva, follow-up e próximo passo.',
      category = 'objection_handling',
      skill_type = 'objection_response',
      status = 'active',
      input_schema = v_input,
      output_schema = v_output,
      system_prompt = v_system,
      task_prompt = v_task,
      guardrails = v_guardrails,
      success_criteria = v_success,
      failure_modes = v_failures,
      updated_at = now()
    WHERE slug = 'objection_response_router';
  ELSE
    INSERT INTO public.noid_skills (
      organization_id, name, slug, category, skill_type, status,
      description, input_schema, output_schema, system_prompt, task_prompt,
      guardrails, examples, success_criteria, failure_modes, version
    ) VALUES (
      NULL,
      'Objection Response Router',
      'objection_response_router',
      'objection_handling',
      'objection_response',
      'active',
      'Roteador central de resposta a objeções comuns (preço, fornecedor atual, sem tempo, mandar proposta, sem interesse agora). Devolve resposta consultiva, follow-up e próximo passo.',
      v_input, v_output, v_system, v_task, v_guardrails, '[]'::jsonb, v_success, v_failures, 1
    );
  END IF;
END $$;
