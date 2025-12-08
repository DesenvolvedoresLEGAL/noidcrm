-- Corrigir RLS SELECT policy para opportunities
-- Usar verificação direta e robusta, sem depender de can_view_opportunity()

DROP POLICY IF EXISTS "Users can view opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can view org opportunities" ON opportunities;
DROP POLICY IF EXISTS "Users can select opportunities" ON opportunities;

CREATE POLICY "Users can view opportunities"
ON opportunities
FOR SELECT
TO authenticated
USING (
  -- Verificação básica: organização do usuário
  organization_id IS NOT NULL
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = opportunities.organization_id
      AND om.status = 'active'
  )
  AND (
    -- Caso 1: É owner da oportunidade (vendedor vê suas próprias)
    owner_user_id = auth.uid()
    -- Caso 2: É admin, owner ou manager da organização (vê todas)
    OR EXISTS (
      SELECT 1 FROM organization_members om2
      WHERE om2.user_id = auth.uid()
        AND om2.organization_id = opportunities.organization_id
        AND om2.org_role IN ('owner', 'admin', 'manager')
        AND om2.status = 'active'
    )
    -- Caso 3: É participante do deal
    OR EXISTS (
      SELECT 1 FROM deal_participants dp
      WHERE dp.opportunity_id = opportunities.id
        AND dp.user_id = auth.uid()
    )
  )
);