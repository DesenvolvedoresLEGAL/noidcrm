-- Enable pg_trgm extension for similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Function to find similar accounts using trigram similarity
CREATE OR REPLACE FUNCTION public.find_similar_accounts(
  p_name TEXT,
  p_org_id UUID,
  p_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  razao_social TEXT,
  nome_fantasia TEXT,
  cnpj TEXT,
  similarity FLOAT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_normalized_name TEXT;
BEGIN
  -- Normalize input name: lowercase, remove accents, remove common suffixes
  v_normalized_name := LOWER(p_name);
  v_normalized_name := translate(v_normalized_name, 
    'áàâãäéèêëíìîïóòôõöúùûüçñ', 
    'aaaaaeeeeiiiioooooouuuucn');
  v_normalized_name := regexp_replace(v_normalized_name, '\b(ltda|me|epp|eireli|s\.?a\.?|mei|ss|sociedade simples|limitada)\b', '', 'gi');
  v_normalized_name := regexp_replace(v_normalized_name, '[^a-z0-9\s]', '', 'g');
  v_normalized_name := regexp_replace(v_normalized_name, '\s+', ' ', 'g');
  v_normalized_name := trim(v_normalized_name);
  
  RETURN QUERY
  SELECT 
    a.id,
    a.razao_social,
    a.nome_fantasia,
    a.cnpj,
    GREATEST(
      similarity(
        regexp_replace(
          regexp_replace(
            translate(LOWER(a.razao_social), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
            '\b(ltda|me|epp|eireli|s\.?a\.?|mei|ss|sociedade simples|limitada)\b', '', 'gi'
          ),
          '[^a-z0-9\s]', '', 'g'
        ),
        v_normalized_name
      ),
      COALESCE(
        similarity(
          regexp_replace(
            regexp_replace(
              translate(LOWER(COALESCE(a.nome_fantasia, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
              '\b(ltda|me|epp|eireli|s\.?a\.?|mei|ss|sociedade simples|limitada)\b', '', 'gi'
            ),
            '[^a-z0-9\s]', '', 'g'
          ),
          v_normalized_name
        ),
        0
      )
    )::FLOAT as similarity
  FROM accounts a
  WHERE a.organization_id = p_org_id
    AND (
      similarity(
        regexp_replace(
          regexp_replace(
            translate(LOWER(a.razao_social), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
            '\b(ltda|me|epp|eireli|s\.?a\.?|mei|ss|sociedade simples|limitada)\b', '', 'gi'
          ),
          '[^a-z0-9\s]', '', 'g'
        ),
        v_normalized_name
      ) > p_threshold
      OR similarity(
        regexp_replace(
          regexp_replace(
            translate(LOWER(COALESCE(a.nome_fantasia, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiioooooouuuucn'),
            '\b(ltda|me|epp|eireli|s\.?a\.?|mei|ss|sociedade simples|limitada)\b', '', 'gi'
          ),
          '[^a-z0-9\s]', '', 'g'
        ),
        v_normalized_name
      ) > p_threshold
    )
  ORDER BY similarity DESC
  LIMIT 5;
END;
$$;

-- Normalize existing porte values in accounts table
UPDATE accounts
SET porte = CASE 
  WHEN opcao_mei = true THEN 'MEI'
  WHEN LOWER(porte) = 'microempresa' THEN 'ME'
  WHEN LOWER(porte) LIKE '%pequeno porte%' OR porte = 'EPP' THEN 'EPP'
  WHEN LOWER(porte) = 'demais' AND capital_social >= 50000000 THEN 'Grande Porte'
  WHEN LOWER(porte) = 'demais' THEN 'Médio Porte'
  WHEN LOWER(porte) = 'grande' OR porte = 'GRANDE' THEN 'Grande Porte'
  ELSE porte
END
WHERE porte IS NOT NULL;