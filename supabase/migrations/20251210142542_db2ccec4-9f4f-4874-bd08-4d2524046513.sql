-- Simplificar política de INSERT para proposals - permitir qualquer membro ativo
DROP POLICY IF EXISTS "Users can insert org proposals" ON public.proposals;

CREATE POLICY "Members can insert proposals"
ON public.proposals
FOR INSERT
TO authenticated
WITH CHECK (
  organization_id = get_user_organization_id()
);