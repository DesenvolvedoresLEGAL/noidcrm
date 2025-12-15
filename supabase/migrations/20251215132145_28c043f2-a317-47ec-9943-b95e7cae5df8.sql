-- Adicionar 'operations' ao enum org_role
ALTER TYPE org_role ADD VALUE IF NOT EXISTS 'operations';

-- Criar/atualizar profile do Bruno Sabino
INSERT INTO profiles (id, user_id, full_name, email)
VALUES (
  'e104c6c9-7c26-483c-82a6-6605c2546b92', 
  'e104c6c9-7c26-483c-82a6-6605c2546b92', 
  'Bruno Sabino', 
  'bruno@operadora.legal'
)
ON CONFLICT (id) DO UPDATE SET 
  full_name = EXCLUDED.full_name,
  email = EXCLUDED.email,
  user_id = EXCLUDED.user_id;