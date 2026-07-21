-- NSEC-1.2-CHG-014
-- Aditiva. RESTRICTIVE. Somente INSERT. Somente WITH CHECK.
-- Não remove nem altera nenhuma policy existente.
-- Papel efetivo: org_role quando NOT NULL, caso contrário role legado.

CREATE POLICY nsec12_opportunities_insert_block_viewer
ON public.opportunities
AS RESTRICTIVE
FOR INSERT
TO authenticated
WITH CHECK (
  NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = opportunities.organization_id
      AND om.status = 'active'
      AND (
        (om.org_role IS NOT NULL AND om.org_role = 'viewer'::org_role)
        OR (om.org_role IS NULL AND om.role = 'viewer')
      )
  )
);