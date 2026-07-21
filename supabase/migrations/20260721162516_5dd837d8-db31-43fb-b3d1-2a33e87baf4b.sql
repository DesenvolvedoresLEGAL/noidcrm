-- NSEC-1.2-CHG-016 Cleanup: remoção da RPC temporária de canary de INSERT em opportunities.
-- Somente após homologação completa dos 32 probes da matriz (10 same-org allowed, 2 viewers blocked,
-- 12 cross-org blocked, 6 opcionais permitidos, 2 organization_id nulos bloqueados).
REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity(text, text, text, text)
  FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity(text, text, text, text);