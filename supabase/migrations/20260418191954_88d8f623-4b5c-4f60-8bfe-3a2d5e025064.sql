-- =====================================================================
-- SPRINT 2.3 — Real Stage / Owner / Qualification History
-- =====================================================================

-- 1. TABLES ----------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.opportunity_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  pipeline_id text NOT NULL,
  from_stage_id text NULL,
  to_stage_id text NOT NULL,
  changed_by_user_id uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_osh_org_opportunity_changed_at
  ON public.opportunity_stage_history (organization_id, opportunity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_osh_org_to_stage_changed_at
  ON public.opportunity_stage_history (organization_id, to_stage_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_osh_org_pipeline_changed_at
  ON public.opportunity_stage_history (organization_id, pipeline_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.opportunity_owner_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  from_owner_user_id uuid NULL,
  to_owner_user_id uuid NULL,
  changed_by_user_id uuid NULL,
  changed_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_ooh_org_opportunity_changed_at
  ON public.opportunity_owner_history (organization_id, opportunity_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ooh_org_to_owner_changed_at
  ON public.opportunity_owner_history (organization_id, to_owner_user_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS public.opportunity_qualification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  opportunity_id uuid NOT NULL REFERENCES public.opportunities(id) ON DELETE CASCADE,
  qualified_by_user_id uuid NULL,
  qualification_at timestamptz NOT NULL,
  source text NOT NULL DEFAULT 'system',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_oqh_org_opportunity_qualification_at
  ON public.opportunity_qualification_history (organization_id, opportunity_id, qualification_at DESC);
CREATE INDEX IF NOT EXISTS idx_oqh_org_qualified_by_qualification_at
  ON public.opportunity_qualification_history (organization_id, qualified_by_user_id, qualification_at DESC);

-- 2. RLS -------------------------------------------------------------

ALTER TABLE public.opportunity_stage_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_owner_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opportunity_qualification_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osh_select_org_members" ON public.opportunity_stage_history;
CREATE POLICY "osh_select_org_members"
  ON public.opportunity_stage_history FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "ooh_select_org_members" ON public.opportunity_owner_history;
CREATE POLICY "ooh_select_org_members"
  ON public.opportunity_owner_history FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

DROP POLICY IF EXISTS "oqh_select_org_members" ON public.opportunity_qualification_history;
CREATE POLICY "oqh_select_org_members"
  ON public.opportunity_qualification_history FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- 3. TRIGGER FUNCTIONS -----------------------------------------------

CREATE OR REPLACE FUNCTION public.track_opportunity_stage_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.stage_id IS NOT NULL AND NEW.pipeline_id IS NOT NULL THEN
      INSERT INTO public.opportunity_stage_history (
        organization_id, opportunity_id, pipeline_id,
        from_stage_id, to_stage_id, changed_by_user_id, changed_at, source
      ) VALUES (
        NEW.organization_id, NEW.id, NEW.pipeline_id,
        NULL, NEW.stage_id, auth.uid(), COALESCE(NEW.created_at, now()), 'created'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage_id IS DISTINCT FROM OLD.stage_id AND NEW.stage_id IS NOT NULL THEN
      INSERT INTO public.opportunity_stage_history (
        organization_id, opportunity_id, pipeline_id,
        from_stage_id, to_stage_id, changed_by_user_id, changed_at, source
      ) VALUES (
        NEW.organization_id, NEW.id, NEW.pipeline_id,
        OLD.stage_id, NEW.stage_id, auth.uid(), now(), 'stage_change'
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_opportunity_owner_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.owner_user_id IS NOT NULL THEN
      INSERT INTO public.opportunity_owner_history (
        organization_id, opportunity_id,
        from_owner_user_id, to_owner_user_id, changed_by_user_id, changed_at, source
      ) VALUES (
        NEW.organization_id, NEW.id,
        NULL, NEW.owner_user_id, auth.uid(), COALESCE(NEW.created_at, now()), 'created'
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id THEN
      INSERT INTO public.opportunity_owner_history (
        organization_id, opportunity_id,
        from_owner_user_id, to_owner_user_id, changed_by_user_id, changed_at, source
      ) VALUES (
        NEW.organization_id, NEW.id,
        OLD.owner_user_id, NEW.owner_user_id, auth.uid(), now(), 'owner_change'
      );
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.track_opportunity_qualification_history()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_qual_at timestamptz;
  v_should_log boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.qualified_at IS NOT NULL OR NEW.qualified_by_user_id IS NOT NULL THEN
      v_should_log := true;
      v_qual_at := COALESCE(NEW.qualified_at, now());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (NEW.qualified_at IS NOT NULL AND OLD.qualified_at IS NULL)
       OR (NEW.qualified_by_user_id IS NOT NULL AND OLD.qualified_by_user_id IS NULL)
       OR (NEW.qualified_at IS DISTINCT FROM OLD.qualified_at AND NEW.qualified_at IS NOT NULL)
    THEN
      v_should_log := true;
      v_qual_at := COALESCE(NEW.qualified_at, now());
    END IF;
  END IF;

  IF v_should_log THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.opportunity_qualification_history
      WHERE opportunity_id = NEW.id
        AND qualification_at = v_qual_at
    ) THEN
      INSERT INTO public.opportunity_qualification_history (
        organization_id, opportunity_id,
        qualified_by_user_id, qualification_at, source
      ) VALUES (
        NEW.organization_id, NEW.id,
        NEW.qualified_by_user_id, v_qual_at,
        CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'qualification_change' END
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. TRIGGERS --------------------------------------------------------

DROP TRIGGER IF EXISTS trg_track_opportunity_stage_history ON public.opportunities;
CREATE TRIGGER trg_track_opportunity_stage_history
  AFTER INSERT OR UPDATE OF stage_id ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_stage_history();

DROP TRIGGER IF EXISTS trg_track_opportunity_owner_history ON public.opportunities;
CREATE TRIGGER trg_track_opportunity_owner_history
  AFTER INSERT OR UPDATE OF owner_user_id ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_owner_history();

DROP TRIGGER IF EXISTS trg_track_opportunity_qualification_history ON public.opportunities;
CREATE TRIGGER trg_track_opportunity_qualification_history
  AFTER INSERT OR UPDATE OF qualified_at, qualified_by_user_id ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.track_opportunity_qualification_history();

-- 5. CONSERVATIVE BACKFILL -------------------------------------------

INSERT INTO public.opportunity_stage_history (
  organization_id, opportunity_id, pipeline_id,
  from_stage_id, to_stage_id, changed_by_user_id, changed_at, source
)
SELECT
  o.organization_id, o.id, o.pipeline_id,
  NULL, o.stage_id, NULL, COALESCE(o.created_at, now()), 'backfill_initial_stage'
FROM public.opportunities o
WHERE o.deleted_at IS NULL
  AND o.stage_id IS NOT NULL
  AND o.pipeline_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_stage_history h WHERE h.opportunity_id = o.id
  );

INSERT INTO public.opportunity_owner_history (
  organization_id, opportunity_id,
  from_owner_user_id, to_owner_user_id, changed_by_user_id, changed_at, source
)
SELECT
  o.organization_id, o.id,
  NULL, o.owner_user_id, NULL, COALESCE(o.created_at, now()), 'backfill_initial_owner'
FROM public.opportunities o
WHERE o.deleted_at IS NULL
  AND o.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_owner_history h WHERE h.opportunity_id = o.id
  );

INSERT INTO public.opportunity_qualification_history (
  organization_id, opportunity_id,
  qualified_by_user_id, qualification_at, source
)
SELECT
  o.organization_id, o.id,
  o.qualified_by_user_id, o.qualified_at, 'backfill_explicit_qualification'
FROM public.opportunities o
WHERE o.deleted_at IS NULL
  AND o.qualified_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.opportunity_qualification_history h
    WHERE h.opportunity_id = o.id AND h.qualification_at = o.qualified_at
  );

-- 6. VIEWS -----------------------------------------------------------

DROP VIEW IF EXISTS public.v_opportunity_current_stage_entry_v2 CASCADE;
CREATE VIEW public.v_opportunity_current_stage_entry_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.opportunity_id)
  h.opportunity_id, h.organization_id, h.pipeline_id,
  h.to_stage_id AS current_stage_id, h.from_stage_id,
  h.changed_at AS entered_current_stage_at,
  h.source, h.changed_by_user_id
FROM public.opportunity_stage_history h
ORDER BY h.opportunity_id, h.changed_at DESC, h.id DESC;

DROP VIEW IF EXISTS public.v_opportunity_stage_age_v2 CASCADE;
CREATE VIEW public.v_opportunity_stage_age_v2
WITH (security_invoker = true) AS
SELECT
  hb.id AS opportunity_id,
  hb.organization_id,
  e.current_stage_id,
  e.entered_current_stage_at,
  EXTRACT(EPOCH FROM (now() - e.entered_current_stage_at)) / 3600.0 AS hours_in_current_stage,
  EXTRACT(EPOCH FROM (now() - e.entered_current_stage_at)) / 86400.0 AS days_in_current_stage
FROM public.v_opportunities_hygiene_base hb
LEFT JOIN public.v_opportunity_current_stage_entry_v2 e ON e.opportunity_id = hb.id;

DROP VIEW IF EXISTS public.v_opportunity_first_owner_v2 CASCADE;
CREATE VIEW public.v_opportunity_first_owner_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.opportunity_id)
  h.opportunity_id, h.organization_id,
  h.to_owner_user_id AS first_owner_user_id,
  h.changed_at AS first_owner_at, h.source
FROM public.opportunity_owner_history h
ORDER BY h.opportunity_id, h.changed_at ASC, h.id ASC;

DROP VIEW IF EXISTS public.v_opportunity_current_owner_v2 CASCADE;
CREATE VIEW public.v_opportunity_current_owner_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.opportunity_id)
  h.opportunity_id, h.organization_id,
  h.to_owner_user_id AS current_owner_user_id,
  h.changed_at AS current_owner_since, h.source
FROM public.opportunity_owner_history h
ORDER BY h.opportunity_id, h.changed_at DESC, h.id DESC;

DROP VIEW IF EXISTS public.v_opportunity_first_qualification_v2 CASCADE;
CREATE VIEW public.v_opportunity_first_qualification_v2
WITH (security_invoker = true) AS
SELECT DISTINCT ON (h.opportunity_id)
  h.opportunity_id, h.organization_id,
  h.qualified_by_user_id AS first_qualified_by_user_id,
  h.qualification_at AS first_qualification_at, h.source
FROM public.opportunity_qualification_history h
ORDER BY h.opportunity_id, h.qualification_at ASC, h.id ASC;

DROP VIEW IF EXISTS public.v_opportunity_history_coverage_v2 CASCADE;
CREATE VIEW public.v_opportunity_history_coverage_v2
WITH (security_invoker = true) AS
WITH base AS (
  SELECT
    hb.organization_id,
    hb.id AS opportunity_id,
    EXISTS (SELECT 1 FROM public.opportunity_stage_history h WHERE h.opportunity_id = hb.id) AS has_stage,
    EXISTS (SELECT 1 FROM public.opportunity_owner_history h WHERE h.opportunity_id = hb.id) AS has_owner,
    EXISTS (SELECT 1 FROM public.opportunity_qualification_history h WHERE h.opportunity_id = hb.id) AS has_qual
  FROM public.v_opportunities_hygiene_base hb
)
SELECT
  organization_id,
  COUNT(*)::bigint AS total_opportunities,
  COUNT(*) FILTER (WHERE has_stage)::bigint AS with_stage_history,
  COUNT(*) FILTER (WHERE has_owner)::bigint AS with_owner_history,
  COUNT(*) FILTER (WHERE has_qual)::bigint  AS with_qualification_history,
  CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE has_stage))::numeric * 100.0 / COUNT(*), 2) ELSE 0 END AS stage_history_coverage_pct,
  CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE has_owner))::numeric * 100.0 / COUNT(*), 2) ELSE 0 END AS owner_history_coverage_pct,
  CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE has_qual))::numeric * 100.0 / COUNT(*), 2) ELSE 0 END AS qualification_history_coverage_pct
FROM base
GROUP BY organization_id;