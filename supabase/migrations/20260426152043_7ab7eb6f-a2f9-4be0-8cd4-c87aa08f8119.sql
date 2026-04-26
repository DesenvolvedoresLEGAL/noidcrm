-- =====================================================================
-- SPRINT 1.2 — MCP REGISTRY FOUNDATION: SEEDS + GOVERNANCE RPCs
-- =====================================================================

-- =====================================================================
-- BLOCO 1: SEED DO SERVIDOR INTERNO
-- =====================================================================
INSERT INTO public.mcp_servers (
  organization_id, name, slug, description,
  server_type, transport_type, status, auth_type, risk_level, metadata
)
SELECT
  NULL, 'NOID Internal MCP Server', 'noid_internal_mcp',
  'Servidor MCP interno do NOID Intelligence para registry, contexto, tools controladas, permissões e auditoria.',
  'internal', 'http', 'draft', 'service_role', 'low',
  '{"source":"system_seed","scope":"noid_intelligence","real_execution_enabled":false,"created_by_sprint":"1.2"}'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_servers
  WHERE slug = 'noid_internal_mcp' AND organization_id IS NULL
);

-- =====================================================================
-- BLOCO 2: SEED DE TOOLS (5, todas is_enabled=false)
-- =====================================================================
WITH srv AS (
  SELECT id AS server_id FROM public.mcp_servers
  WHERE slug = 'noid_internal_mcp' AND organization_id IS NULL LIMIT 1
)
INSERT INTO public.mcp_tools (
  organization_id, server_id, name, slug, description, category,
  execution_mode, risk_level, requires_approval, is_enabled,
  input_schema, output_schema, metadata
)
SELECT NULL, srv.server_id, t.name, t.slug, t.description, t.category,
       t.execution_mode, t.risk_level, t.requires_approval, false,
       t.input_schema::jsonb, t.output_schema::jsonb,
       '{"source":"system_seed","scope":"noid_intelligence","real_execution_enabled":false,"created_by_sprint":"1.2"}'::jsonb
FROM srv,
(VALUES
  (
    'Get Lead Context', 'get_lead_context',
    'Consulta contexto de lead para agentes futuros do NOID Intelligence.',
    'crm', 'read_only', 'low', false,
    '{"type":"object","properties":{"lead_id":{"type":"string"}},"required":["lead_id"]}',
    '{"type":"object","properties":{"lead":{"type":"object"},"history":{"type":"array"},"next_best_action":{"type":"string"}}}'
  ),
  (
    'Draft WhatsApp Follow Up', 'draft_whatsapp_followup',
    'Gera sugestão de follow up por WhatsApp sem envio real.',
    'sales', 'suggestion_only', 'low', false,
    '{"type":"object","properties":{"lead_id":{"type":"string"},"context":{"type":"string"},"tone":{"type":"string"}},"required":["lead_id"]}',
    '{"type":"object","properties":{"message":{"type":"string"},"reasoning_summary":{"type":"string"}}}'
  ),
  (
    'Draft Email Follow Up', 'draft_email_followup',
    'Gera sugestão de follow up por email sem envio real.',
    'sales', 'suggestion_only', 'low', false,
    '{"type":"object","properties":{"lead_id":{"type":"string"},"context":{"type":"string"},"subject_hint":{"type":"string"}},"required":["lead_id"]}',
    '{"type":"object","properties":{"subject":{"type":"string"},"body":{"type":"string"}}}'
  ),
  (
    'Suggest Next Activity', 'suggest_next_activity',
    'Sugere próxima atividade comercial sem criar atividade real.',
    'activity', 'suggestion_only', 'low', false,
    '{"type":"object","properties":{"opportunity_id":{"type":"string"},"current_stage":{"type":"string"},"last_interaction":{"type":"string"}},"required":["opportunity_id"]}',
    '{"type":"object","properties":{"activity_type":{"type":"string"},"title":{"type":"string"},"description":{"type":"string"},"suggested_due_date":{"type":"string"}}}'
  ),
  (
    'Simulate Stage Update', 'simulate_stage_update',
    'Simula atualização de etapa sem alterar dados reais do CRM.',
    'crm', 'approval_required', 'medium', true,
    '{"type":"object","properties":{"opportunity_id":{"type":"string"},"from_stage":{"type":"string"},"to_stage":{"type":"string"},"reason":{"type":"string"}},"required":["opportunity_id","to_stage"]}',
    '{"type":"object","properties":{"simulated":{"type":"boolean"},"message":{"type":"string"}}}'
  )
) AS t(name, slug, description, category, execution_mode, risk_level, requires_approval, input_schema, output_schema)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_tools mt
  WHERE mt.slug = t.slug AND mt.organization_id IS NULL
);

