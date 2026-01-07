-- =============================================
-- INCIDENT RESPONSE: Contenção e Hardening
-- =============================================

-- FASE 1: CONTENÇÃO IMEDIATA
-- 1.1 Remover dados maliciosos
DELETE FROM public.release_notes WHERE id = '5685eaa3-65cc-4fc5-817d-3ba599cb61c2';

-- 1.2 Remover roles do atacante
DELETE FROM public.user_roles WHERE user_id = '8284b021-f22f-4558-a0c2-5b82142c97e9';

-- 1.3 Remover profile do atacante
DELETE FROM public.profiles WHERE user_id = '8284b021-f22f-4558-a0c2-5b82142c97e9';

-- FASE 2: CORRIGIR VULNERABILIDADES CRÍTICAS

-- 2.1 Corrigir trigger handle_new_user() para NÃO dar admin automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Criar profile básico sem role admin
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  );
  
  -- NÃO inserir role automaticamente - deve ser atribuído por admin
  -- Usuários novos ficam sem role até serem aprovados
  
  RETURN NEW;
END;
$$;

-- 2.2 Restringir pending_release_changes - apenas platform admins podem inserir
DROP POLICY IF EXISTS "Authenticated can insert pending changes" ON public.pending_release_changes;
DROP POLICY IF EXISTS "Only platform admins can insert pending changes" ON public.pending_release_changes;

CREATE POLICY "Only platform admins can insert pending changes" 
ON public.pending_release_changes
FOR INSERT 
TO authenticated
WITH CHECK (public.is_platform_admin_for_rls(auth.uid()));

-- 2.3 Restringir release_notes - apenas platform admins podem inserir/atualizar
DROP POLICY IF EXISTS "Platform admins can manage release notes" ON public.release_notes;
DROP POLICY IF EXISTS "Anyone can view release notes" ON public.release_notes;

-- Manter SELECT público para changelog
CREATE POLICY "Anyone can view release notes" 
ON public.release_notes
FOR SELECT 
USING (true);

-- INSERT/UPDATE/DELETE apenas para platform admins
CREATE POLICY "Platform admins can insert release notes" 
ON public.release_notes
FOR INSERT 
TO authenticated
WITH CHECK (public.is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Platform admins can update release notes" 
ON public.release_notes
FOR UPDATE 
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()))
WITH CHECK (public.is_platform_admin_for_rls(auth.uid()));

CREATE POLICY "Platform admins can delete release notes" 
ON public.release_notes
FOR DELETE 
TO authenticated
USING (public.is_platform_admin_for_rls(auth.uid()));