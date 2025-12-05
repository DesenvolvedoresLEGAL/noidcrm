-- Remover política atual de INSERT para opportunities
DROP POLICY IF EXISTS "Users can insert opportunities" ON public.opportunities;

-- Criar nova política INSERT mais robusta que verifica membership ativa
CREATE POLICY "Users can insert org opportunities" ON public.opportunities
FOR INSERT TO authenticated
WITH CHECK (
  organization_id IS NOT NULL 
  AND EXISTS (
    SELECT 1 FROM organization_members 
    WHERE user_id = auth.uid() 
    AND organization_id = opportunities.organization_id
    AND status = 'active'
  )
);