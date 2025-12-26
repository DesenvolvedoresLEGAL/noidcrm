-- Add acquisition_channel column to organizations
ALTER TABLE public.organizations 
ADD COLUMN acquisition_channel TEXT DEFAULT 'plg';

-- Add comment explaining the values
COMMENT ON COLUMN public.organizations.acquisition_channel IS 'Source of acquisition: plg (Product-Led Growth / self-service trial) or slg (Sales-Led Growth / via proposal)';

-- Update existing organizations:
-- Organizations created via provision-client-organization (have slg_conversions) = 'slg'
-- Humanoid = 'internal'
-- Others = 'plg' (default)
UPDATE public.organizations 
SET acquisition_channel = 'slg'
WHERE id IN (SELECT DISTINCT organization_id FROM public.slg_conversions WHERE organization_id IS NOT NULL);

UPDATE public.organizations 
SET acquisition_channel = 'internal'
WHERE slug = 'humanoid';