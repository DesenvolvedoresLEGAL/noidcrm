INSERT INTO public.organization_members (user_id, organization_id, status, role, joined_at)
SELECT p.id, p.organization_id, 'active', 'member', now()
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om
    WHERE om.user_id = p.id
      AND om.organization_id = p.organization_id
  )
ON CONFLICT DO NOTHING;

UPDATE public.organization_members om
SET status = 'active'
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE om.user_id = p.id
  AND om.organization_id = p.organization_id
  AND om.status IS DISTINCT FROM 'active'
  AND p.organization_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_members om2
    WHERE om2.user_id = p.id AND om2.status = 'active'
  );