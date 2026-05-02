# NOID RevenueOS — Agent Rules

## Context
System: NOID RevenueOS
Stack: React, TypeScript, Supabase, Edge Functions, Postgres, RLS

## Core Principles
- Always analyze before coding
- Never break RLS or multi-tenant logic
- Prefer small and safe changes
- Avoid duplication
- Reuse existing hooks, services and patterns

## Workflow
1. Read current implementation
2. List impacted files
3. Propose minimal plan
4. Implement
5. Review risks

## Backend Rules
- Always validate tenant_id
- Never bypass RLS
- Reuse existing services when possible

## Frontend Rules
- Avoid unnecessary re-renders
- Use existing hooks
- Follow current component patterns

## Edge Functions
- Always log errors
- Handle failures safely
- Retry when needed

## Output Format
- Files changed
- Summary
- Risks
- Next steps
## Pull Request Review Rules

Every PR must be reviewed as if it could affect production.

Review priorities:
1. RLS and multi-tenant isolation
2. Data loss or migration risk
3. Broken imports or dead code
4. Edge Function regressions
5. React state/cache invalidation problems
6. Performance regressions
7. Security issues
8. Hidden behavior drift

For notification changes, always check:
- notifications_v2
- notification_events
- notification_delivery_logs
- push_delivery_jobs
- legacy notifications table usage
- inbox/history behavior
- delivery status and retry behavior

For Supabase changes, always check:
- tenant or organization scoping
- RLS policies
- service_role usage
- grants/revokes
- rollback risk
- indexes for polling/query performance

For every PR, return:
- Blockers
- Warnings
- Suggested fixes
- Safe to merge: yes/no