-- =====================================================================
-- BLOCO 3: SEED DE RESOURCES (7, todos is_enabled=false)
-- =====================================================================
WITH srv AS (
  SELECT id AS server_id FROM public.mcp_servers
  WHERE slug = 'noid_internal_mcp' AND organization_id IS NULL LIMIT 1
)
INSERT INTO public.mcp_resources (
  organization_id, server_id, name, uri_pattern, description,
  resource_type, read_scope, risk_level, is_enabled, metadata
)
SELECT NULL, srv.server_id, r.name, r.uri_pattern, r.description,
       r.resource_type, r.read_scope, r.risk_level, false,
       '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb
FROM srv,
(VALUES
  ('Lead Context', 'crm://lead/{lead_id}', 'Contexto de lead para uso futuro por agentes.', 'crm', 'tenant', 'low'),
  ('Opportunity Context', 'crm://opportunity/{opportunity_id}', 'Contexto de oportunidade para uso futuro por agentes comerciais.', 'sales', 'tenant', 'low'),
  ('Proposal Context', 'crm://proposal/{proposal_id}', 'Contexto de proposta comercial para agentes.', 'proposal', 'tenant', 'medium'),
  ('Activity Context', 'crm://activity/{activity_id}', 'Contexto de atividade comercial para agentes.', 'activity', 'tenant', 'low'),
  ('Proposals Viewed Today Report', 'crm://report/proposals_viewed_today', 'Relatório de propostas visualizadas no dia.', 'report', 'role_based', 'medium'),
  ('Pre Sales Playbook', 'crm://playbook/pre_sales', 'Playbook de pré vendas para agentes comerciais.', 'playbook', 'tenant', 'low'),
  ('Organization Sales Rules', 'crm://organization/{organization_id}/sales_rules', 'Regras comerciais da organização para agentes do NOID Intelligence.', 'tenant', 'admin_only', 'high')
) AS r(name, uri_pattern, description, resource_type, read_scope, risk_level)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_resources mr
  WHERE mr.uri_pattern = r.uri_pattern AND mr.server_id = srv.server_id
);

-- =====================================================================
-- BLOCO 4: SEED DE PROMPTS (5, todos status=draft, version=1)
-- =====================================================================
INSERT INTO public.mcp_prompts (
  organization_id, name, slug, description, prompt_type,
  content, variables, version, status, metadata
)
SELECT NULL, p.name, p.slug, p.description, p.prompt_type,
       p.content, p.variables::jsonb, 1, 'draft',
       '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb
