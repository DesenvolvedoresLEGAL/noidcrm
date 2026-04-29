# Scoring Indicators — Forensic Audit (Sprint 1.3)

**Last updated:** 2026-04-29 — Sprint Scoring 1.3
**Status:** Living document. Every indicator surfaced in the Pipeline cards or
on the Scoring screen MUST be listed here, with its official source, formula
and where it is rendered.

The cardinal rule of this audit: **never compute scoring numbers in the
frontend**. The card and dashboards always read from `opportunities` /
`accounts` columns persisted by edge functions, and surface the explainable
metadata in tooltips.

---

## Lead Score *(Sprint 1.1, untouched)*

- **Official source:** `accounts.lead_score`
- **Companion fields:** `accounts.lead_grade`, `accounts.fit_score`,
  `accounts.intent_score`, `accounts.score_updated_at`
- **Formula owner:** `supabase/functions/calculate-account-scores`
  (`Lead = FIT × 0.4 + INTENT × 0.6`)
- **Recalc trigger:** `lead_score_recalc_queue` (debounce 2 min) flushed by
  `process-lead-score-queue` cron.
- **History:** `score_history` with `score_type = 'lead'`.
- **Surfaces:** `LeadScoreCard`, account sidebar, pipeline card badge,
  Scoring → Lead Score tab.

## Lead Grade

- Source: `accounts.lead_grade` (A/B/C/D), derived from `lead_score`. Never
  recomputed locally.

## Opportunity Score *(Sprint 1.2, untouched)*

- **Official source:** `opportunities.opportunity_score`
- **Companion fields:** `opportunity_grade`, `opportunity_health`,
  `opportunity_score_metadata`, `score_updated_at`
- **Formula owner:** `supabase/functions/calculate-opportunity-score`
  (Stage 25 + Signals 25 + Velocity 20 + Engagement 20 + Risk Adj −20/+10).
- **Recalc trigger:** `opportunity_score_recalc_queue`.
- **History:** `score_history` with `score_type = 'opportunity'`.

## Opportunity Grade / Health

- Source: `opportunity_grade` and `opportunity_health` set by Sprint 1.2.

---

## Indicators owned by Sprint 1.3

All five derived indicators below are calculated by
`supabase/functions/calculate-opportunity-indicators`, persisted on
`opportunities`, and updated through `opportunity_indicators_recalc_queue`
(processor: `process-opportunity-indicators-queue`, cron 1 min, debounce 2 min
per opportunity).

### NRHS (Net Revenue Hygiene Score)

- **Official source:** `opportunities.nrhs_score` (0-100)
- **Companion:** `nrhs_tier` ∈ {`healthy` ≥75, `attention` ≥50, `critical` <50},
  `nrhs_blockers` (jsonb array), `nrhs_breakdown` (per-pillar scores),
  `nrhs_last_calculated_at`.
- **Formula:** `Data Completeness (≤25) + Contact Quality (≤20) + Deal
  Hygiene (≤25) + Activity Hygiene (≤20) + Timeline Hygiene (≤10) − 3×
  blocker count`.
- **Blockers:** `no_owner`, `no_primary_contact`, `no_decisor`,
  `no_next_activity`, `no_amount`, `overdue_activity`, `stale_stage`.
- **Surfaces:** Pipeline card NRHS badge, NRHS dashboard,
  `OpportunityScoreInsights`.

### Engagement Score

- **Source:** `opportunities.engagement_score` (0-100), `engagement_metadata`,
  `engagement_updated_at`.
- **Formula:** events from `activities`, `opportunity_emails` and proposal
  views; recency boosts + ghosting penalties (see edge function).

### Velocity Score

- **Source:** `opportunities.velocity_score` (0-100), `velocity_metadata`,
  `velocity_updated_at`.
- **Formula:** recent updates (+25/+15/+8), next activity scheduled (+20),
  staleness penalty (−15/−30/−50).

### Risk Score / Risk Level

- **Source:** `opportunities.risk_score` (0-100, higher = worse),
  `opportunities.risk_level` ∈ {`low` <40, `medium` <70, `high` ≥70}.
- **Formula:** sum of risk factors (no next activity +25, overdue activity
  +15/+25, no decisor +20, no primary contact +20, no owner +30, ghosting
  +15/+30/+50, no amount +25, expired proposal +25, staleness +30/+60).

### Deal Health

- **Source:** `opportunities.deal_health` ∈ {`hot`, `healthy`, `attention`,
  `risk`, `stalled`}, plus `deal_health_score` (0-100) and
  `deal_health_metadata.reason`.
- **Rules:** see edge function. Always derived from Opportunity Score, NRHS,
  blockers, days since update, engagement.

### Probabilidade Comercial *(NOT AI Win)*

- **Source:** `opportunities.probability` (manual / per-stage default).
- **Tooltip label:** *"Probabilidade Comercial — definida pelo estágio do
  funil ou ajustada manualmente."*
- **Never** compute this from AI signals; never alias `win_probability_ai` as
  `probability`.

### AI Win Probability

- **Source:** `opportunities.win_probability_ai` (0-100),
  `ai_win_probability_metadata`, `ai_win_probability_updated_at`.
- **Formula:** `Opp Score × 0.45 + Probability × 0.25 + Lead Score × 0.15 +
  NRHS × 0.10 + History × 0.05` (history = 50 neutral until a real model
  exists).
- **Mandatory caps (Sprint 1.3 fix for the 100% mass bug):**
  - won → 100; lost → 0
  - open opportunities → max 95 (never 100)
  - no next activity → max 59
  - no owner → max 49
  - parada > 14 dias → max 49
  - no decisor → max 69
  - engagement < 20 → max 69
  - no primary contact → max 69
  - no amount → max 59
- **UI label:** *"AI Win Probability — estimativa inteligente baseada em
  score e sinais comerciais"* (never call this "machine learning preditivo"
  until a real model is trained).

---

## Realtime + invalidation

- Single opp: `useOpportunityIndicatorsRealtime(oppId)`.
- Org-wide pipeline: `usePipelineIndicatorsRealtime(orgId)`.
- Cache invalidation entry point:
  `src/lib/scoring/invalidateOpportunityIndicatorsQueries.ts` — reuses Sprint
  1.2 invalidator and adds the indicators dashboard keys.

## Backfill

The Sprint 1.3 migration enqueued **every open opportunity** so the
processor cron clears the inflated `win_probability_ai = 100` rows within
~5–10 minutes after deploy.
