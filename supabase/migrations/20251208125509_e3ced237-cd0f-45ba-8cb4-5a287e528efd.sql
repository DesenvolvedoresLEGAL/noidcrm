-- Corrigir RLS INSERT policy para opportunities
-- Garantir que vendedores possam criar oportunidades

-- Remover policy existente
DROP POLICY IF EXISTS "Users can insert org opportunities" ON opportunities;

-- Criar nova policy mais robusta
CREATE POLICY "Users can insert org opportunities"
ON opportunities
FOR INSERT
TO authenticated
WITH CHECK (
  -- Verificar que organization_id foi fornecido
  organization_id IS NOT NULL
  -- Verificar que há um usuário autenticado
  AND auth.uid() IS NOT NULL
  -- Verificar que o usuário é membro ativo da organização
  AND EXISTS (
    SELECT 1 FROM organization_members
    WHERE organization_members.user_id = auth.uid()
      AND organization_members.organization_id = opportunities.organization_id
      AND organization_members.status = 'active'
  )
);