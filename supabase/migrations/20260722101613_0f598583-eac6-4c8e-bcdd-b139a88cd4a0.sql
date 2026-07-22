
REVOKE ALL ON FUNCTION public.nsec12_probe_account_write(uuid,text,text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_account_write(uuid,text,text);

REVOKE ALL ON FUNCTION public.nsec12_probe_contact_write(uuid,text,text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_contact_write(uuid,text,text);

REVOKE ALL ON FUNCTION public.nsec12_probe_opportunity_write(uuid,text,text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_opportunity_write(uuid,text,text);
