

# Sprint 1.3 — Execução Controlada do Email Agent

## Resumo

Implementar o primeiro agente operacional real: o **Email Agent**. Triggers reais do CRM disparam execuções controladas, o agente delibera via IA, gera emails reais, passa por aprovação quando necessário, envia via SMTP/Gmail existente, e registra impacto completo no CRM.

## Arquitetura

```text
┌─────────────────────────────────────────────────────────┐
│  CRM Events (proposals, opportunities, activities)      │
│                      │                                  │
│                      ▼                                  │
│  enqueue-email-agent-triggers (Edge Fn / Scheduler)     │
│   - idempotent scan for eligible triggers               │
│   - creates ai_agent_execution_runs (queued)            │
│                      │                                  │
│                      ▼                                  │
│  execute-email-agent-run (Edge Fn)                      │
│   ├─ validate-agent-execution (existing)                │
│   ├─ build live context (opportunity, contact, etc.)    │
│   ├─ deliberate via Lovable AI (gemini-2.5-flash)       │
│   ├─ generate email (subject, body, CTA)                │
│   ├─ check approval policy                              │
│   │   ├─ YES → ai_agent_approval_queue (pending)        │
│   │   └─ NO  → send via send-smtp-email                 │
│   ├─ persist run + action + email message               │
│   └─ log timeline + audit                               │
│                      │                                  │
│      ┌───────────────┼────────────────┐                 │
│      ▼               ▼                ▼                 │
│  approve/reject   send-smtp-email   ingest-delivery     │
│  (approval UI)    (existing fn)     events (webhook)    │
│      │               │                │                 │
│      └───────────────┴────────────────┘                 │
│                      │                                  │
│                      ▼                                  │
│  ai_agent_impact_events + timeline_events               │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Database Migration

6 new tables with RLS by `organization_id`:

- **`ai_agent_execution_runs`** — real execution records (queued → running → awaiting_approval → executed/skipped/failed)
- **`ai_agent_execution_actions`** — individual tool actions within a run (planned → executed/failed)
- **`ai_email_messages`** — generated email content (subject, body, CTA, delivery status)
- **`ai_email_delivery_events`** — delivery tracking (sent, opened, replied, bounced)
- **`ai_agent_approval_queue`** — functional approval queue (pending → approved/rejected/expired)
- **`ai_agent_impact_events`** — CRM impact tracking (email_sent, email_opened, opportunity_advanced, etc.)

FKs to `ai_agents`, `ai_agent_versions`, `profiles`, `opportunities`, `contacts`, `accounts`, `proposals`. All with RLS enabled and policies scoped to organization.

## 2. Edge Functions

### `enqueue-email-agent-triggers` (New)
Scheduler function (pg_cron every 5 min) that:
- Scans published Email Agents with active triggers
- Evaluates 3 initial triggers: `proposal_viewed_no_response`, `opportunity_stalled`, `email_activity_due`
- Idempotency via composite key (agent_id + trigger_id + entity_id + time window)
- Creates `ai_agent_execution_runs` with status `queued`
- Feature flags for `post_meeting_no_next_step` and `reactivation_eligible`

### `execute-email-agent-run` (New)
Core execution engine:
1. Load run + agent + version + builder config
2. Validate via existing `validate-agent-execution` logic
3. Build live context (opportunity, contact, account, proposal, activities, email history)
4. Deliberate via Lovable AI (`google/gemini-2.5-flash`) — returns structured decision (should_act, confidence, risk, reasoning)
5. If should_act=false → mark run as `skipped`
6. Generate email via generation prompt (subject, body_text, body_html, CTA)
7. Check approval policy (assisted autonomy, high risk, VIP account, tool config)
8. If approval required → create approval queue item, status `awaiting_approval`
9. If direct send → invoke existing `send-smtp-email`, record provider reference
10. Persist action + email message + timeline event + audit log

### `approve-email-agent-action` (New)
- Validates approver permission (`can_approve`)
- Supports optional edit of subject/body before sending
- Triggers real send via `send-smtp-email`
- Updates run, action, queue, email message statuses
- Logs timeline + audit

### `reject-email-agent-action` (New)
- Marks queue as rejected, run as blocked
- Logs rejection reason + audit

### `ingest-email-delivery-event` (New)
- Webhook-style endpoint for delivery events (sent, delivered, opened, replied, bounced)
- Updates `ai_email_messages.delivery_status`
- Creates `ai_email_delivery_events` records
- Creates `ai_agent_impact_events` for opens/replies
- Logs timeline event on the opportunity

## 3. Types (ai-agents.ts)

Add execution-specific types:
- `ExecutionRunStatus`, `ApprovalStatus`, `EmailSendStatus`, `DeliveryStatus`, `ImpactType`
- `AIAgentExecutionRun`, `AIAgentExecutionAction`, `AIEmailMessage`, `AIAgentApprovalItem`, `AIAgentImpactEvent`
- Labels and colors for all new statuses

## 4. Service Layer + Hooks

- `executionService.ts` — functions to invoke execution edge functions, list runs, manage approvals
- `useAgentExecution.ts` — `useExecutionRuns()`, `useApprovalQueue()`, `useApproveAction()`, `useRejectAction()`, `useRunDetails()`

## 5. Frontend

### Approvals Page (functional, replaces placeholder)
Route: `/app/settings/noid-intelligence/approvals` → `ApprovalsPage.tsx`
- Table: agent, type, opportunity, contact, risk, confidence, subject, requested_at
- Detail view: context summary, email preview, deliberation reasoning, approve/reject buttons
- Edit before approve (subject + body)

### Run Detail Page (new)
Route: `/app/settings/noid-intelligence/runs/:runId` → `RunDetailPage.tsx`
- Full run inspection: agent, version, trigger, context, deliberation, email preview, action status, delivery events, impact

### Agent Detail Updates
- New "Execução Real" block: runs last 24h/7d, pending approvals, sent count, reply rate, failures

### Hub Updates
- Mark "Aprovações" as `available: true`
- Mark "Logs" as `available: true` (link to runs list)

### Timeline Integration
- When agent events are logged to `timeline_events`, the existing timeline renderer picks them up via type `'ai'`

## 6. Routing (App.tsx)

Add lazy routes:
```
/app/settings/noid-intelligence/approvals → ApprovalsPage
/app/settings/noid-intelligence/runs/:runId → RunDetailPage
```

## 7. Scheduler Setup

Use `pg_cron` + `pg_net` to call `enqueue-email-agent-triggers` every 5 minutes:
```sql
SELECT cron.schedule('enqueue-email-agent-triggers', '*/5 * * * *', ...);
```

---

## Files

| Action | File |
|--------|------|
| Migration | 6 tables + RLS + indexes + FKs |
| Create | `supabase/functions/enqueue-email-agent-triggers/index.ts` |
| Create | `supabase/functions/execute-email-agent-run/index.ts` |
| Create | `supabase/functions/approve-email-agent-action/index.ts` |
| Create | `supabase/functions/reject-email-agent-action/index.ts` |
| Create | `supabase/functions/ingest-email-delivery-event/index.ts` |
| Create | `src/pages/settings/noid-intelligence/ApprovalsPage.tsx` |
| Create | `src/pages/settings/noid-intelligence/RunDetailPage.tsx` |
| Create | `src/services/ai-agents/executionService.ts` |
| Create | `src/hooks/useAgentExecution.ts` |
| Edit | `src/types/ai-agents.ts` — execution types |
| Edit | `src/App.tsx` — new routes |
| Edit | `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx` — enable Approvals/Logs |
| Edit | `src/pages/settings/noid-intelligence/AgentDetail.tsx` — execution stats block |

