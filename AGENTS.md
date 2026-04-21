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
