-- Fix: backfill organization_id on profiles for any active org member missing it.
-- Sintoma: Fernando Lima aparecia como "Sem nome / N/A" na lista de usuários
-- porque a RLS "Users can view org profiles" exige organization_id no profile.

UPDATE public.profiles p
SET organization_id = om.organization_id
FROM public.organization_members om
WHERE om.user_id = p.user_id
  AND om.status = 'active'
  AND p.organization_id IS NULL
  AND om.organization_id IS NOT NULL;