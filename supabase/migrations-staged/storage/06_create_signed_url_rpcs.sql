-- STAGED — RPCs que resolvem storage_path após validar acesso.
-- A geração da signed URL propriamente dita fica na edge function (que tem service_role).
-- Estas RPCs devolvem apenas o path autorizado + org, minimizando superfície.

CREATE OR REPLACE FUNCTION public.resolve_proposal_pdf_path(_proposal_id uuid)
RETURNS TABLE(storage_path text, organization_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.pdf_storage_path, p.organization_id
  FROM public.proposals p
  WHERE p.id = _proposal_id
    AND p.pdf_storage_path IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.organization_id = p.organization_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_proposal_pdf_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_proposal_pdf_path(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_proposal_layout_path(_layout_id uuid)
RETURNS TABLE(storage_path text, organization_id uuid)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT l.storage_path, l.organization_id
  FROM public.proposal_layouts l
  WHERE l.id = _layout_id
    AND l.storage_path IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.organization_id = l.organization_id
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_proposal_layout_path(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_proposal_layout_path(uuid) TO authenticated;
