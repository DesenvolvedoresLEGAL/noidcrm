
CREATE POLICY nsec12_opportunities_insert_tenant_relations_guard
ON public.opportunities
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  (
    opportunities.pipeline_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.pipelines p
      WHERE p.id = opportunities.pipeline_id
        AND p.organization_id = opportunities.organization_id
    )
  )
  AND (
    opportunities.stage_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.stages s
      WHERE s.id = opportunities.stage_id
        AND s.organization_id = opportunities.organization_id
        AND (
          opportunities.pipeline_id IS NULL
          OR s.pipeline_id = opportunities.pipeline_id
        )
    )
  )
);
