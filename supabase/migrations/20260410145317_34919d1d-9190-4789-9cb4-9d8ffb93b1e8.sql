
CREATE OR REPLACE FUNCTION public.initialize_agent_environments(p_organization_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.ai_agent_environments (organization_id, environment, allow_execution, require_approval, allow_autonomous, max_actions_per_hour)
  VALUES
    (p_organization_id, 'draft', false, true, false, 0),
    (p_organization_id, 'test', true, true, false, 50),
    (p_organization_id, 'production', true, false, true, 500),
    (p_organization_id, 'paused', false, true, false, 0)
  ON CONFLICT (organization_id, environment) DO NOTHING;
END;
$$;
