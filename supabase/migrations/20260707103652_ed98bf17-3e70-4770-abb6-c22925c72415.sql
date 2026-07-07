-- =========================================================
-- Sprint NOID-INV-CONNECT 0.2
-- Eventrix Integration Settings + Sync Cache
-- =========================================================

-- Helper: read access to Eventrix inventory settings (broader than write)
CREATE OR REPLACE FUNCTION public.user_can_read_eventrix_inventory(p_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = auth.uid()
      AND organization_id = p_org_id
      AND status = 'active'
      AND deleted_at IS NULL
      AND org_role::text IN ('owner','admin','operations','commercial_manager','sales_manager')
  );
$$;

-- =========================================================
-- 1) eventrix_inventory_integration_settings
-- =========================================================
CREATE TABLE IF NOT EXISTS public.eventrix_inventory_integration_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,

  environment text NOT NULL DEFAULT 'sandbox'
    CHECK (environment IN ('sandbox','production')),
  base_url text NULL,
  api_key_secret_name text NULL,

  status text NOT NULL DEFAULT 'not_configured'
    CHECK (status IN ('not_configured','configured','connected','error','disabled')),

  last_connection_check_at timestamptz NULL,
  last_connection_status text NULL,
  last_connection_message text NULL,

  last_sync_at timestamptz NULL,
  last_sync_status text NULL,
  last_sync_message text NULL,

  is_enabled boolean NOT NULL DEFAULT false,

  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventrix_inv_settings_org
  ON public.eventrix_inventory_integration_settings(organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventrix_inv_settings_unique_org
  ON public.eventrix_inventory_integration_settings(organization_id);

GRANT SELECT, INSERT, UPDATE ON public.eventrix_inventory_integration_settings TO authenticated;
GRANT ALL ON public.eventrix_inventory_integration_settings TO service_role;

ALTER TABLE public.eventrix_inventory_integration_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventrix_inv_settings_select"
  ON public.eventrix_inventory_integration_settings
  FOR SELECT TO authenticated
  USING (public.user_can_read_eventrix_inventory(organization_id));

CREATE POLICY "eventrix_inv_settings_insert"
  ON public.eventrix_inventory_integration_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE POLICY "eventrix_inv_settings_update"
  ON public.eventrix_inventory_integration_settings
  FOR UPDATE TO authenticated
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE TRIGGER trg_eventrix_inv_settings_updated_at
  BEFORE UPDATE ON public.eventrix_inventory_integration_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 2) eventrix_inventory_sync_cache
-- =========================================================
CREATE TABLE IF NOT EXISTS public.eventrix_inventory_sync_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,

  eventrix_entity_id text NOT NULL,
  entity_type text NOT NULL
    CHECK (entity_type IN ('category','family')),

  name text NOT NULL,
  description text NULL,

  parent_eventrix_entity_id text NULL,

  control_mode text NULL,
  item_kind text NULL,

  is_active boolean NOT NULL DEFAULT true,

  payload jsonb NOT NULL DEFAULT '{}'::jsonb,

  synced_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventrix_inv_sync_cache_org
  ON public.eventrix_inventory_sync_cache(organization_id);

CREATE INDEX IF NOT EXISTS idx_eventrix_inv_sync_cache_type
  ON public.eventrix_inventory_sync_cache(organization_id, entity_type);

CREATE INDEX IF NOT EXISTS idx_eventrix_inv_sync_cache_parent
  ON public.eventrix_inventory_sync_cache(organization_id, parent_eventrix_entity_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eventrix_inv_sync_cache_unique_entity
  ON public.eventrix_inventory_sync_cache(organization_id, entity_type, eventrix_entity_id);

GRANT SELECT, INSERT, UPDATE ON public.eventrix_inventory_sync_cache TO authenticated;
GRANT ALL ON public.eventrix_inventory_sync_cache TO service_role;

ALTER TABLE public.eventrix_inventory_sync_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "eventrix_inv_sync_cache_select"
  ON public.eventrix_inventory_sync_cache
  FOR SELECT TO authenticated
  USING (public.user_can_read_eventrix_inventory(organization_id));

CREATE POLICY "eventrix_inv_sync_cache_insert"
  ON public.eventrix_inventory_sync_cache
  FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE POLICY "eventrix_inv_sync_cache_update"
  ON public.eventrix_inventory_sync_cache
  FOR UPDATE TO authenticated
  USING (public.user_can_access_inventory(organization_id))
  WITH CHECK (public.user_can_access_inventory(organization_id));

CREATE TRIGGER trg_eventrix_inv_sync_cache_updated_at
  BEFORE UPDATE ON public.eventrix_inventory_sync_cache
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();