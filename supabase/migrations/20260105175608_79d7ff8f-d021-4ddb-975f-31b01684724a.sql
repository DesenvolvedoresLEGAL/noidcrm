-- =====================================================
-- CORREÇÃO DEFINITIVA: Exclusão de contratos
-- =====================================================

-- 1) RPC SECURITY DEFINER para excluir contrato
-- Valida membership e executa DELETE (trigger faz soft delete)
CREATE OR REPLACE FUNCTION public.delete_contract(contract_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id uuid;
  v_user_id uuid := auth.uid();
BEGIN
  -- Validar autenticação
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Buscar organization_id do contrato
  SELECT organization_id INTO v_org_id
  FROM public.contracts
  WHERE id = contract_id AND deleted_at IS NULL;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Contrato não encontrado ou já excluído';
  END IF;

  -- Validar membership com role adequada
  IF NOT EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = v_user_id
      AND om.organization_id = v_org_id
      AND om.status = 'active'
      AND om.org_role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'finance'::public.org_role, 'operations'::public.org_role, 'cs'::public.org_role])
  ) THEN
    RAISE EXCEPTION 'Você não tem permissão para excluir este contrato';
  END IF;

  -- Executar DELETE (trigger soft_delete_contract_trigger fará o soft delete)
  DELETE FROM public.contracts WHERE id = contract_id;

  RETURN true;
END;
$$;

-- 2) Atualizar policy SELECT para filtrar deleted_at IS NULL e usar EXISTS
DROP POLICY IF EXISTS "Org members can view contracts" ON public.contracts;

CREATE POLICY "Org members can view contracts"
ON public.contracts
FOR SELECT
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = contracts.organization_id
      AND om.status = 'active'
  )
);

-- 3) Atualizar policy UPDATE para usar EXISTS e não operar em soft-deletados
DROP POLICY IF EXISTS "Org members can update contracts" ON public.contracts;

CREATE POLICY "Org members can update contracts"
ON public.contracts
FOR UPDATE
TO authenticated
USING (
  deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = auth.uid()
      AND om.organization_id = contracts.organization_id
      AND om.status = 'active'
      AND om.org_role = ANY (ARRAY['owner'::public.org_role, 'admin'::public.org_role, 'finance'::public.org_role, 'operations'::public.org_role, 'cs'::public.org_role])
  )
)
WITH CHECK (
  deleted_at IS NULL
);