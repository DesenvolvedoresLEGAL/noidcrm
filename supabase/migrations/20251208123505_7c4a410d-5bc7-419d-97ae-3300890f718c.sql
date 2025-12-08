-- MIGRAÇÃO URGENTE: Vincular usuários reais à organização LEGAL
-- Usando auth.users.id (não profiles.id)

-- 1. Remover membros órfãos
DELETE FROM organization_members
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- 2. Inserir os usuários REAIS na organização LEGAL usando auth.users.id
INSERT INTO organization_members (user_id, organization_id, org_role, role, status, joined_at)
VALUES
  -- Wagner como owner (auth_user_id)
  ('fd4bbf6a-cf4e-490e-94ca-d47166277590', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'owner', 'owner', 'active', now()),
  -- Robério como manager
  ('1e837442-e0bf-4df5-8cf0-3750de4fecdc', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'manager', 'member', 'active', now()),
  -- Jessica como sales
  ('91055957-8270-45aa-a452-2045daa893ee', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'sales', 'member', 'active', now()),
  -- Leonardo como sales
  ('deb0b602-a5c8-4dcc-a814-225d6aa04227', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'sales', 'member', 'active', now()),
  -- Jaqueline como sales
  ('287d4a52-b182-4d7d-9429-bb0b1f8f9b61', 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d', 'sales', 'member', 'active', now())
ON CONFLICT (user_id, organization_id) DO UPDATE SET
  org_role = EXCLUDED.org_role,
  status = 'active';