
-- Enums
DO $$ BEGIN
  CREATE TYPE public.kairos_batch_status AS ENUM ('pending','running','paused','completed','failed','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kairos_batch_stage AS ENUM ('matching','queue','enrichment','apollo','decision_maker','approach','ready','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.kairos_batch_item_status AS ENUM ('pending','running','done','skipped','failed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Runs
CREATE TABLE IF NOT EXISTS public.kairos_batch_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL,
  event_id UUID NULL,
  lead_search_id UUID NULL,
  run_name TEXT NOT NULL,
  run_type TEXT NOT NULL DEFAULT 'event',
  status public.kairos_batch_status NOT NULL DEFAULT 'pending',
  total_prospects INT NOT NULL DEFAULT 0,
  processed INT NOT NULL DEFAULT 0,
  skipped INT NOT NULL DEFAULT 0,
  failed INT NOT NULL DEFAULT 0,
  credits_estimated INT NOT NULL DEFAULT 0,
  credits_used INT NOT NULL DEFAULT 0,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kairos_batch_runs_org ON public.kairos_batch_runs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kairos_batch_runs_status ON public.kairos_batch_runs(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kairos_batch_runs TO authenticated;
GRANT ALL ON public.kairos_batch_runs TO service_role;
ALTER TABLE public.kairos_batch_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org batch runs" ON public.kairos_batch_runs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
                 WHERE om.organization_id = kairos_batch_runs.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Members can create org batch runs" ON public.kairos_batch_runs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
                      WHERE om.organization_id = kairos_batch_runs.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Members can update org batch runs" ON public.kairos_batch_runs
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
                 WHERE om.organization_id = kairos_batch_runs.organization_id AND om.user_id = auth.uid()));

-- Items
CREATE TABLE IF NOT EXISTS public.kairos_batch_run_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.kairos_batch_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  prospect_id UUID NOT NULL,
  current_stage public.kairos_batch_stage NOT NULL DEFAULT 'matching',
  status public.kairos_batch_item_status NOT NULL DEFAULT 'pending',
  message TEXT NULL,
  priority_rank INT NOT NULL DEFAULT 50,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kbri_run_status ON public.kairos_batch_run_items(run_id, status);
CREATE INDEX IF NOT EXISTS idx_kbri_run_priority ON public.kairos_batch_run_items(run_id, priority_rank DESC);
CREATE INDEX IF NOT EXISTS idx_kbri_prospect ON public.kairos_batch_run_items(prospect_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.kairos_batch_run_items TO authenticated;
GRANT ALL ON public.kairos_batch_run_items TO service_role;
ALTER TABLE public.kairos_batch_run_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org batch items" ON public.kairos_batch_run_items
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
                 WHERE om.organization_id = kairos_batch_run_items.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Members can manage org batch items" ON public.kairos_batch_run_items
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
                 WHERE om.organization_id = kairos_batch_run_items.organization_id AND om.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
                      WHERE om.organization_id = kairos_batch_run_items.organization_id AND om.user_id = auth.uid()));

-- Logs
CREATE TABLE IF NOT EXISTS public.kairos_batch_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.kairos_batch_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  prospect_id UUID NULL,
  action TEXT NOT NULL,
  result TEXT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_kbl_run_created ON public.kairos_batch_logs(run_id, created_at DESC);

GRANT SELECT, INSERT ON public.kairos_batch_logs TO authenticated;
GRANT ALL ON public.kairos_batch_logs TO service_role;
ALTER TABLE public.kairos_batch_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view org batch logs" ON public.kairos_batch_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.organization_members om
                 WHERE om.organization_id = kairos_batch_logs.organization_id AND om.user_id = auth.uid()));
CREATE POLICY "Members can insert org batch logs" ON public.kairos_batch_logs
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.organization_members om
                      WHERE om.organization_id = kairos_batch_logs.organization_id AND om.user_id = auth.uid()));

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.tg_kairos_batch_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_kbr_updated ON public.kairos_batch_runs;
CREATE TRIGGER trg_kbr_updated BEFORE UPDATE ON public.kairos_batch_runs
  FOR EACH ROW EXECUTE FUNCTION public.tg_kairos_batch_set_updated_at();

DROP TRIGGER IF EXISTS trg_kbri_updated ON public.kairos_batch_run_items;
CREATE TRIGGER trg_kbri_updated BEFORE UPDATE ON public.kairos_batch_run_items
  FOR EACH ROW EXECUTE FUNCTION public.tg_kairos_batch_set_updated_at();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.kairos_batch_runs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.kairos_batch_run_items;
