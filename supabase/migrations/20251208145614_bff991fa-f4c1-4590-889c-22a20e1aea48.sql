-- Migração 1: Adicionar 'cs' aos enums
-- Adicionar 'cs' ao enum org_role (usado em organization_members)
ALTER TYPE public.org_role ADD VALUE IF NOT EXISTS 'cs';

-- Adicionar 'cs' ao enum app_role (usado em user_roles)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cs';