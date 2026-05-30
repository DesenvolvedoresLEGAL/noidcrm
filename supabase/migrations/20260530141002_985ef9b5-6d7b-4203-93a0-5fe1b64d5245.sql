-- Allow 'standard_commission' as a third goal system mode for organizations.
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_goal_system_mode_check;
ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_goal_system_mode_check
  CHECK (goal_system_mode IN ('ote', 'simple', 'standard_commission'));

COMMENT ON COLUMN public.organizations.goal_system_mode IS
  'ote = Sistema OTE completo com multiplicadores e variável final; simple = Metas simples sem comissões; standard_commission = Comissão padrão direta por venda/produto/vendedor, sem multiplicadores OTE.';
