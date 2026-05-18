ALTER TABLE public.prospects ADD COLUMN IF NOT EXISTS relationship_status text;

CREATE INDEX IF NOT EXISTS idx_prospects_org_relationship_status
  ON public.prospects (organization_id, relationship_status)
  WHERE relationship_status IS NOT NULL;