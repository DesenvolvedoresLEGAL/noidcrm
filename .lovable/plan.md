
# Sprint A — Proposal Analytics AI Insights Cache

## Problem
The Analytics tab inside an opportunity (`OpportunityAnalyticsTab` → `AIProposalInsightCard`) calls the `analyze-proposal-behavior` edge function on every mount via `autoLoad` + `useEffect`. The result is never persisted, so every tab open burns tokens even when nothing changed.

## Goal
Persist AI Insights in the database keyed by a deterministic signature of the proposal + analytics state. Only call the LLM when the signature changes (new view, forwarding, status/value/due date/payment/items change) or when the user explicitly forces a refresh.

## Discovered context (real schema, will be used as-is)
- Frontend entry: `src/components/opportunity/OpportunityAnalyticsTab.tsx` → `src/components/proposals/AIProposalInsightCard.tsx` (uses `autoLoad` and a manual `RefreshCw` button — both call the edge fn directly).
- Edge function: `supabase/functions/analyze-proposal-behavior/index.ts` (uses service role, queries `proposals`, `proposal_views` filtered by `viewer_type='external'`, `proposal_view_events`).
- Tables: `proposals (id, organization_id, opportunity_id, status, total_amount, updated_at)` — no `due_date`/`payment_method` columns (will use what exists, plus `valor_liquido` etc. via dynamic select). `proposal_views (proposal_id, viewed_at, viewer_ip, duration_seconds, sections_viewed, scroll_depth_percent, is_forwarded, viewer_type, viewer_user_id)`. `proposal_view_events`, `proposal_items`.
- AI usage log already exists: `ai_usage_logs (organization_id, user_id, feature, action, entity_type, entity_id, model_used, tokens_input, tokens_output, tokens_total, success, request_metadata, response_metadata, created_at)` — reuse, do not duplicate.
- RLS helpers: `get_user_organization_id()`, `user_is_org_member(uuid)`, `user_is_org_admin(uuid)`. No `user_belongs_to_organization` — the spec's example will be adapted to `user_is_org_member`.
- `update_updated_at_column()` already exists — reuse for trigger.

## Plan

### 1. Migration: cache table
Create `public.proposal_ai_insights_cache` with the schema from the brief, but:
- FKs: `organization_id → organizations(id)`, `opportunity_id → opportunities(id) ON DELETE CASCADE`, `proposal_id → proposals(id) ON DELETE CASCADE`.
- `UNIQUE (proposal_id)` (proposal already implies opportunity/org; keeps upsert simple).
- Indexes on `organization_id`, `opportunity_id`, `proposal_id`, `analytics_signature`.
- Trigger `update_updated_at_column` on `BEFORE UPDATE`.

### 2. RLS
Enable RLS and add three policies using existing helpers:
- SELECT: `user_is_org_member(organization_id)`.
- INSERT: `WITH CHECK (user_is_org_member(organization_id))`.
- UPDATE: `USING + WITH CHECK (user_is_org_member(organization_id))`.
Service role (edge fn) bypasses RLS, so upsert from the edge function works safely.

### 3. RPC `get_proposal_analytics_signature(p_proposal_id uuid)`
`SECURITY DEFINER`, fixed `search_path = public`. Returns md5 hash combining:
- `proposals`: id, opportunity_id, organization_id, status, total_amount, updated_at (and `valor_liquido`, `due_date` only if those columns exist — use dynamic SQL `to_jsonb(p)` slice to be schema-tolerant).
- Aggregates over `proposal_views` (external only): count, distinct viewer_ip, distinct viewer_user_id, sum/avg duration_seconds, max viewed_at, max scroll_depth_percent, bool_or(is_forwarded), array_agg(distinct sections_viewed) hashed.
- Aggregates over `proposal_view_events`: count, max(timestamp).
- Aggregates over `proposal_items`: count, max(updated_at).
Single `SELECT md5(string_agg(...))` query with LEFT JOINs grouped by proposal id.

### 4. RPC `get_proposal_ai_insights_cache(p_proposal_id uuid)`
Returns JSON `{ has_cache, is_valid, current_signature, cached_signature, generated_at, insights_payload, engagement_score, engagement_level, close_probability, risk_level, recommended_actions, smart_alerts, generated_summary, model_used }`. Reads cache row scoped by RLS, computes current signature via the function above, sets `is_valid = (cached_signature = current_signature)`.

