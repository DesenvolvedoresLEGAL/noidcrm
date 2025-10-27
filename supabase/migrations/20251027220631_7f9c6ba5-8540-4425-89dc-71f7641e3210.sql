-- Fase 1: Adicionar campo monthly_goal na tabela profiles
-- Este campo armazena a meta mensal de vendas do usuário em BRL
-- Apenas admins da organização podem editar este valor para vendedores

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS monthly_goal NUMERIC(12, 2) DEFAULT 0;

COMMENT ON COLUMN public.profiles.monthly_goal IS 'Meta mensal de vendas do usuário em BRL. Configurado por admins da organização para usuários com role sales.';