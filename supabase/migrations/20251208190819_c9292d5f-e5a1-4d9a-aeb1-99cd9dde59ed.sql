-- Fase 1: Expandir seller_role_type enum com novos valores comerciais
-- Adicionando: BDR, AE, AM, Hunter

-- Adicionar novos valores ao enum seller_role_type
ALTER TYPE seller_role_type ADD VALUE IF NOT EXISTS 'BDR';
ALTER TYPE seller_role_type ADD VALUE IF NOT EXISTS 'AE';
ALTER TYPE seller_role_type ADD VALUE IF NOT EXISTS 'AM';
ALTER TYPE seller_role_type ADD VALUE IF NOT EXISTS 'Hunter';

-- Criar índice para otimizar queries por role
CREATE INDEX IF NOT EXISTS idx_sellers_role ON sellers(role);
CREATE INDEX IF NOT EXISTS idx_sellers_organization_role ON sellers(organization_id, role);