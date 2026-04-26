-- =====================================================================
-- Sprint 1.4 — MCP Registry: Permissions RPCs + audit hardening
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Patch defensivo em mcp_log_audit (não-quebra; mantém assinatura)
--    Se o caller não for admin/platform_admin e tentar passar p_user_id
--    diferente de auth.uid(), sobrescrevemos com auth.uid().
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_log_audit(
  p_entity_type text,
  p_action text,
  p_organization_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_agent_id uuid DEFAULT NULL,
  p_entity_id uuid DEFAULT NULL,
  p_before_json jsonb DEFAULT NULL,
  p_after_json jsonb DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_effective_user uuid := p_user_id;
  v_id uuid;
  v_is_admin boolean := false;
BEGIN
  IF v_caller IS NULL THEN
    RETURN NULL;
  END IF;

  -- Patch de segurança: usuário comum não pode falsificar p_user_id
  IF v_effective_user IS NULL THEN
    v_effective_user := v_caller;
  ELSIF v_effective_user <> v_caller THEN
    BEGIN
      v_is_admin := COALESCE(public.is_platform_admin(v_caller), false);
    EXCEPTION WHEN OTHERS THEN
      v_is_admin := false;
    END;

    IF NOT v_is_admin AND p_organization_id IS NOT NULL THEN
      BEGIN
        v_is_admin := COALESCE(public.user_is_org_admin(p_organization_id), false);
      EXCEPTION WHEN OTHERS THEN
        v_is_admin := false;
      END;
    END IF;

    IF NOT v_is_admin THEN
      v_effective_user := v_caller;
    END IF;
  END IF;

  INSERT INTO public.mcp_audit_logs (
    entity_type, action, organization_id, user_id, agent_id,
    entity_id, before_json, after_json, metadata
  )
  VALUES (
    p_entity_type, p_action, p_organization_id, v_effective_user, p_agent_id,
    p_entity_id, p_before_json, p_after_json, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------
-- 2) Helper interno: aplica regras de segurança por objeto
--    Retorna requires_approval ajustado; raise EXCEPTION em violações.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._mcp_apply_object_security(
  p_tool_id uuid,
  p_resource_id uuid,
  p_prompt_id uuid,
  p_can_read boolean,
  p_can_suggest boolean,
  p_can_execute boolean,
  p_requires_approval boolean
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tool RECORD;
  v_resource RECORD;
  v_required boolean := COALESCE(p_requires_approval, true);
BEGIN
  IF p_tool_id IS NOT NULL THEN
    SELECT risk_level, execution_mode INTO v_tool FROM public.mcp_tools WHERE id = p_tool_id;
    IF v_tool IS NULL THEN
      RAISE EXCEPTION 'Tool não encontrada' USING ERRCODE = '22023';
    END IF;

    IF p_can_execute AND v_tool.risk_level = 'critical' THEN
      RAISE EXCEPTION 'Tools críticas não podem receber execução nesta fase' USING ERRCODE = '42501';
    END IF;

    IF p_can_execute AND v_tool.execution_mode = 'automatic_controlled' THEN
      RAISE EXCEPTION 'Execução automática controlada ainda não está liberada nesta fase' USING ERRCODE = '42501';
    END IF;

    IF p_can_execute AND v_tool.risk_level IN ('medium','high','critical') THEN
      v_required := true;
    END IF;

    IF v_tool.execution_mode = 'approval_required' AND p_can_execute THEN
      v_required := true;
    END IF;
  END IF;

  IF p_resource_id IS NOT NULL THEN
    SELECT read_scope INTO v_resource FROM public.mcp_resources WHERE id = p_resource_id;
    IF v_resource IS NULL THEN
      RAISE EXCEPTION 'Resource não encontrado' USING ERRCODE = '22023';
    END IF;

    IF v_resource.read_scope = 'admin_only' AND (p_can_suggest OR p_can_execute) THEN
      RAISE EXCEPTION 'Resources admin_only só permitem leitura (can_read)' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_prompt_id IS NOT NULL AND p_can_execute THEN
    RAISE EXCEPTION 'Execução de prompt não está liberada nesta sprint' USING ERRCODE = '42501';
  END IF;

  RETURN v_required;
END;
$$;

REVOKE ALL ON FUNCTION public._mcp_apply_object_security(uuid,uuid,uuid,boolean,boolean,boolean,boolean) FROM PUBLIC;

-- ---------------------------------------------------------------------
-- 3) RPC public.mcp_create_permission
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_create_permission(
  p_organization_id uuid,
  p_agent_id uuid DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_role_name text DEFAULT NULL,
  p_tool_id uuid DEFAULT NULL,
  p_resource_id uuid DEFAULT NULL,
  p_prompt_id uuid DEFAULT NULL,
  p_can_read boolean DEFAULT false,
  p_can_suggest boolean DEFAULT false,
  p_can_execute boolean DEFAULT false,
  p_requires_approval boolean DEFAULT true,
  p_max_calls_per_day integer DEFAULT NULL,
  p_allowed_scopes jsonb DEFAULT '[]'::jsonb,
  p_status text DEFAULT 'active',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_authorized boolean := false;
  v_subject_count int;
  v_object_count int;
  v_required boolean;
  v_new_id uuid;
  v_agent_org uuid;
  v_user_in_org boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization_id é obrigatório' USING ERRCODE = '22023';
  END IF;

  -- Autorização
  v_is_authorized := COALESCE(public.user_is_org_admin(p_organization_id), false)
                  OR COALESCE(public.is_platform_admin(v_caller), false);
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar MCP Permissions' USING ERRCODE = '42501';
  END IF;

  -- Exatamente 1 alvo
  v_subject_count :=
    (CASE WHEN p_agent_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_user_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_role_name IS NOT NULL AND length(trim(p_role_name)) > 0 THEN 1 ELSE 0 END);
  IF v_subject_count <> 1 THEN
    RAISE EXCEPTION 'Selecione exatamente um alvo: agente, usuário ou papel' USING ERRCODE = '22023';
  END IF;

  -- Exatamente 1 objeto
  v_object_count :=
    (CASE WHEN p_tool_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_resource_id IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN p_prompt_id IS NOT NULL THEN 1 ELSE 0 END);
  IF v_object_count <> 1 THEN
    RAISE EXCEPTION 'Selecione exatamente um objeto protegido: tool, resource ou prompt' USING ERRCODE = '22023';
  END IF;

  -- Status válido (CHECK também garante)
  IF p_status NOT IN ('active','inactive','archived') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  -- Pelo menos 1 ação se ativo
  IF p_status = 'active' AND NOT (COALESCE(p_can_read,false) OR COALESCE(p_can_suggest,false) OR COALESCE(p_can_execute,false)) THEN
    RAISE EXCEPTION 'Permissão ativa exige ao menos uma ação (read, suggest ou execute)' USING ERRCODE = '22023';
  END IF;

  -- max_calls_per_day
  IF p_max_calls_per_day IS NOT NULL AND p_max_calls_per_day <= 0 THEN
    RAISE EXCEPTION 'max_calls_per_day deve ser maior que zero' USING ERRCODE = '22023';
  END IF;

  -- JSON shapes
  IF jsonb_typeof(COALESCE(p_allowed_scopes, '[]'::jsonb)) <> 'array' THEN
    RAISE EXCEPTION 'allowed_scopes deve ser um JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(COALESCE(p_metadata, '{}'::jsonb)) <> 'object' THEN
    RAISE EXCEPTION 'metadata deve ser um JSON object' USING ERRCODE = '22023';
  END IF;

  -- Cross-org: agente
  IF p_agent_id IS NOT NULL THEN
    SELECT organization_id INTO v_agent_org FROM public.ai_agents WHERE id = p_agent_id;
    IF v_agent_org IS NULL THEN
      RAISE EXCEPTION 'Agente não encontrado' USING ERRCODE = '22023';
    END IF;
    IF v_agent_org <> p_organization_id THEN
      RAISE EXCEPTION 'Agente pertence a outra organização' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Cross-org: usuário
  IF p_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_id = p_organization_id AND user_id = p_user_id
    ) INTO v_user_in_org;
    IF NOT v_user_in_org THEN
      RAISE EXCEPTION 'Usuário não pertence a esta organização' USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Regras de segurança por objeto (pode ajustar requires_approval)
  v_required := public._mcp_apply_object_security(
    p_tool_id, p_resource_id, p_prompt_id,
    COALESCE(p_can_read,false), COALESCE(p_can_suggest,false), COALESCE(p_can_execute,false),
    COALESCE(p_requires_approval, true)
  );

  -- INSERT
  INSERT INTO public.mcp_permissions (
    organization_id, agent_id, user_id, role_name,
    tool_id, resource_id, prompt_id,
    can_read, can_suggest, can_execute,
    requires_approval, max_calls_per_day, allowed_scopes,
    status, metadata, created_by, updated_by
  ) VALUES (
    p_organization_id, p_agent_id, p_user_id, NULLIF(trim(p_role_name), ''),
    p_tool_id, p_resource_id, p_prompt_id,
    COALESCE(p_can_read,false), COALESCE(p_can_suggest,false), COALESCE(p_can_execute,false),
    v_required, p_max_calls_per_day, COALESCE(p_allowed_scopes, '[]'::jsonb),
    p_status, COALESCE(p_metadata, '{}'::jsonb), v_caller, v_caller
  )
  RETURNING id INTO v_new_id;

  PERFORM public.mcp_log_audit(
    p_entity_type := 'mcp_permission',
    p_action := 'created',
    p_organization_id := p_organization_id,
    p_user_id := v_caller,
    p_entity_id := v_new_id,
    p_after_json := to_jsonb((SELECT r FROM public.mcp_permissions r WHERE r.id = v_new_id)),
    p_metadata := jsonb_build_object('source','mcp_registry_ui','area','noid_intelligence','sprint','1.4')
  );

  RETURN v_new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_create_permission(uuid,uuid,uuid,text,uuid,uuid,uuid,boolean,boolean,boolean,boolean,integer,jsonb,text,jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 4) RPC public.mcp_update_permission
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_update_permission(
  p_permission_id uuid,
  p_can_read boolean DEFAULT NULL,
  p_can_suggest boolean DEFAULT NULL,
  p_can_execute boolean DEFAULT NULL,
  p_requires_approval boolean DEFAULT NULL,
  p_max_calls_per_day integer DEFAULT NULL,
  p_allowed_scopes jsonb DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_is_authorized boolean := false;
  v_existing public.mcp_permissions;
  v_before jsonb;
  v_after jsonb;
  v_can_read boolean;
  v_can_suggest boolean;
  v_can_execute boolean;
  v_status text;
  v_required boolean;
  v_max int;
  v_scopes jsonb;
  v_meta jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing FROM public.mcp_permissions WHERE id = p_permission_id;
  IF v_existing IS NULL THEN
    RAISE EXCEPTION 'Permissão não encontrada' USING ERRCODE = '22023';
  END IF;

  v_is_authorized := COALESCE(public.user_is_org_admin(v_existing.organization_id), false)
                  OR COALESCE(public.is_platform_admin(v_caller), false);
  IF NOT v_is_authorized THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar MCP Permissions' USING ERRCODE = '42501';
  END IF;

  v_can_read     := COALESCE(p_can_read,     v_existing.can_read);
  v_can_suggest  := COALESCE(p_can_suggest,  v_existing.can_suggest);
  v_can_execute  := COALESCE(p_can_execute,  v_existing.can_execute);
  v_status       := COALESCE(p_status,       v_existing.status);
  v_max          := COALESCE(p_max_calls_per_day, v_existing.max_calls_per_day);
  v_scopes       := COALESCE(p_allowed_scopes, v_existing.allowed_scopes);
  v_meta         := COALESCE(p_metadata, v_existing.metadata);

  IF v_status NOT IN ('active','inactive','archived') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  IF v_status = 'active' AND NOT (v_can_read OR v_can_suggest OR v_can_execute) THEN
    RAISE EXCEPTION 'Permissão ativa exige ao menos uma ação' USING ERRCODE = '22023';
  END IF;

  IF v_max IS NOT NULL AND v_max <= 0 THEN
    RAISE EXCEPTION 'max_calls_per_day deve ser maior que zero' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(v_scopes) <> 'array' THEN
    RAISE EXCEPTION 'allowed_scopes deve ser um JSON array' USING ERRCODE = '22023';
  END IF;
  IF jsonb_typeof(v_meta) <> 'object' THEN
    RAISE EXCEPTION 'metadata deve ser um JSON object' USING ERRCODE = '22023';
  END IF;

  v_required := public._mcp_apply_object_security(
    v_existing.tool_id, v_existing.resource_id, v_existing.prompt_id,
    v_can_read, v_can_suggest, v_can_execute,
    COALESCE(p_requires_approval, v_existing.requires_approval)
  );

  v_before := to_jsonb(v_existing);

  UPDATE public.mcp_permissions
     SET can_read = v_can_read,
         can_suggest = v_can_suggest,
         can_execute = v_can_execute,
         requires_approval = v_required,
         max_calls_per_day = v_max,
         allowed_scopes = v_scopes,
         status = v_status,
         metadata = v_meta,
         updated_by = v_caller,
         updated_at = now()
   WHERE id = p_permission_id;

  SELECT to_jsonb(r) INTO v_after FROM public.mcp_permissions r WHERE r.id = p_permission_id;

  PERFORM public.mcp_log_audit(
    p_entity_type := 'mcp_permission',
    p_action := 'updated',
    p_organization_id := v_existing.organization_id,
    p_user_id := v_caller,
    p_entity_id := p_permission_id,
    p_before_json := v_before,
    p_after_json := v_after,
    p_metadata := jsonb_build_object('source','mcp_registry_ui','area','noid_intelligence','sprint','1.4')
  );

  RETURN p_permission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_update_permission(uuid,boolean,boolean,boolean,boolean,integer,jsonb,text,jsonb) TO authenticated;

-- ---------------------------------------------------------------------
-- 5) RPC public.mcp_set_permission_status
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.mcp_set_permission_status(
  p_permission_id uuid,
  p_status text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_existing public.mcp_permissions;
  v_action text;
  v_before jsonb;
  v_after jsonb;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado' USING ERRCODE = '42501';
  END IF;

  IF p_status NOT IN ('active','inactive','archived') THEN
    RAISE EXCEPTION 'Status inválido' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing FROM public.mcp_permissions WHERE id = p_permission_id;
  IF v_existing IS NULL THEN
    RAISE EXCEPTION 'Permissão não encontrada' USING ERRCODE = '22023';
  END IF;

  IF NOT (COALESCE(public.user_is_org_admin(v_existing.organization_id), false)
          OR COALESCE(public.is_platform_admin(v_caller), false)) THEN
    RAISE EXCEPTION 'Você não tem permissão para gerenciar MCP Permissions' USING ERRCODE = '42501';
  END IF;

  IF p_status = 'active' AND NOT (v_existing.can_read OR v_existing.can_suggest OR v_existing.can_execute) THEN
    RAISE EXCEPTION 'Não é possível ativar uma permissão sem ações habilitadas' USING ERRCODE = '22023';
  END IF;

  v_before := to_jsonb(v_existing);

  UPDATE public.mcp_permissions
     SET status = p_status, updated_by = v_caller, updated_at = now()
   WHERE id = p_permission_id;

  SELECT to_jsonb(r) INTO v_after FROM public.mcp_permissions r WHERE r.id = p_permission_id;

  v_action := CASE p_status
                WHEN 'active' THEN 'activated'
                WHEN 'inactive' THEN 'deactivated'
                WHEN 'archived' THEN 'archived'
              END;

  PERFORM public.mcp_log_audit(
    p_entity_type := 'mcp_permission',
    p_action := v_action,
    p_organization_id := v_existing.organization_id,
    p_user_id := v_caller,
    p_entity_id := p_permission_id,
    p_before_json := v_before,
    p_after_json := v_after,
    p_metadata := jsonb_build_object('source','mcp_registry_ui','area','noid_intelligence','sprint','1.4')
  );

  RETURN p_permission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mcp_set_permission_status(uuid, text) TO authenticated;
