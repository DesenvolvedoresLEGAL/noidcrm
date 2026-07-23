# Inventory Provider — Canonical Sync Consistency (VERT-01.2E-0)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.2E-0`
**Status:** `VALIDATED — CANONICAL PROVIDER SYNC CONSISTENT`
**Classification:** YELLOW (controlled). Frontend hook only. No DB, RLS, RPC, Edge Function, Storage, Auth, or schema change. No publish.

## 1. Problem

`useUpsertEventrixInventorySettings` had two branches (INSERT / UPDATE) but only the **INSERT** branch executed the canonical dual-write into `inventory_provider_settings`. Updating an existing Eventrix configuration could therefore mutate `eventrix_inventory_integration_settings` without ever touching the canonical row.

## 2. Root cause

An early `return data as EventrixInventorySettings;` inside the UPDATE branch short-circuited the mutation before reaching the `upsertInventoryProviderSettings` call that lived below the INSERT block.

## 3. Prior behavior

- **INSERT (no existing row):** Eventrix INSERT → canonical `upsertInventoryProviderSettings`.
- **UPDATE (row exists):** Eventrix UPDATE → **return** → canonical sync skipped.

Consequences:
- Divergence between Eventrix-specific config and canonical provider selection.
- `useInventoryProvider` resolver could return a stale provider after an Eventrix toggle.

## 4. New behavior

Single shared code path:

1. Compute payload.
2. Read existing row.
3. Branch: UPDATE or INSERT, storing the result in `savedSettings`.
4. **Always** call `upsertInventoryProviderSettings` with:
   - `provider_type = 'eventrix'` when `input.is_enabled === true`;
   - `provider_type = 'native'` when `input.is_enabled === false`;
   - `is_enabled = true`;
   - `selection_source = 'legacy_eventrix_settings'`.
5. Return `savedSettings` only after both writes succeed.

## 5. Enable / disable mapping

| Input | Canonical `provider_type` | `is_enabled` | `selection_source` |
| --- | --- | --- | --- |
| `is_enabled = true`  | `eventrix` | `true` | `legacy_eventrix_settings` |
| `is_enabled = false` | `native`   | `true` | `legacy_eventrix_settings` |

Canonical row is never deleted.

## 6. Partial failure handling

- **Eventrix write fails:** canonical sync is NOT attempted; the mutation rejects with the original error.
- **Canonical write fails after Eventrix succeeds:** mutation rejects with a wrapped, sanitized message: `"Configuração Eventrix salva, mas falha ao sincronizar seleção canônica: <detail>"`. No secret/SQL is exposed. Nothing is rolled back.

## 7. Residual risk — atomicity

The two writes remain **non-atomic** while implemented as separate client-side operations. A true transactional guarantee requires a server-side RPC or Edge Function and is deferred to `VERT-01.2E` (Product BOM & Legacy Eventrix Consumer Cleanup) or a dedicated hardening sprint.

## 8. Tests

`src/hooks/settings/__tests__/useEventrixInventory.canonicalSync.test.tsx` — 8 scenarios:

1. INSERT enabled → canonical eventrix.
2. UPDATE enabled → canonical eventrix (no early return).
3. INSERT disabled → canonical native.
4. UPDATE disabled → canonical native.
5. Eventrix persistence failure → canonical never called.
6. Canonical failure → mutation rejects with sanitized error.
7. Canonical sync executes exactly once per mutation.
8. `organization_id` sourced from current org context (no hardcoded tenant).

All mocks; no real data.

## 9. Regression

- 8/8 new tests pass.
- 83/83 pass across `src/inventory`, `src/hooks/settings`, `src/pages/settings/__tests__` (includes VERT-01.2A/B/C/D suites).
- Tenant-isolation baseline unchanged.
- Typecheck: clean.

## 10. Cache invalidation (preserved)

- `eventrix-inv-settings`
- `inventory-provider-settings`
- `inventory-provider`

Identical for INSERT and UPDATE.

## 11. Files changed

- `src/hooks/settings/useEventrixInventory.ts`
- `src/hooks/settings/__tests__/useEventrixInventory.canonicalSync.test.tsx` (new)
- `docs/vertical/inventory-provider-canonical-sync-consistency-v1.md` (new)
- `docs/vertical/inventory-provider-settings-foundation-v1.md` (chronological note only)

## 12. Backend

DB, RLS, RPCs, triggers, Edge Functions, Storage, Auth, secrets — **untouched**.

## 13. Rollback

Code-only: revert `useEventrixInventory.ts` and delete the new test file. No data operations required.

## 14. Next sprint

`VERT-01.2E — PRODUCT BOM & LEGACY EVENTRIX CONSUMER CLEANUP`.
