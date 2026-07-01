
-- NOID Skills Engine — NS.01

-- Enums
DO $$ BEGIN
  CREATE TYPE public.noid_skill_status AS ENUM ('draft','active','deprecated','archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.noid_skill_category AS ENUM (
    'prospecting','qualification','objection_handling','negotiation','follow_up',
    'reactivation','proposal','technical_explanation','pricing','handoff','next_best_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.noid_skill_type AS ENUM (
    'message_generation','classification','recommendation','objection_response',
    'qualification_question','summary','next_best_action'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.noid_skill_run_status AS ENUM ('success','schema_invalid','guardrail_blocked','error','playground');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.noid_skill_feedback_type AS ENUM (
    'positive','negative','edited_by_user','used_in_outreach','ignored','converted','failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 1) noid_skills (org_id NULL = skill global/plataforma)
CREATE TABLE IF NOT EXISTS public.noid_skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL,
  category public.noid_skill_category NOT NULL,
  skill_type public.noid_skill_type NOT NULL,
  status public.noid_skill_status NOT NULL DEFAULT 'draft',
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  system_prompt text NOT NULL DEFAULT '',
  task_prompt text NOT NULL DEFAULT '',
  guardrails jsonb NOT NULL DEFAULT '{}'::jsonb,
  examples jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  failure_modes jsonb NOT NULL DEFAULT '[]'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS noid_skills_org_slug_version_uidx
  ON public.noid_skills (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid), slug, version);
CREATE INDEX IF NOT EXISTS noid_skills_org_status_idx ON public.noid_skills (organization_id, status);
CREATE INDEX IF NOT EXISTS noid_skills_category_idx ON public.noid_skills (category);
CREATE INDEX IF NOT EXISTS noid_skills_slug_idx ON public.noid_skills (slug);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.noid_skills TO authenticated;
GRANT ALL ON public.noid_skills TO service_role;

ALTER TABLE public.noid_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noid_skills_select_org_or_global"
  ON public.noid_skills FOR SELECT TO authenticated
  USING (
    organization_id IS NULL
    OR organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "noid_skills_insert_admin"
  ON public.noid_skills FOR INSERT TO authenticated
  WITH CHECK (
    (organization_id IS NOT NULL
      AND organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "noid_skills_update_admin"
  ON public.noid_skills FOR UPDATE TO authenticated
  USING (
    (organization_id IS NOT NULL
      AND organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "noid_skills_delete_admin"
  ON public.noid_skills FOR DELETE TO authenticated
  USING (
    (organization_id IS NOT NULL
      AND organization_id IN (
        SELECT organization_id FROM public.organization_members
        WHERE user_id = auth.uid() AND role IN ('owner','admin')
      ))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_noid_skills_touch ON public.noid_skills;
CREATE TRIGGER trg_noid_skills_touch BEFORE UPDATE ON public.noid_skills
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- 2) noid_skill_runs
CREATE TABLE IF NOT EXISTS public.noid_skill_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  skill_id uuid NOT NULL REFERENCES public.noid_skills(id) ON DELETE CASCADE,
  prospect_id uuid,
  account_id uuid,
  opportunity_id uuid,
  contact_id uuid,
  source_module text,
  input_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_payload jsonb,
  model_used text,
  status public.noid_skill_run_status NOT NULL DEFAULT 'success',
  confidence_score numeric,
  quality_score numeric,
  latency_ms integer,
  error_message text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS noid_skill_runs_org_created_idx ON public.noid_skill_runs (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS noid_skill_runs_skill_idx ON public.noid_skill_runs (skill_id, created_at DESC);
CREATE INDEX IF NOT EXISTS noid_skill_runs_source_idx ON public.noid_skill_runs (source_module);

GRANT SELECT, INSERT ON public.noid_skill_runs TO authenticated;
GRANT ALL ON public.noid_skill_runs TO service_role;

ALTER TABLE public.noid_skill_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noid_skill_runs_select_org"
  ON public.noid_skill_runs FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "noid_skill_runs_insert_org"
  ON public.noid_skill_runs FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- 3) noid_skill_feedback
CREATE TABLE IF NOT EXISTS public.noid_skill_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE,
  skill_run_id uuid NOT NULL REFERENCES public.noid_skill_runs(id) ON DELETE CASCADE,
  rating numeric,
  feedback_type public.noid_skill_feedback_type NOT NULL,
  feedback_notes text,
  outcome_event_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS noid_skill_feedback_run_idx ON public.noid_skill_feedback (skill_run_id);
CREATE INDEX IF NOT EXISTS noid_skill_feedback_org_idx ON public.noid_skill_feedback (organization_id, created_at DESC);

GRANT SELECT, INSERT ON public.noid_skill_feedback TO authenticated;
GRANT ALL ON public.noid_skill_feedback TO service_role;

ALTER TABLE public.noid_skill_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "noid_skill_feedback_select_org"
  ON public.noid_skill_feedback FOR SELECT TO authenticated
  USING (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "noid_skill_feedback_insert_org"
  ON public.noid_skill_feedback FOR INSERT TO authenticated
  WITH CHECK (
    organization_id IN (SELECT organization_id FROM public.organization_members WHERE user_id = auth.uid())
  );

-- 4) Metrics view
CREATE OR REPLACE VIEW public.v_noid_skill_metrics
WITH (security_invoker = true)
AS
SELECT
  s.id AS skill_id,
  s.organization_id,
  s.slug,
  s.name,
  s.category,
  s.skill_type,
  s.status,
  s.version,
  COUNT(r.id) AS run_count,
  COUNT(r.id) FILTER (WHERE r.status = 'success') AS success_count,
  COUNT(f.id) FILTER (WHERE f.feedback_type IN ('positive','used_in_outreach','converted')) AS positive_feedback,
  COUNT(f.id) FILTER (WHERE f.feedback_type IN ('negative','ignored','failed')) AS negative_feedback,
  COUNT(f.id) FILTER (WHERE f.feedback_type = 'edited_by_user') AS edited_count,
  percentile_cont(0.5) WITHIN GROUP (ORDER BY r.latency_ms) AS latency_p50_ms,
  MAX(r.created_at) AS last_run_at
FROM public.noid_skills s
LEFT JOIN public.noid_skill_runs r ON r.skill_id = s.id
LEFT JOIN public.noid_skill_feedback f ON f.skill_run_id = r.id
GROUP BY s.id;

GRANT SELECT ON public.v_noid_skill_metrics TO authenticated, service_role;
