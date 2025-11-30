-- Vincular usuário legaloperadora@gmail.com à organização LEGAL
INSERT INTO organization_members (
  user_id,
  organization_id,
  status,
  org_role,
  joined_at
) VALUES (
  'c4d3667f-ef52-49a7-ae21-b9d2f5a4a15b',
  'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d',
  'active',
  'admin',
  NOW()
)
ON CONFLICT (user_id, organization_id) DO UPDATE 
SET status = 'active', org_role = 'admin';

-- Atualizar o perfil com a organização
UPDATE profiles 
SET organization_id = 'd1b68a0f-4e2a-48ce-a03d-19c2751f5f2d'
WHERE user_id = 'c4d3667f-ef52-49a7-ae21-b9d2f5a4a15b';