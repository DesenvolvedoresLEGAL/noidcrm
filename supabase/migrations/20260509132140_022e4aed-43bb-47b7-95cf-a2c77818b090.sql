
CREATE OR REPLACE VIEW public.mcp_action_catalog_view
WITH (security_invoker = true) AS
SELECT
  ar.action_key                        AS tool_name,
  ar.name,
  ar.domain,
  ar.description,
  ar.input_schema,
  ar.output_schema,
  ar.risk_level,
  ar.approval_required,
  ar.required_role,
  ar.executor_type,
  ar.available_surfaces,
  ar.audit_enabled,
  ar.agent_executable,
  ar.human_executable,
  ar.is_active,
  jsonb_build_object(
    'register_rpc', 'register_action_execution',
    'complete_rpc', 'complete_action_execution',
    'action_key',   ar.action_key
  )                                     AS invocation_contract
FROM public.action_registry ar
WHERE ar.is_active = true;

COMMENT ON VIEW public.mcp_action_catalog_view IS
  'Sprint C — Catálogo MCP global de ações executáveis por agentes/UI, derivado de action_registry. Toda invocação passa por register_action_execution + complete_action_execution.';

GRANT SELECT ON public.mcp_action_catalog_view TO authenticated;

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_approval_request_slack()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url  text;
  v_anon text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  v_url  := current_setting('app.settings.supabase_url', true);
  v_anon := current_setting('app.settings.supabase_anon_key', true);

  IF v_url IS NULL OR v_anon IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_url || '/functions/v1/notify-approval-request',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer ' || v_anon
               ),
    body    := jsonb_build_object('approval_id', NEW.id)
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_approval_request_slack failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_approval_request_slack ON public.approval_requests;
CREATE TRIGGER trg_notify_approval_request_slack
AFTER INSERT ON public.approval_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_approval_request_slack();
