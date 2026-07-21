REVOKE ALL ON FUNCTION public.nsec12_probe_insert_contact(uuid, text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_contact(uuid, text);