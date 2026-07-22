-- NOID-VERTICAL-1.0-VERT-01.2B
-- Canonical inventory provider selection per tenant.

CREATE TABLE IF NOT EXISTS public.inventory_provider_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  selection_source text NOT NULL DEFAULT 'manual',
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_provider_settings_provider_type_chk
    CHECK (provider_type IN ('native','eventrix')),
  CONSTRAINT inventory_provider_settings_selection_source_chk
    CHECK (selection_source IN ('manual','legacy_backfill','legacy_eventrix_settings'))
);

CREATE UNIQUE INDEX IF NOT EXISTS inventory_provider_settings_org_uniq
  ON public.inventory_provider_settings(organization_id);

GRANT SELECT, INSERT, UPDATE ON public.inventory_provider_settings TO authenticated;
GRANT ALL ON public.inventory_provider_settings TO service_role;

ALTER TABLE public.inventory_provider_settings ENABLE ROW LEVEL SECURITY;

-- SELECT: any active member of the org (needed by resolver for every user).
CREATE POLICY inventory_provider_settings_select
  ON public.inventory_provider_settings
  FOR SELECT
  TO authenticated
  USING (public.user_is_org_member(organization_id));

-- INSERT: only owners/admins of the org.
CREATE POLICY inventory_provider_settings_insert
  ON public.inventory_provider_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.user_is_org_admin(organization_id));

-- UPDATE: only owners/admins of the org.
CREATE POLICY inventory_provider_settings_update
  ON public.inventory_provider_settings
  FOR UPDATE
  TO authenticated
  USING (public.user_is_org_admin(organization_id))
  WITH CHECK (public.user_is_org_admin(organization_id));

-- updated_at trigger reuses existing function.
DROP TRIGGER IF EXISTS trg_inventory_provider_settings_updated_at
  ON public.inventory_provider_settings;
CREATE TRIGGER trg_inventory_provider_settings_updated_at
  BEFORE UPDATE ON public.inventory_provider_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Controlled backfill: only orgs with active Eventrix integration.
INSERT INTO public.inventory_provider_settings
  (organization_id, provider_type, is_enabled, selection_source)
SELECT s.organization_id, 'eventrix', true, 'legacy_backfill'
FROM public.eventrix_inventory_integration_settings s
WHERE s.is_enabled = true
ON CONFLICT (organization_id) DO NOTHING;