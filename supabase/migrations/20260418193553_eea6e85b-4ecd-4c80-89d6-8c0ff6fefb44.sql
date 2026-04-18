-- Sprint 2.6 — Reconciliation Logs for V2 Reports
CREATE TABLE IF NOT EXISTS public.report_reconciliation_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  report_key TEXT NOT NULL,
  check_key TEXT NOT NULL,
  expected_value NUMERIC,
  actual_value NUMERIC,
  delta_value NUMERIC,
  is_consistent BOOLEAN NOT NULL DEFAULT true,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info','warning','critical')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_reconciliation_logs_org_created
  ON public.report_reconciliation_logs (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_reconciliation_logs_report_key
  ON public.report_reconciliation_logs (organization_id, report_key, created_at DESC);

ALTER TABLE public.report_reconciliation_logs ENABLE ROW LEVEL SECURITY;

-- Members of the org can view their reconciliation logs
DROP POLICY IF EXISTS "org_members_can_view_reconciliation_logs" ON public.report_reconciliation_logs;
CREATE POLICY "org_members_can_view_reconciliation_logs"
  ON public.report_reconciliation_logs
  FOR SELECT
  TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- Only service role inserts (no RLS policy for INSERT means authenticated cannot insert)
-- Service role bypasses RLS automatically.

COMMENT ON TABLE public.report_reconciliation_logs IS
  'Sprint 2.6 — Logs de reconciliação cruzada entre views V2 de relatórios. Populado pela edge function report_reconcile_v2.';