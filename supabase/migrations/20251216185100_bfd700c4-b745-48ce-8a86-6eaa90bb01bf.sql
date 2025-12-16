-- Atualizar função can_view_all para incluir operations e cs
CREATE OR REPLACE FUNCTION public.can_view_all(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM organization_members
    WHERE user_id = _user_id
      AND status = 'active'
      AND org_role IN ('owner', 'admin', 'finance', 'operations', 'cs')
  );
$function$;