FROM (VALUES
  (
    'Follow Up Curto WhatsApp', 'followup_curto_whatsapp',
    'Template para follow up curto e humano por WhatsApp.', 'sales_script',
    'Crie uma mensagem curta, direta e natural para retomar contato com o lead. Não use linguagem robótica. Não invente informações. Use apenas o contexto fornecido. A mensagem deve parecer escrita por uma pessoa real do time comercial.',
    '["lead_name","company_name","context","seller_name"]'
  ),
  (
    'Objeção Pavilhão Homologada', 'objection_pavilhao_homologada',
    'Template para responder objeção de contratação obrigatória da internet oficial do pavilhão.', 'objection_handling',
    'Crie uma resposta comercial curta, firme e respeitosa para quando o cliente disser que só pode contratar a internet oficial do pavilhão. A resposta deve defender o direito de escolha do cliente, mostrar segurança técnica e evitar tom jurídico pesado.',
    '["event_name","venue_name","client_context","seller_name"]'
  ),
  (
    'Reativação Após Proposta Visualizada', 'proposal_viewed_reactivation',
    'Template para follow up quando a proposta foi visualizada.', 'sales_script',
    'Crie uma mensagem curta para o vendedor enviar após a proposta ser visualizada pelo cliente. O tom deve ser consultivo, direto e orientado à decisão, sem pressão artificial.',
    '["lead_name","proposal_value","event_date","seller_name"]'
  ),
  (
    'Daily Sales Digest', 'daily_sales_digest',
    'Template para resumo diário comercial futuro.', 'analysis',
    'Gere um resumo diário com atividades pendentes, propostas visualizadas, oportunidades paradas, alertas de follow up e prioridades comerciais. Organize por urgência e impacto comercial.',
    '["user_name","date","activities","proposals","opportunities"]'
  ),
  (
    'Script Pré Vendas', 'pre_sales_call_script',
    'Template para abordagem inicial de pré vendas.', 'sales_script',
    'Crie um roteiro curto para pré vendas abordar um lead de evento. O objetivo é entender data, local, quantidade de pessoas, necessidade de internet, urgência e próximo passo.',
    '["lead_name","company_name","event_context","seller_name"]'
  )
) AS p(name, slug, description, prompt_type, content, variables)
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_prompts mp
  WHERE mp.slug = p.slug AND mp.organization_id IS NULL
);

-- =====================================================================
-- BLOCO 5: SEED DE SETTINGS POR ORGANIZAÇÃO
-- =====================================================================
INSERT INTO public.mcp_registry_settings (
  organization_id, is_mcp_enabled, allow_external_servers,
  default_requires_approval, default_daily_call_limit, log_retention_days, metadata
)
SELECT o.id, false, false, true, 100, 180,
       '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb
FROM public.organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM public.mcp_registry_settings s WHERE s.organization_id = o.id
);

