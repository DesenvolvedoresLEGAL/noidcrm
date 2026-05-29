
-- Sprint OTE-SSoT: alinhar total_sales com commercial_won_revenue_view
-- e expor transparência por item (counts_for_commission)

ALTER TABLE public.ote_sales_records
  ADD COLUMN IF NOT EXISTS eligible_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS non_eligible_amount NUMERIC NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.ote_sales_record_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  ote_sales_record_id UUID NOT NULL REFERENCES public.ote_sales_records(id) ON DELETE CASCADE,
  proposal_item_id UUID,
  product_id UUID,
  product_name TEXT,
  billing_type TEXT,
  quantity NUMERIC,
  line_amount NUMERIC NOT NULL DEFAULT 0,
  mrr_amount NUMERIC NOT NULL DEFAULT 0,
  one_shot_amount NUMERIC NOT NULL DEFAULT 0,
  counts_toward_goal BOOLEAN NOT NULL DEFAULT TRUE,
  exclusion_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ote_sales_record_items_record
  ON public.ote_sales_record_items(ote_sales_record_id);
CREATE INDEX IF NOT EXISTS idx_ote_sales_record_items_org
  ON public.ote_sales_record_items(organization_id);

GRANT SELECT ON public.ote_sales_record_items TO authenticated;
GRANT ALL ON public.ote_sales_record_items TO service_role;

ALTER TABLE public.ote_sales_record_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Org members can view OTE item details"
  ON public.ote_sales_record_items;
CREATE POLICY "Org members can view OTE item details"
ON public.ote_sales_record_items
FOR SELECT
TO authenticated
USING (
  organization_id IN (
    SELECT om.organization_id FROM public.organization_members om
    WHERE om.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Service role manages OTE item details"
  ON public.ote_sales_record_items;
CREATE POLICY "Service role manages OTE item details"
ON public.ote_sales_record_items
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
