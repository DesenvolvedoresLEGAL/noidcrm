-- Adicionar coluna created_by na tabela accounts
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Adicionar coluna created_by na tabela opportunities
ALTER TABLE public.opportunities ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Criar função para preencher created_by automaticamente
CREATE OR REPLACE FUNCTION public.set_created_by()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger para accounts
DROP TRIGGER IF EXISTS accounts_set_created_by ON public.accounts;
CREATE TRIGGER accounts_set_created_by
  BEFORE INSERT ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Trigger para opportunities
DROP TRIGGER IF EXISTS opportunities_set_created_by ON public.opportunities;
CREATE TRIGGER opportunities_set_created_by
  BEFORE INSERT ON public.opportunities
  FOR EACH ROW EXECUTE FUNCTION public.set_created_by();

-- Comentários para documentação
COMMENT ON COLUMN public.accounts.created_by IS 'ID do usuário que criou o registro (diferente de owner_user_id que é o responsável atual)';
COMMENT ON COLUMN public.opportunities.created_by IS 'ID do usuário que criou a oportunidade (diferente de owner_user_id que é o responsável atual)';