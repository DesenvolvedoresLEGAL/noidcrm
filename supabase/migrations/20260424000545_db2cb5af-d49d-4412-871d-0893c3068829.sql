-- =========================================
-- 1. Tabela account_tags (espelha opportunity_tags)
-- =========================================
CREATE TABLE IF NOT EXISTS public.account_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_account_tags_account_id ON public.account_tags(account_id);
CREATE INDEX IF NOT EXISTS idx_account_tags_tag_id ON public.account_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_account_tags_org ON public.account_tags(organization_id);

ALTER TABLE public.account_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view org account_tags"
  ON public.account_tags FOR SELECT
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can create org account_tags"
  ON public.account_tags FOR INSERT
  WITH CHECK (organization_id = public.get_user_organization_id());

CREATE POLICY "Users can delete org account_tags"
  ON public.account_tags FOR DELETE
  USING (organization_id = public.get_user_organization_id());

-- =========================================
-- 2. Backfill: mover Expositor/Organizador para tags
-- =========================================
DO $$
DECLARE
  org RECORD;
  v_tag_expositor uuid;
  v_tag_organizador uuid;
BEGIN
  FOR org IN
    SELECT DISTINCT organization_id
    FROM public.accounts
    WHERE segmento IN ('Expositor','Organizador')
      AND organization_id IS NOT NULL
  LOOP
    -- Tag Expositor (laranja)
    INSERT INTO public.tags (organization_id, name, color, is_active)
    VALUES (org.organization_id, 'Expositor', '#F97316', true)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_tag_expositor
    FROM public.tags
    WHERE organization_id = org.organization_id AND name = 'Expositor'
    LIMIT 1;

    -- Tag Organizador (roxo)
    INSERT INTO public.tags (organization_id, name, color, is_active)
    VALUES (org.organization_id, 'Organizador', '#8B5CF6', true)
    ON CONFLICT DO NOTHING;

    SELECT id INTO v_tag_organizador
    FROM public.tags
    WHERE organization_id = org.organization_id AND name = 'Organizador'
    LIMIT 1;

    -- Vincular contas Expositor → tag
    IF v_tag_expositor IS NOT NULL THEN
      INSERT INTO public.account_tags (account_id, tag_id, organization_id)
      SELECT a.id, v_tag_expositor, a.organization_id
      FROM public.accounts a
      WHERE a.organization_id = org.organization_id
        AND a.segmento = 'Expositor'
      ON CONFLICT (account_id, tag_id) DO NOTHING;
    END IF;

    -- Vincular contas Organizador → tag
    IF v_tag_organizador IS NOT NULL THEN
      INSERT INTO public.account_tags (account_id, tag_id, organization_id)
      SELECT a.id, v_tag_organizador, a.organization_id
      FROM public.accounts a
      WHERE a.organization_id = org.organization_id
        AND a.segmento = 'Organizador'
      ON CONFLICT (account_id, tag_id) DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- =========================================
-- 3. Reclassificar segmento das contas marcadas
-- =========================================
-- 3a. Quem tem CNAE → usa fn_cnae_to_segmento
UPDATE public.accounts
SET segmento = public.fn_cnae_to_segmento(cnae),
    updated_at = now()
WHERE segmento IN ('Expositor','Organizador')
  AND cnae IS NOT NULL
  AND public.fn_cnae_to_segmento(cnae) IS NOT NULL;

-- 3b. Quem não resolveu por CNAE mas tem nome → heurística
UPDATE public.accounts
SET segmento = public.fn_infer_segmento_from_name(razao_social),
    updated_at = now()
WHERE segmento IN ('Expositor','Organizador')
  AND public.fn_infer_segmento_from_name(razao_social) IS NOT NULL;

-- 3c. Resto → NULL (melhor que mentir)
UPDATE public.accounts
SET segmento = NULL,
    updated_at = now()
WHERE segmento IN ('Expositor','Organizador');

-- =========================================
-- 4. Normalizar segmentos órfãos
-- =========================================
UPDATE public.accounts
SET segmento = 'Marketing', updated_at = now()
WHERE segmento = 'Marketing e Publicidade';

UPDATE public.accounts
SET segmento = 'Tecnologia', updated_at = now()
WHERE segmento = 'SaaS / Software';