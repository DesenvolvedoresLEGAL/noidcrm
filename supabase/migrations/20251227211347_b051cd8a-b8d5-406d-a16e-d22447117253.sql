-- Criar novas colunas JSONB para emails e telefones estruturados
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS emails_new jsonb DEFAULT '[]'::jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS telefones_new jsonb DEFAULT '[]'::jsonb;

-- Migrar dados existentes de emails (emails é text[], email_principal é text)
UPDATE public.contacts SET 
  emails_new = COALESCE(
    CASE 
      WHEN emails IS NOT NULL AND array_length(emails, 1) > 0 THEN
        (SELECT jsonb_agg(jsonb_build_object(
          'value', e, 
          'type', 'work', 
          'is_primary', (e = email_principal OR (email_principal IS NULL AND ordinality = 1))
        ))
        FROM unnest(emails) WITH ORDINALITY AS t(e, ordinality))
      WHEN email_principal IS NOT NULL THEN
        jsonb_build_array(jsonb_build_object('value', email_principal, 'type', 'work', 'is_primary', true))
      ELSE '[]'::jsonb 
    END,
    '[]'::jsonb
  );

-- Migrar dados existentes de telefones (telefones é text[], telefone_principal é text)
UPDATE public.contacts SET 
  telefones_new = COALESCE(
    CASE 
      WHEN telefones IS NOT NULL AND array_length(telefones, 1) > 0 THEN
        (SELECT jsonb_agg(jsonb_build_object(
          'value', t, 
          'type', 'mobile', 
          'is_primary', (t = telefone_principal OR (telefone_principal IS NULL AND ordinality = 1))
        ))
        FROM unnest(telefones) WITH ORDINALITY AS t(t, ordinality))
      WHEN telefone_principal IS NOT NULL THEN
        jsonb_build_array(jsonb_build_object('value', telefone_principal, 'type', 'mobile', 'is_primary', true))
      ELSE '[]'::jsonb 
    END,
    '[]'::jsonb
  );

-- Remover colunas redundantes antigas
ALTER TABLE public.contacts DROP COLUMN IF EXISTS emails;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS email_principal;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS telefones;
ALTER TABLE public.contacts DROP COLUMN IF EXISTS telefone_principal;

-- Renomear novas colunas para os nomes finais
ALTER TABLE public.contacts RENAME COLUMN emails_new TO emails;
ALTER TABLE public.contacts RENAME COLUMN telefones_new TO telefones;