-- =====================================================================
-- BLOCO 6: RPC mcp_log_audit
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mcp_log_audit(
  p_entity_type   text,
  p_action        text,
  p_organization_id uuid DEFAULT NULL,
  p_user_id       uuid DEFAULT NULL,
  p_agent_id      uuid DEFAULT NULL,
  p_entity_id     uuid DEFAULT NULL,
  p_before_json   jsonb DEFAULT NULL,
  p_after_json    jsonb DEFAULT NULL,
  p_metadata      jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_caller uuid := auth.uid();
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
BEGIN
  IF p_entity_type IS NULL OR length(trim(p_entity_type)) = 0 THEN
    RAISE EXCEPTION 'entity_type is required';
  END IF;
  IF p_action IS NULL OR length(trim(p_action)) = 0 THEN
    RAISE EXCEPTION 'action is required';
  END IF;

  -- Cross-org guard (apenas quando há caller autenticado e org alvo)
  IF p_organization_id IS NOT NULL AND v_caller IS NOT NULL THEN
    IF NOT (
      public.user_is_org_member(p_organization_id)
      OR public.is_platform_admin(v_caller)
    ) THEN
      RAISE EXCEPTION 'Cross-organization audit logging denied';
    END IF;
  END IF;

  INSERT INTO public.mcp_audit_logs (
    organization_id, user_id, agent_id, entity_type, entity_id,
    action, before_json, after_json, metadata
  )
  VALUES (
    p_organization_id, v_user_id, p_agent_id, p_entity_type, p_entity_id,
    p_action, p_before_json, p_after_json, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_log_audit(text, text, uuid, uuid, uuid, uuid, jsonb, jsonb, jsonb) TO authenticated;

-- =====================================================================
-- BLOCO 7: RPC check_mcp_permission
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_mcp_permission(
  p_organization_id uuid,
  p_action          text,
  p_agent_id        uuid DEFAULT NULL,
  p_user_id         uuid DEFAULT NULL,
  p_role_name       text DEFAULT NULL,
  p_tool_id         uuid DEFAULT NULL,
  p_resource_id     uuid DEFAULT NULL,
  p_prompt_id       uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_match_count int := 0;
  v_allowed_count int := 0;
  v_requires_approval boolean := true;
BEGIN
  -- Validações
  IF p_organization_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'organization_id is required');
  END IF;
  IF p_action IS NULL OR p_action NOT IN ('read','suggest','execute') THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'action must be read, suggest or execute');
  END IF;
  IF p_agent_id IS NULL AND p_user_id IS NULL AND p_role_name IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'At least one subject (agent_id, user_id, role_name) is required');
  END IF;
  IF p_tool_id IS NULL AND p_resource_id IS NULL AND p_prompt_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'At least one protected object (tool_id, resource_id, prompt_id) is required');
  END IF;

  -- Cross-org guard
  IF v_caller IS NOT NULL THEN
    IF NOT (
      public.user_is_org_member(p_organization_id)
      OR public.is_platform_admin(v_caller)
    ) THEN
      RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
        'reason', 'Cross-organization access denied');
    END IF;
  END IF;

  -- Conta permissões com match de subject + objeto
  WITH matched AS (
    SELECT
      p.requires_approval,
      CASE
        WHEN p_action = 'read'    AND p.can_read    THEN true
        WHEN p_action = 'suggest' AND p.can_suggest THEN true
        WHEN p_action = 'execute' AND p.can_execute THEN true
        ELSE false
      END AS action_allowed
    FROM public.mcp_permissions p
    WHERE p.organization_id = p_organization_id
      AND p.status = 'active'
      AND (
        (p_agent_id   IS NOT NULL AND p.agent_id   = p_agent_id)
        OR (p_user_id IS NOT NULL AND p.user_id    = p_user_id)
        OR (p_role_name IS NOT NULL AND p.role_name = p_role_name)
      )
      AND (
        (p_tool_id     IS NOT NULL AND p.tool_id     = p_tool_id)
        OR (p_resource_id IS NOT NULL AND p.resource_id = p_resource_id)
        OR (p_prompt_id   IS NOT NULL AND p.prompt_id   = p_prompt_id)
      )
  )
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE action_allowed),
    COALESCE(bool_or(requires_approval) FILTER (WHERE action_allowed), true)
  INTO v_match_count, v_allowed_count, v_requires_approval
  FROM matched;

  IF v_match_count = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'No matching MCP permission found');
  END IF;

  IF v_allowed_count = 0 THEN
    RETURN jsonb_build_object('allowed', false, 'requires_approval', true,
      'reason', 'MCP permission does not allow requested action');
  END IF;

  RETURN jsonb_build_object(
    'allowed', true,
    'requires_approval', v_requires_approval,
    'reason', 'Permission granted'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_mcp_permission(uuid, text, uuid, uuid, text, uuid, uuid, uuid) TO authenticated;

-- =====================================================================
-- BLOCO 8: RPC mcp_record_invocation
-- =====================================================================
CREATE OR REPLACE FUNCTION public.mcp_record_invocation(
  p_organization_id uuid,
  p_tool_id         uuid,
  p_agent_id        uuid DEFAULT NULL,
  p_user_id         uuid DEFAULT NULL,
  p_input_json      jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_settings public.mcp_registry_settings%ROWTYPE;
  v_tool public.mcp_tools%ROWTYPE;
  v_invocation_id uuid;
  v_action text;
  v_perm jsonb;
  v_requires_approval boolean;
  v_approval_status text;
  v_error text;
  v_blocked_output jsonb;
  v_success_output jsonb := '{"simulated":true,"message":"Simulated MCP invocation completed. No external action was executed."}'::jsonb;

  -- Helper inline para registrar invocation bloqueada
  -- (implementado via blocos abaixo)
BEGIN
  -- Validações iniciais
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id is required';
  END IF;

  -- Cross-org guard
  IF v_caller IS NOT NULL THEN
    IF NOT (
      public.user_is_org_member(p_organization_id)
      OR public.is_platform_admin(v_caller)
    ) THEN
      RAISE EXCEPTION 'Cross-organization invocation denied';
    END IF;
  END IF;

  -- 3. Settings
  SELECT * INTO v_settings
  FROM public.mcp_registry_settings
  WHERE organization_id = p_organization_id
  LIMIT 1;

  IF NOT FOUND THEN
    v_error := 'MCP settings not found for this organization';
    INSERT INTO public.mcp_tool_invocations (
      organization_id, agent_id, user_id, tool_id, tool_slug,
      invocation_type, execution_status, approval_status,
      input_json, output_json, error_message,
      risk_level, execution_mode, approval_required,
      volts_consumed, started_at, finished_at
    ) VALUES (
      p_organization_id, p_agent_id, v_user_id, p_tool_id, NULL,
      'simulated', 'blocked', 'not_required',
      p_input_json, NULL, v_error,
      'low', NULL, false,
      0, now(), now()
    ) RETURNING id INTO v_invocation_id;

    PERFORM public.mcp_log_audit(
      p_entity_type := 'mcp_invocation',
      p_action := 'blocked_invocation',
      p_organization_id := p_organization_id,
      p_user_id := v_user_id,
      p_agent_id := p_agent_id,
      p_entity_id := v_invocation_id,
      p_metadata := jsonb_build_object('reason', v_error)
    );

    RETURN jsonb_build_object(
      'invocation_id', v_invocation_id,
      'execution_status', 'blocked',
      'approval_status', 'not_required',
      'error_message', v_error,
      'output_json', NULL
    );
  END IF;

  -- 5. MCP desabilitado
  IF NOT v_settings.is_mcp_enabled THEN
    v_error := 'MCP is disabled for this organization';
    INSERT INTO public.mcp_tool_invocations (
      organization_id, agent_id, user_id, tool_id, tool_slug,
      invocation_type, execution_status, approval_status,
      input_json, output_json, error_message,
      risk_level, execution_mode, approval_required,
      volts_consumed, started_at, finished_at
    ) VALUES (
      p_organization_id, p_agent_id, v_user_id, p_tool_id, NULL,
      'simulated', 'blocked', 'not_required',
      p_input_json, NULL, v_error,
      'low', NULL, false,
      0, now(), now()
    ) RETURNING id INTO v_invocation_id;

    PERFORM public.mcp_log_audit(
      p_entity_type := 'mcp_invocation',
      p_action := 'blocked_invocation',
      p_organization_id := p_organization_id,
      p_user_id := v_user_id,
      p_agent_id := p_agent_id,
      p_entity_id := v_invocation_id,
      p_metadata := jsonb_build_object('reason', v_error)
    );

    RETURN jsonb_build_object(
      'invocation_id', v_invocation_id,
      'execution_status', 'blocked',
      'approval_status', 'not_required',
      'error_message', v_error,
      'output_json', NULL
    );
  END IF;

  -- 6/7. Tool
  SELECT * INTO v_tool FROM public.mcp_tools WHERE id = p_tool_id LIMIT 1;
  IF NOT FOUND THEN
    v_error := 'Tool not found';
    INSERT INTO public.mcp_tool_invocations (
      organization_id, agent_id, user_id, tool_id, tool_slug,
      invocation_type, execution_status, approval_status,
      input_json, output_json, error_message,
      risk_level, execution_mode, approval_required,
      volts_consumed, started_at, finished_at
    ) VALUES (
      p_organization_id, p_agent_id, v_user_id, p_tool_id, NULL,
      'simulated', 'blocked', 'not_required',
      p_input_json, NULL, v_error,
      'low', NULL, false,
      0, now(), now()
    ) RETURNING id INTO v_invocation_id;

    PERFORM public.mcp_log_audit(
      p_entity_type := 'mcp_invocation',
      p_action := 'blocked_invocation',
      p_organization_id := p_organization_id,
      p_user_id := v_user_id,
      p_agent_id := p_agent_id,
      p_entity_id := v_invocation_id,
      p_metadata := jsonb_build_object('reason', v_error)
    );

    RETURN jsonb_build_object(
      'invocation_id', v_invocation_id,
      'execution_status', 'blocked',
      'approval_status', 'not_required',
      'error_message', v_error,
      'output_json', NULL
    );
  END IF;

  -- 8. Tool desabilitada
  IF NOT v_tool.is_enabled THEN
    v_error := 'Tool is disabled';
    INSERT INTO public.mcp_tool_invocations (
      organization_id, agent_id, user_id, tool_id, tool_slug,
      invocation_type, execution_status, approval_status,
      input_json, output_json, error_message,
      risk_level, execution_mode, approval_required,
      volts_consumed, started_at, finished_at
    ) VALUES (
      p_organization_id, p_agent_id, v_user_id, p_tool_id, v_tool.slug,
      'simulated', 'blocked', 'not_required',
      p_input_json, NULL, v_error,
      v_tool.risk_level, v_tool.execution_mode, v_tool.requires_approval,
      0, now(), now()
    ) RETURNING id INTO v_invocation_id;

    PERFORM public.mcp_log_audit(
      p_entity_type := 'mcp_invocation',
      p_action := 'blocked_invocation',
      p_organization_id := p_organization_id,
      p_user_id := v_user_id,
      p_agent_id := p_agent_id,
      p_entity_id := v_invocation_id,
      p_metadata := jsonb_build_object('reason', v_error, 'tool_slug', v_tool.slug)
    );

    RETURN jsonb_build_object(
      'invocation_id', v_invocation_id,
      'execution_status', 'blocked',
      'approval_status', 'not_required',
      'error_message', v_error,
      'output_json', NULL
    );
  END IF;

  -- 9. Mapear execution_mode -> action
  v_action := CASE v_tool.execution_mode
    WHEN 'read_only' THEN 'read'
    WHEN 'suggestion_only' THEN 'suggest'
    ELSE 'execute'
  END;

  -- 10. Verificar permissão
  v_perm := public.check_mcp_permission(
    p_organization_id := p_organization_id,
    p_action := v_action,
    p_agent_id := p_agent_id,
    p_user_id := v_user_id,
    p_tool_id := p_tool_id
  );

  -- 11. Permissão negada
  IF NOT COALESCE((v_perm->>'allowed')::boolean, false) THEN
    v_error := 'Permission denied';
    INSERT INTO public.mcp_tool_invocations (
      organization_id, agent_id, user_id, tool_id, tool_slug,
      invocation_type, execution_status, approval_status,
      input_json, output_json, error_message,
      risk_level, execution_mode, approval_required,
      volts_consumed, started_at, finished_at
    ) VALUES (
      p_organization_id, p_agent_id, v_user_id, p_tool_id, v_tool.slug,
      'simulated', 'blocked', 'not_required',
      p_input_json, NULL, v_error,
      v_tool.risk_level, v_tool.execution_mode, v_tool.requires_approval,
      0, now(), now()
    ) RETURNING id INTO v_invocation_id;

    PERFORM public.mcp_log_audit(
      p_entity_type := 'mcp_invocation',
      p_action := 'blocked_invocation',
      p_organization_id := p_organization_id,
      p_user_id := v_user_id,
      p_agent_id := p_agent_id,
      p_entity_id := v_invocation_id,
      p_metadata := jsonb_build_object(
        'reason', v_error,
        'tool_slug', v_tool.slug,
        'permission_check', v_perm
      )
    );

    RETURN jsonb_build_object(
      'invocation_id', v_invocation_id,
      'execution_status', 'blocked',
      'approval_status', 'not_required',
      'error_message', v_error,
      'output_json', NULL
    );
  END IF;

  -- 12. Sucesso simulado
  v_requires_approval := COALESCE((v_perm->>'requires_approval')::boolean, v_tool.requires_approval);
  v_approval_status := CASE WHEN v_requires_approval THEN 'pending' ELSE 'not_required' END;

  INSERT INTO public.mcp_tool_invocations (
    organization_id, agent_id, user_id, tool_id, tool_slug,
    invocation_type, execution_status, approval_status,
    input_json, output_json, error_message,
    risk_level, execution_mode, approval_required,
    volts_consumed, started_at, finished_at
  ) VALUES (
    p_organization_id, p_agent_id, v_user_id, p_tool_id, v_tool.slug,
    'simulated', 'success', v_approval_status,
    p_input_json, v_success_output, NULL,
    v_tool.risk_level, v_tool.execution_mode, v_requires_approval,
    0, now(), now()
  ) RETURNING id INTO v_invocation_id;

  PERFORM public.mcp_log_audit(
    p_entity_type := 'mcp_invocation',
    p_action := 'simulated_invocation_created',
    p_organization_id := p_organization_id,
    p_user_id := v_user_id,
    p_agent_id := p_agent_id,
    p_entity_id := v_invocation_id,
    p_metadata := jsonb_build_object(
      'tool_slug', v_tool.slug,
      'execution_mode', v_tool.execution_mode,
      'requires_approval', v_requires_approval
    )
  );

  RETURN jsonb_build_object(
    'invocation_id', v_invocation_id,
    'execution_status', 'success',
    'approval_status', v_approval_status,
    'error_message', NULL,
    'output_json', v_success_output
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_record_invocation(uuid, uuid, uuid, uuid, jsonb) TO authenticated;

-- =====================================================================
-- BLOCO 9: AUDITORIA DOS SEEDS (system context, sem auth.uid())
-- =====================================================================
DO $$
DECLARE
  r RECORD;
BEGIN
  -- Servidor
  FOR r IN SELECT id FROM public.mcp_servers
           WHERE slug = 'noid_internal_mcp' AND organization_id IS NULL
  LOOP
    INSERT INTO public.mcp_audit_logs (organization_id, entity_type, entity_id, action, metadata)
    VALUES (NULL, 'mcp_server', r.id, 'system_seed_created',
      '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb);
  END LOOP;

  -- Tools
  FOR r IN SELECT id, slug FROM public.mcp_tools
           WHERE organization_id IS NULL
             AND metadata->>'created_by_sprint' = '1.2'
  LOOP
    INSERT INTO public.mcp_audit_logs (organization_id, entity_type, entity_id, action, metadata)
    VALUES (NULL, 'mcp_tool', r.id, 'system_seed_created',
      jsonb_build_object('slug', r.slug, 'source','system_seed','scope','noid_intelligence','created_by_sprint','1.2'));
  END LOOP;

  -- Resources
  FOR r IN SELECT id, uri_pattern FROM public.mcp_resources
           WHERE organization_id IS NULL
             AND metadata->>'created_by_sprint' = '1.2'
  LOOP
    INSERT INTO public.mcp_audit_logs (organization_id, entity_type, entity_id, action, metadata)
    VALUES (NULL, 'mcp_resource', r.id, 'system_seed_created',
      jsonb_build_object('uri_pattern', r.uri_pattern, 'source','system_seed','scope','noid_intelligence','created_by_sprint','1.2'));
  END LOOP;

  -- Prompts
  FOR r IN SELECT id, slug FROM public.mcp_prompts
           WHERE organization_id IS NULL
             AND metadata->>'created_by_sprint' = '1.2'
  LOOP
    INSERT INTO public.mcp_audit_logs (organization_id, entity_type, entity_id, action, metadata)
    VALUES (NULL, 'mcp_prompt', r.id, 'system_seed_created',
      jsonb_build_object('slug', r.slug, 'source','system_seed','scope','noid_intelligence','created_by_sprint','1.2'));
  END LOOP;

  -- Settings
  FOR r IN SELECT id, organization_id FROM public.mcp_registry_settings
           WHERE metadata->>'created_by_sprint' = '1.2'
  LOOP
    INSERT INTO public.mcp_audit_logs (organization_id, entity_type, entity_id, action, metadata)
    VALUES (r.organization_id, 'mcp_registry_settings', r.id, 'system_seed_created',
      '{"source":"system_seed","scope":"noid_intelligence","created_by_sprint":"1.2"}'::jsonb);
  END LOOP;
END $$;