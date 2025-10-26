-- FASE 2: Garantir criação de onboarding_status

-- Inserir onboarding_status para usuários existentes sem registro
INSERT INTO public.onboarding_status (user_id, completed, current_step, data, created_at)
SELECT 
  au.id,
  false,
  1,
  '{}'::jsonb,
  NOW()
FROM auth.users au
WHERE NOT EXISTS (
  SELECT 1 FROM public.onboarding_status os WHERE os.user_id = au.id
);

-- Recriar trigger para garantir funcionamento
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();