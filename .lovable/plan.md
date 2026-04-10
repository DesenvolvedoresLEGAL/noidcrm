

# Sprint 1.4 — Email Agent Cadence Engine + Cooldowns + Pipeline Rules + Metrics

## Resumo

Evoluir o Email Agent com cadências estruturadas por estágio, cooldowns avançados anti-saturação, regras por pipeline/stage, progresso rastreável por oportunidade, e dashboard de métricas operacionais e comerciais.

## Arquitetura

```text
┌─────────────────────────────────────────────────┐
│  run-email-agent-cadence-scheduler (Edge Fn)    │
│   ├─ resolve_policy (pipeline → stage → agent)  │
│   ├─ evaluate_cooldowns (contact, opp, account) │
│   ├─ compute_next_step (cadence progress)       │
│   └─ create execution_run if eligible           │
│              │                                  │
│              ▼                                  │
│  execute-email-agent-run (existing, enhanced)   │
│   ├─ cadence step context injected              │
│   ├─ email_purpose + angle from step            │
│   └─ advance cadence progress after send        │
│              │                                  │
│              ▼                                  │
│  record outcomes → aggregate daily metrics      │
└─────────────────────────────────────────────────┘
```

---

## 1. Database Migration

**7 new tables** with RLS by `organization_id`:

- **`ai_email_cadence_policies`** — cadence definitions (stage_based, trigger_based, reactivation, hybrid) with stop conditions
- **`ai_email_cadence_steps`** — ordered steps with purpose, delay, tone/CTA/angle guidance, approval overrides
- **`ai_email_cooldown_policies`** — per-contact/opp/account limits, business hours, weekday restrictions
- **`ai_email_pipeline_rules`** — per-pipeline/stage rules linking to cadence & cooldown policies, autonomy overrides
- **`ai_email_cadence_progress`** — tracks each opportunity's position in a cadence (active/paused/completed/stopped/exhausted)
- **`ai_email_agent_metrics_daily`** — daily snapshots by agent/pipeline/stage/seller/cadence
- **`ai_email_agent_outcomes`** — granular outcome events (email_generated, cooldown_blocked, opportunity_advanced, etc.)

All with FKs, indexes, RLS, and constraint checks as specified in the sprint spec.

**Seeds**: Default "Proposta sem resposta" cadence (5 steps), "Retomada comercial" cadence (3 steps), and default cooldown policy.

## 2. Edge Functions

### `compute-email-cadence-eligibility` (New)
Core decision engine — given agent + opportunity:
- Resolves applicable policy (stage > pipeline > agent default)
- Checks cadence progress (current step, next step)
- Evaluates all cooldowns (contact, opp, account, subject, purpose, business hours, manual touch, bounce, opt-out)
- Returns `{ eligible, next_step, blocked_reasons, recommended_purpose, requires_approval }`

### `run-email-agent-cadence-scheduler` (New)
Replaces/extends `enqueue-email-agent-triggers` for cadence-aware scheduling:
- Scans active cadence progress entries where `next_eligible_at <= now()`
- Calls eligibility computation for each
- Creates `ai_agent_execution_runs` only when truly eligible
- Records `cooldown_blocked` / `policy_blocked` outcomes when not eligible

### `advance-email-cadence-progress` (New)
Called after successful send, reply, stage change, or stop event:
- Updates `current_step_order`, `steps_completed`, `next_eligible_at`
- Handles `stop_on_reply`, `stop_on_stage_change`, `stop_on_manual_override`
- Records outcomes

### `aggregate-email-agent-metrics` (New)
Daily aggregation job:
- Queries outcomes for the day
- Upserts into `ai_email_agent_metrics_daily` broken by agent/pipeline/stage/seller/cadence

### `execute-email-agent-run` (Update)
- Inject cadence step context (purpose, angle, tone, CTA guidance) into generation prompt
- After successful send, call `advance-email-cadence-progress`
- Record granular outcomes

### `ingest-email-delivery-event` (Update)
- On reply: check `stop_on_reply` and stop cadence if applicable
- Record outcomes for opens/replies

## 3. Types (ai-agents.ts)

Add ~6 interfaces: `EmailCadencePolicy`, `EmailCadenceStep`, `EmailCooldownPolicy`, `EmailPipelineRule`, `EmailCadenceProgress`, `EmailAgentMetricsDaily`, `EmailAgentOutcome`. Add `CadenceProgressStatus`, `EmailPurpose`, and `OutcomeType` types with labels/colors.

## 4. Service Layer + Hooks

- `cadenceService.ts` — CRUD for policies, steps, cooldowns, pipeline rules, progress queries
- `metricsService.ts` — fetch daily metrics with filters
- `useEmailCadence.ts` — hooks for cadence config CRUD
- `useEmailAgentMetrics.ts` — hooks for metrics dashboard

## 5. Frontend

### Builder Extensions (4 new conditional tabs for Email Agent)

**Aba Cadência** — `BuilderCadenceTab.tsx`
- List cadence policies, create/edit with step editor (drag-to-reorder cards with delay/purpose/angle/CTA)
- Visual timeline of steps with intervals

**Aba Cooldowns** — `BuilderCooldownsTab.tsx`
- Structured form with all cooldown fields
- Risk alerts (too aggressive / too lenient)

**Aba Pipeline Rules** — `BuilderPipelineRulesTab.tsx`
- Table of rules per pipeline/stage with inline editing
- Links to cadence and cooldown policies

**Aba Metrics** — `EmailAgentMetricsPage.tsx`
- KPI cards: sent, open rate, reply rate, advance rate, cooldown blocks, cost/reply
- Breakdowns by pipeline, stage, cadence, seller, period
- Tables: best/worst cadences, most-replied steps, block reasons

### Hub Update
- Enable "Métricas" hub item → route to Email Agent metrics page

### Builder Page Update
- Add 4 conditional tabs when agent type is Email Agent (after "Resumo")

## 6. Routing (App.tsx)

```
/app/settings/noid-intelligence/metrics → EmailAgentMetricsPage (lazy)
```

---

## Files Summary

| Action | File |
|--------|------|
| Migration | 7 tables + RLS + seeds + indexes |
| Create | `supabase/functions/compute-email-cadence-eligibility/index.ts` |
| Create | `supabase/functions/run-email-agent-cadence-scheduler/index.ts` |
| Create | `supabase/functions/advance-email-cadence-progress/index.ts` |
| Create | `supabase/functions/aggregate-email-agent-metrics/index.ts` |
| Create | `src/components/noid-intelligence/builder/BuilderCadenceTab.tsx` |
| Create | `src/components/noid-intelligence/builder/BuilderCooldownsTab.tsx` |
| Create | `src/components/noid-intelligence/builder/BuilderPipelineRulesTab.tsx` |
| Create | `src/pages/settings/noid-intelligence/EmailAgentMetricsPage.tsx` |
| Create | `src/services/ai-agents/cadenceService.ts` |
| Create | `src/services/ai-agents/metricsService.ts` |
| Create | `src/hooks/useEmailCadence.ts` |
| Create | `src/hooks/useEmailAgentMetrics.ts` |
| Edit | `src/types/ai-agents.ts` — cadence/cooldown/metrics types |
| Edit | `src/App.tsx` — metrics route |
| Edit | `src/pages/settings/noid-intelligence/AgentBuilderPage.tsx` — conditional tabs |
| Edit | `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx` — enable Métricas |
| Edit | `supabase/functions/execute-email-agent-run/index.ts` — cadence integration |
| Edit | `supabase/functions/ingest-email-delivery-event/index.ts` — cadence stop on reply |

