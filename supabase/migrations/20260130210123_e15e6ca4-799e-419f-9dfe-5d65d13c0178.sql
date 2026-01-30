-- Migration: Fix audit_log RLS for platform admins
-- Problema: Platform admins não conseguem ver audit_log de outras organizações
-- Solução: Adicionar política PERMISSIVE de SELECT para platform admins

-- Verificar se a função existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'is_platform_admin_for_rls') THEN
    RAISE EXCEPTION 'Function is_platform_admin_for_rls does not exist!';
  END IF;
END $$;

-- Adicionar política de bypass para platform admins
DROP POLICY IF EXISTS "Platform admins can view all audit logs" ON audit_log;

CREATE POLICY "Platform admins can view all audit logs"
ON public.audit_log 
FOR SELECT
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()));

-- Adicionar comentário explicativo
COMMENT ON POLICY "Platform admins can view all audit logs" ON public.audit_log IS 
'Permite que platform admins vejam audit_log de todas as organizações para fins de auditoria e compliance.';