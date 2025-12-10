-- Corrigir org_role de Wagner para owner na organização Humanoid
UPDATE organization_members 
SET org_role = 'owner' 
WHERE organization_id = '774d7d78-8257-4891-aac7-718039b80049'
  AND user_id = '1d212fd4-4c1a-466e-94b2-6eb01e5ca8b3';

-- Adicionar comentário documentando a regra de negócio
COMMENT ON COLUMN organization_members.org_role IS 'Role organizacional do usuário: owner (criador/dono), admin (administrador), manager (gestor), sales (vendedor), cs (customer success), finance (financeiro), viewer (visualizador)';