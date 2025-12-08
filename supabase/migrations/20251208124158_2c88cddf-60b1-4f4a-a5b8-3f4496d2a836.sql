-- Limpeza de registros órfãos em user_roles
-- Remove user_ids que não existem em auth.users

DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);