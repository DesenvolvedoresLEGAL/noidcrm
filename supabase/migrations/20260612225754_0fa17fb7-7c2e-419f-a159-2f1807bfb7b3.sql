ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS qualification_loss_reason text,
  ADD COLUMN IF NOT EXISTS remarketing_source text,
  ADD COLUMN IF NOT EXISTS remarketing_reason text,
  ADD COLUMN IF NOT EXISTS remarketing_status text,
  ADD COLUMN IF NOT EXISTS remarketing_created_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_opportunities_remarketing_dedup
  ON public.opportunities (source_opportunity_id)
  WHERE remarketing_source IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_opportunities_qualification_loss_reason
  ON public.opportunities (organization_id, qualification_loss_reason)
  WHERE qualification_loss_reason IS NOT NULL AND deleted_at IS NULL;