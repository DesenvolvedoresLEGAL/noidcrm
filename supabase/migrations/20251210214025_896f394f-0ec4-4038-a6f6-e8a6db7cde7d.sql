-- CORREÇÃO CRÍTICA: Vazamento cross-organization na policy "Public token proposal access"
-- A policy permitia que usuários autenticados de qualquer organização vissem propostas de outras orgs

-- 1. Remover policy problemática
DROP POLICY IF EXISTS "Public token proposal access" ON proposals;

-- 2. Recriar com verificação de organização para usuários autenticados
CREATE POLICY "Public token proposal access" 
ON proposals FOR SELECT 
TO public
USING (
  public_token IS NOT NULL 
  AND status IN ('sent', 'viewed', 'accepted', 'rejected')
  AND (
    -- Acesso anônimo (cliente externo acessando via link público) - OK
    auth.uid() IS NULL
    -- OU usuário autenticado DEVE ser da mesma organização
    OR organization_id = get_user_organization_id()
  )
);