
-- 1) Soft-delete existing duplicates per (org, pipeline, source_opportunity_id),
--    keeping the FIRST created one. Marks the duplicates as deleted.
WITH ranked AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY organization_id, pipeline_id, source_opportunity_id
           ORDER BY created_at ASC
         ) AS rn
  FROM public.opportunities
  WHERE deleted_at IS NULL
    AND source_opportunity_id IS NOT NULL
)
UPDATE public.opportunities o
SET deleted_at = now(),
    status = CASE WHEN o.status IN ('won','lost') THEN o.status ELSE 'lost' END
FROM ranked r
WHERE o.id = r.id
  AND r.rn > 1;

-- 2) Prevent future duplicates atomically. Race-safe across concurrent
--    workflow runs that try to duplicate the same source opportunity into
--    the same target pipeline.
CREATE UNIQUE INDEX IF NOT EXISTS opportunities_no_duplicate_handoff_uidx
  ON public.opportunities (organization_id, pipeline_id, source_opportunity_id)
  WHERE deleted_at IS NULL AND source_opportunity_id IS NOT NULL;
