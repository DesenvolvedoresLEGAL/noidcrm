-- Security PR-02: tighten overly broad grants on extensions schema
-- Keep cron schema grants unchanged.

REVOKE ALL ON SCHEMA extensions FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA extensions FROM PUBLIC;
REVOKE ALL ON ALL ROUTINES IN SCHEMA extensions FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA extensions FROM PUBLIC;

REVOKE ALL ON SCHEMA extensions FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA extensions FROM anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA extensions FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA extensions FROM anon, authenticated;
