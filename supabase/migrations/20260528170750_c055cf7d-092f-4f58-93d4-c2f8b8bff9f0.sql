CREATE OR REPLACE FUNCTION public.get_forecast_sales_pipeline_v2(
  p_organization_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_org uuid;
  v_pipeline RECORD;
  v_reason text;
BEGIN
  -- Tenant guard: caller must belong to the org (platform admins bypass)
  SELECT public.get_user_organization_id() INTO v_caller_org;
  IF v_caller_org IS NULL OR v_caller_org <> p_organization_id THEN
    -- allow platform admins
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    ) THEN
      RETURN jsonb_build_object(
        'pipeline_id', NULL,
        'pipeline_name', NULL,
        'pipeline_found', false,
        'resolution_reason', 'forbidden',
        'requires_configuration', false
      );
    END IF;
  END IF;

  -- 1) sales + is_primary
  SELECT id, name INTO v_pipeline
  FROM public.pipelines
  WHERE organization_id = p_organization_id
    AND pipeline_type = 'sales'
    AND COALESCE(is_primary, false) = true
  ORDER BY created_at ASC
  LIMIT 1;
  IF FOUND THEN
    v_reason := 'sales_pipeline_primary';
  ELSE
    -- 2) any sales pipeline
    SELECT id, name INTO v_pipeline
    FROM public.pipelines
    WHERE organization_id = p_organization_id
      AND pipeline_type = 'sales'
    ORDER BY COALESCE(is_primary, false) DESC, created_at ASC
    LIMIT 1;
    IF FOUND THEN
      v_reason := 'sales_pipeline_type';
    ELSE
      -- 3) name match heuristic (VENDAS / Sales)
      SELECT id, name INTO v_pipeline
      FROM public.pipelines
      WHERE organization_id = p_organization_id
        AND (
          LOWER(name) IN ('vendas','sales','pipeline de vendas','sales pipeline','commercial')
          OR LOWER(name) LIKE 'vendas%'
          OR LOWER(name) LIKE '%sales%'
        )
      ORDER BY COALESCE(is_primary, false) DESC, created_at ASC
      LIMIT 1;
      IF FOUND THEN
        v_reason := 'sales_pipeline_name_match';
      END IF;
    END IF;
  END IF;

  IF v_pipeline.id IS NULL THEN
    RETURN jsonb_build_object(
      'pipeline_id', NULL,
      'pipeline_name', NULL,
      'pipeline_found', false,
      'resolution_reason', 'no_sales_pipeline_found',
      'requires_configuration', true
    );
  END IF;

  RETURN jsonb_build_object(
    'pipeline_id', v_pipeline.id,
    'pipeline_name', v_pipeline.name,
    'pipeline_found', true,
    'resolution_reason', v_reason,
    'requires_configuration', false
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_forecast_sales_pipeline_v2(uuid) TO authenticated, service_role;