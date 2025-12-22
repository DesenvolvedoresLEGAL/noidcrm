
-- Criar função para verificar se usuário é super_admin na plataforma
CREATE OR REPLACE FUNCTION public.is_platform_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins
    WHERE user_id = _user_id
      AND role = 'super_admin'
      AND is_active = true
  )
$$;

-- Adicionar política que permite Super Admins verem todos os backups
DROP POLICY IF EXISTS "Super admins can view all backups" ON backup_history;

CREATE POLICY "Super admins can view all backups"
ON backup_history
FOR SELECT
USING (
  public.is_platform_super_admin(auth.uid())
);
