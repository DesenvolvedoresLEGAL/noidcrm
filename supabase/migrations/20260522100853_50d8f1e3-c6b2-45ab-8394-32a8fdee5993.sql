ALTER TABLE public.ote_sales_records
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS pipeline_id uuid,
  ADD COLUMN IF NOT EXISTS pipeline_name text,
  ADD COLUMN IF NOT EXISTS mrr_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS one_shot_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS counts_toward_goal boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS exclusion_reason text,
  ADD COLUMN IF NOT EXISTS record_kind text NOT NULL DEFAULT 'sale',
  ADD COLUMN IF NOT EXISTS revenue_confidence text;

CREATE INDEX IF NOT EXISTS idx_ote_sales_records_result ON public.ote_sales_records(ote_result_id);
CREATE INDEX IF NOT EXISTS idx_ote_sales_records_org_closed ON public.ote_sales_records(organization_id, closed_at);