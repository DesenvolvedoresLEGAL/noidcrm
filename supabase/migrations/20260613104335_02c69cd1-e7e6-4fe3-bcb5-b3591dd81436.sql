
ALTER TABLE public.loss_reasons
  ADD COLUMN IF NOT EXISTS reason_type text NOT NULL DEFAULT 'lost',
  ADD COLUMN IF NOT EXISTS send_to_remarketing_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'loss_reasons_reason_type_chk'
  ) THEN
    ALTER TABLE public.loss_reasons
      ADD CONSTRAINT loss_reasons_reason_type_chk
      CHECK (reason_type IN ('lost','disqualification'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_loss_reasons_reason_type ON public.loss_reasons(reason_type);

CREATE OR REPLACE FUNCTION public.seed_pre_sales_disqualification_reasons(
  p_org_id uuid,
  p_pipeline_id uuid
) RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seed jsonb := '[
    {"name":"Sem evento definido","category":"no_fit","accountability":"client","remarketing":true},
    {"name":"Sem data do evento","category":"no_fit","accountability":"client","remarketing":true},
    {"name":"Sem local definido","category":"no_fit","accountability":"client","remarketing":true},
    {"name":"Sem escopo mínimo","category":"sales_process","accountability":"commercial","remarketing":true},
    {"name":"Sem quantidade de conexões","category":"sales_process","accountability":"commercial","remarketing":true},
    {"name":"Sem finalidade clara de uso","category":"sales_process","accountability":"commercial","remarketing":true},
    {"name":"Sem urgência real","category":"timing","accountability":"client","remarketing":true},
    {"name":"Sem decisor ou influência","category":"sales_process","accountability":"commercial","remarketing":false},
    {"name":"Sem próximo passo","category":"sales_process","accountability":"commercial","remarketing":false},
    {"name":"Cliente apenas pesquisando","category":"timing","accountability":"client","remarketing":true},
    {"name":"Pedido genérico de preço","category":"sales_process","accountability":"commercial","remarketing":false},
    {"name":"Baixa maturidade","category":"no_fit","accountability":"commercial","remarketing":true},
    {"name":"Não respondeu após contato","category":"sales_process","accountability":"client","remarketing":true},
    {"name":"Não visualizou proposta","category":"sales_process","accountability":"client","remarketing":true},
    {"name":"Não precisa mais da solução","category":"no_fit","accountability":"client","remarketing":false},
    {"name":"Fora do ICP","category":"no_fit","accountability":"commercial","remarketing":false},
    {"name":"Concorrente escolhido","category":"competition","accountability":"market","remarketing":false},
    {"name":"Preço inviável","category":"price","accountability":"market","remarketing":false},
    {"name":"Outro","category":"other","accountability":"unknown","remarketing":false}
  ]'::jsonb;
  v_item jsonb;
  v_inserted integer := 0;
  v_idx integer := 0;
BEGIN
  IF p_org_id IS NULL OR p_pipeline_id IS NULL THEN
    RAISE EXCEPTION 'org_id and pipeline_id are required';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(v_seed) LOOP
    v_idx := v_idx + 1;
    -- Skip if a reason with same normalized name already exists in this org
    IF EXISTS (
      SELECT 1 FROM public.loss_reasons
      WHERE organization_id = p_org_id
        AND lower(unaccent(name)) = lower(unaccent(v_item->>'name'))
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.loss_reasons (
      organization_id, name, is_active, pipeline_ids,
      audience, category, loss_accountability,
      reason_type, send_to_remarketing_default, order_index
    ) VALUES (
      p_org_id,
      v_item->>'name',
      true,
      ARRAY[p_pipeline_id],
      'seller',
      v_item->>'category',
      v_item->>'accountability',
      'disqualification',
      (v_item->>'remarketing')::boolean,
      v_idx
    );
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN v_inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.seed_pre_sales_disqualification_reasons(uuid, uuid) TO authenticated;
