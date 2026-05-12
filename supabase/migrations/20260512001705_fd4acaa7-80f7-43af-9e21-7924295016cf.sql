
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS event_end_date date;

ALTER TABLE public.opportunities
  ADD COLUMN IF NOT EXISTS event_end_date date;

ALTER TABLE public.acceptance_effect_jobs
  ADD COLUMN IF NOT EXISTS inventory_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS inventory_status text,
  ADD COLUMN IF NOT EXISTS inventory_error text,
  ADD COLUMN IF NOT EXISTS inventory_pre_reservation_id uuid,
  ADD COLUMN IF NOT EXISTS inventory_details jsonb;

CREATE INDEX IF NOT EXISTS idx_acceptance_effect_jobs_inventory_pending
  ON public.acceptance_effect_jobs(status)
  WHERE inventory_processed_at IS NULL;