### 5. RPC `upsert_proposal_ai_insights_cache(...)`
`INSERT ... ON CONFLICT (proposal_id) DO UPDATE` overwriting all fields per spec, refreshing `generated_at` and `updated_at`. Validates the caller is org member (or service role).

### 6. Edge function: cache-aware
Refactor `analyze-proposal-behavior/index.ts`:
1. Accept `{ proposal_id, force_refresh?: boolean }`.
2. Compute signature via `get_proposal_analytics_signature`.
3. SELECT existing cache row.
4. If `total_views === 0` and no cache → return `{ status: 'insufficient_data' }` without calling AI.
5. If cache valid and not `force_refresh` → return cached payload with `from_cache: true`.
6. Otherwise call existing `callAI(...)` flow; on success, upsert via `upsert_proposal_ai_insights_cache`, log to `ai_usage_logs` (`feature='proposal_analytics_ai_insights'`, `action=reason` ∈ `cache_miss|signature_changed|manual_refresh`, `entity_type='proposal'`, tokens, success).
7. On AI failure, return existing cache with `stale: true, error: '...'` so UI can show fallback; do not delete cache.
8. Never log `ai_usage_logs` for cache hits.

### 7. Frontend hook + service
Create `src/services/supabase/proposal-ai-insights.ts`:
- `getProposalAIInsights(proposalId)` → calls edge function with `force_refresh=false`.
- `refreshProposalAIInsights(proposalId, { force })` → calls with `force_refresh=true`.

Create `src/hooks/useProposalAIInsights.ts` using React Query:
- `queryKey: ['proposal-ai-insights', proposalId]`.
- `queryFn`: invokes edge function (cache-aware path).
- Returns `{ data, isLoading, isRefreshing, isFromCache, generatedAt, status, error, refresh }`.
- `staleTime: Infinity` (server is the source of truth — invalidation happens via signature).

### 8. Refactor `AIProposalInsightCard`
- Remove `useEffect` auto-call and local `useState` AI call.
- Consume `useProposalAIInsights({ proposalId, opportunityId })`.
- Render existing cards with payload; map server payload (`engagement_score/level`, `recommended_actions`, `smart_alerts`, `summary`, `close_probability`, `insights`) — keep current visual layout untouched.
- Add states:
  - `insufficient_data` → "Ainda não há visualizações suficientes…".
  - `from_cache` valid → small footer `Insights atualizados em DD/MM/YYYY HH:mm`.
  - `refreshing` → "Novas interações detectadas. Atualizando análise inteligente…".
  - `error_with_cache` → keep showing payload + warning banner.
  - `error_no_cache` → "Não foi possível gerar os insights agora. Tente novamente mais tarde."
- "Atualizar análise" button (existing `RefreshCw`):
  - If signature unchanged (response had `from_cache=true`), open AlertDialog "Nenhuma nova interação foi detectada. Deseja gerar uma nova análise mesmo assim?" — only on confirm call `refresh({ force: true })`.
  - Else call `refresh({ force: true })` directly.
  - Visible only when `user_is_org_admin_or_manager` (reuse existing `usePermissions`).

### 9. Tests / manual QA matrix
Run all 7 manual tests from the brief. Optionally add a vitest unit for the signature computation parity (skip if too costly).

## Files to change
- New: `supabase/migrations/<ts>_proposal_ai_insights_cache.sql`
- Edit: `supabase/functions/analyze-proposal-behavior/index.ts`
- New: `src/services/supabase/proposal-ai-insights.ts`
- New: `src/hooks/useProposalAIInsights.ts`
- Edit: `src/components/proposals/AIProposalInsightCard.tsx`

## Risks
- Signature must be deterministic — avoid floating averages drift; cast to `numeric(12,2)` before hashing.
- RLS: edge fn uses service role → bypasses RLS; ensure upsert function still scopes by `organization_id` from the proposal record (don't trust client).
- Backwards compat: existing callers of `analyze-proposal-behavior` (only `AIProposalInsightCard`) — no other usage in repo.
- `due_date`/`payment_method` not present on `proposals` — use `valor_liquido` if present; signature uses only existing columns to avoid migration errors.

## Out of scope
- Layout redesign, Sprint B value sync, deleting old cache rows (signature naturally invalidates).
