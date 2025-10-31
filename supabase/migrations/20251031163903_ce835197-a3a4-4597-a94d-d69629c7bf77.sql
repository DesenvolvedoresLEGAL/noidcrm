-- Correção de segurança: Adicionar search_path à função

DROP FUNCTION IF EXISTS generate_proposal_public_token();

CREATE OR REPLACE FUNCTION generate_proposal_public_token()
RETURNS TEXT 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    -- Gerar token aleatório de 32 caracteres
    new_token := encode(gen_random_bytes(24), 'base64');
    new_token := replace(replace(replace(new_token, '/', '_'), '+', '-'), '=', '');
    
    -- Verificar se já existe
    SELECT EXISTS(SELECT 1 FROM proposals WHERE public_token = new_token) INTO token_exists;
    
    EXIT WHEN NOT token_exists;
  END LOOP;
  
  RETURN new_token;
END;
$$;