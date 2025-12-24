-- Remove dangerous policy that allows platform admins to see ALL contracts (LGPD violation)
DROP POLICY IF EXISTS "Platform admins can view all contracts" ON public.contracts;

-- Also remove similar policies for INSERT/UPDATE/DELETE if they exist
DROP POLICY IF EXISTS "Platform admins can manage all contracts" ON public.contracts;