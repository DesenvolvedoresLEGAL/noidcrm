-- Estende tabela de auditoria
ALTER TABLE public.crm_closer_dashboard_views
  ADD COLUMN IF NOT EXISTS period text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Garante valores válidos para source
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'crm_closer_dashboard_views_source_valid'
  ) THEN
    ALTER TABLE public.crm_closer_dashboard_views
      ADD CONSTRAINT crm_closer_dashboard_views_source_valid
      CHECK (source IN ('preview', 'runtime'));
  END IF;
END $$;

-- RPC: registra visualização do dashboard do closer
CREATE OR REPLACE FUNCTION public.crm_log_closer_dashboard_view(
  p_tenant_id uuid,
  p_target_user_id uuid,
  p_source text DEFAULT 'preview',
  p_period text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_viewer IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF p_source NOT IN ('preview', 'runtime') THEN
    RAISE EXCEPTION 'invalid source: %', p_source;
  END IF;

  IF NOT user_belongs_to_tenant(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: viewer not in tenant';
  END IF;

  INSERT INTO public.crm_closer_dashboard_views (
    tenant_id, viewer_user_id, target_user_id, source, period, metadata
  ) VALUES (
    p_tenant_id, v_viewer, p_target_user_id, p_source, p_period, COALESCE(p_metadata, '{}'::jsonb)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_log_closer_dashboard_view(uuid, uuid, text, text, jsonb) TO authenticated;

-- RPC: ativa/desativa dashboard dinâmico por usuário (Owner/Admin only)
CREATE OR REPLACE FUNCTION public.crm_set_user_dynamic_dashboard(
  p_tenant_id uuid,
  p_user_id uuid,
  p_enabled boolean
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF NOT is_tenant_admin_or_owner(p_tenant_id) THEN
    RAISE EXCEPTION 'forbidden: only owners/admins';
  END IF;

  UPDATE public.crm_user_contexts
     SET is_dashboard_dynamic_enabled = p_enabled,
         updated_at = now()
   WHERE tenant_id = p_tenant_id
     AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'user context not found for tenant=% user=%', p_tenant_id, p_user_id;
  END IF;

  RETURN p_enabled;
END;
$$;

GRANT EXECUTE ON FUNCTION public.crm_set_user_dynamic_dashboard(uuid, uuid, boolean) TO authenticated;