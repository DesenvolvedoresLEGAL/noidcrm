-- Remover policy permissiva que permite todos os membros da org ver todas as atividades
-- Isso corrige o problema onde vendedores veem atividades de outros vendedores
DROP POLICY IF EXISTS "Org members view activities" ON public.activities;

-- A policy "activities_select_by_visibility" já existe e implementa a lógica correta:
-- - Admins/Owners veem todas
-- - Managers veem suas próprias + do time
-- - Vendedores veem apenas suas próprias atividades