-- Corrigir função validate_cpf para incluir search_path
CREATE OR REPLACE FUNCTION public.validate_cpf(cpf text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cpf_clean text;
  sum1 integer := 0;
  sum2 integer := 0;
  d1 integer;
  d2 integer;
  i integer;
BEGIN
  cpf_clean := regexp_replace(cpf, '[^0-9]', '', 'g');
  
  IF length(cpf_clean) != 11 THEN
    RETURN false;
  END IF;
  
  IF cpf_clean ~ '^(.)\1{10}$' THEN
    RETURN false;
  END IF;
  
  FOR i IN 1..9 LOOP
    sum1 := sum1 + (substring(cpf_clean, i, 1)::integer * (11 - i));
  END LOOP;
  d1 := (sum1 * 10) % 11;
  IF d1 = 10 THEN d1 := 0; END IF;
  
  FOR i IN 1..10 LOOP
    sum2 := sum2 + (substring(cpf_clean, i, 1)::integer * (12 - i));
  END LOOP;
  d2 := (sum2 * 10) % 11;
  IF d2 = 10 THEN d2 := 0; END IF;
  
  RETURN d1 = substring(cpf_clean, 10, 1)::integer 
     AND d2 = substring(cpf_clean, 11, 1)::integer;
END;
$$;