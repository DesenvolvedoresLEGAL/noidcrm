-- NSEC-1.2-CHG-004 cleanup: remove temporary probe RPC after successful accounts INSERT homologation.
-- Baseline pre/post identical, 26/26 probes green.
REVOKE ALL ON FUNCTION public.nsec12_probe_insert_account(uuid, text) FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_account(uuid, text);