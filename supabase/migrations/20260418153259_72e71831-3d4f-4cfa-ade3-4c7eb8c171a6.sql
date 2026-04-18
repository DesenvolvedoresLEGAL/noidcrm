-- =========================================================================
-- SPRINT B/C: Performance optimization
-- 1) Consolidate redundant RLS policies
-- 2) Add covering indexes on hot path
-- 3) Aggressive autovacuum on hot tables
-- 4) Drop unused indexes
-- 5) Schedule snapshot retention
-- =========================================================================

-- -------------------------------------------------------------------------
-- 1) CONTACTS — remove duplicate INSERT (3 → 1) and DELETE (2 → 1)
--    SELECT/UPDATE policies preserved (public access via proposal token kept)
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can insert contacts" ON public.contacts;
DROP POLICY IF EXISTS "Users can insert org contacts" ON public.contacts;
-- Mantém apenas: "Users insert contacts in own org"

DROP POLICY IF EXISTS "Admins can delete org contacts" ON public.contacts;
-- Mantém apenas: "Admins delete contacts" (mais simples, usa can_view_all)

-- -------------------------------------------------------------------------
-- 2) PROPOSALS — INSERT 3→1, UPDATE 3→1, DELETE 3→1
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Members can insert proposals" ON public.proposals;
DROP POLICY IF EXISTS "Org members insert proposals" ON public.proposals;
-- Mantém: "Org members can insert proposals"

DROP POLICY IF EXISTS "Users can update proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can update org proposals" ON public.proposals;
-- Mantém: "Org members update proposals"

DROP POLICY IF EXISTS "Users can delete proposals" ON public.proposals;
DROP POLICY IF EXISTS "Users can delete org proposals" ON public.proposals;
-- Mantém: "Admins delete proposals"

-- -------------------------------------------------------------------------
-- 3) ACTIVITIES — INSERT 3→1, UPDATE 2→1, DELETE 2→1
-- -------------------------------------------------------------------------
DROP POLICY IF EXISTS "Org members can insert activities" ON public.activities;
DROP POLICY IF EXISTS "Users can insert in own org activities" ON public.activities;
-- Mantém: "Org members insert activities"

DROP POLICY IF EXISTS "Users can update org activities" ON public.activities;
-- Mantém: "Org members update activities"

DROP POLICY IF EXISTS "Admins can delete org activities" ON public.activities;
-- Mantém: "Admins delete activities"

-- -------------------------------------------------------------------------
-- 4) Covering index para o hot path de organization_members
--    Aceita lookups por (user_id, organization_id) com status active
--    e cobre as colunas role/status para evitar acesso à tabela.
-- -------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_members_user_active
  ON public.organization_members (user_id, organization_id)
  INCLUDE (role, status)
  WHERE status = 'active';

-- -------------------------------------------------------------------------
-- 5) Auto-vacuum agressivo nas tabelas hot do RLS
-- -------------------------------------------------------------------------
ALTER TABLE public.organization_members
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE public.profiles
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.02);

ALTER TABLE public.user_roles
  SET (autovacuum_vacuum_scale_factor = 0.05,
       autovacuum_analyze_scale_factor = 0.02);

-- -------------------------------------------------------------------------
-- 6) Drop de índices nunca usados (idx_scan=0, com mais de 100KB)
--    Reduzem custo de INSERT/UPDATE em tabelas hot.
-- -------------------------------------------------------------------------
DROP INDEX IF EXISTS public.idx_snapshots_expires;
DROP INDEX IF EXISTS public.idx_revenue_events_org_created;
DROP INDEX IF EXISTS public.idx_revenue_events_channel;
DROP INDEX IF EXISTS public.idx_system_events_trace_id;
DROP INDEX IF EXISTS public.idx_revenue_events_trace;
DROP INDEX IF EXISTS public.idx_system_events_entity;
DROP INDEX IF EXISTS public.idx_workflow_executions_hash;
DROP INDEX IF EXISTS public.idx_workflow_executions_trace;
DROP INDEX IF EXISTS public.idx_system_events_category;