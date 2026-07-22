REVOKE ALL ON FUNCTION public.nsec12_probe_activity_insert_smoke(uuid,uuid,text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_activity_insert_smoke(uuid,uuid,text);
REVOKE ALL ON FUNCTION public.nsec12_probe_proposal_insert_smoke(uuid,uuid,text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_proposal_insert_smoke(uuid,uuid,text);