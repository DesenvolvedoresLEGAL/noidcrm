# Vertical Foundation — Core Types & Capability Contract (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.1`
**Classification:** GREEN — Foundation code, isolated. No runtime integration, no DB, no publish.
**Predecessors:** [VERT-02.0 Foundation Architecture](./vertical-foundation-architecture-v1.md), [Capability Taxonomy](./vertical-capability-taxonomy-v1.md), [Foundation ADRs](./vertical-foundation-adrs-v1.md).
**Decision:** `VERT-02.1 VALIDATED — CORE VERTICAL TYPES & CAPABILITY CONTRACT ACTIVE`.

## 1. Objective

Deliver the first code implementation of the Vertical Foundation: branded identifier types (`VerticalId`, `PackId`, `CapabilityId`), their parsers, the canonical v1 capability catalog, and automated protection of ADR-01 and ADR-10. Nothing else.

## 2. Normative contracts consumed

- Capability format `<domain>.<capability>` (Capability Taxonomy §1).
- Frozen v1 catalog of 15 capability ids (Capability Taxonomy §3).
- ADR-01 (Core cannot import concrete Packs).
- ADR-10 (Foundation must remain industry-neutral).
- ADR-02 (multi-Pack per tenant) — respected by NOT introducing any tenant-scalar vertical.

## 3. Preflight

- `src/vertical/` did not exist. No collisions with `VerticalId` / `PackId` / `CapabilityId` anywhere in the repo.
- `InventoryProviderCapability` at `src/inventory/providers/types.ts:9` is provider-local; classified `PROVIDER-LOCAL ADAPTER CONTRACT`, untouched.
- Path alias `@/*` confirmed in `tsconfig.json` / `tsconfig.app.json`.
- Baseline test scope for existing Packs (Connectivity, Roleplay) confirmed green before and after.

Result: `VERT-02.1 PREFLIGHT READY`.

## 4. Files created

```
src/vertical/foundation/ids.ts
src/vertical/foundation/capabilities.ts
src/vertical/foundation/index.ts
src/vertical/foundation/__tests__/ids.test.ts
src/vertical/foundation/__tests__/capabilities.test.ts
src/vertical/__tests__/foundationIndustryNeutrality.test.ts
docs/vertical/vertical-foundation-core-types-capabilities-v1.md
```

Nothing else changed.

## 5. `VerticalId`

Branded string via `unique symbol`. Identifies a high-level vertical context. Runtime = string; TS prevents accidental mixing. Does NOT represent installed Pack, `tenant.vertical`, entitlement, feature flag, or configuration. No concrete `VerticalId` values are created — Foundation stays industry-neutral (ADR-10).

## 6. `PackId`

Branded string. Pure typed identity of a first-party Pack. Does NOT represent installation, version, enabled state, entitlement, or tenant configuration. No concrete `PackId` values live in Foundation.

## 7. `CapabilityId`

Branded string. Identifies a Foundation capability contract. Syntax v1: exactly two segments separated by a single dot, each segment `[a-z0-9_]+`.

## 8. Machine identifier contract (VerticalId / PackId)

- non-empty, lowercase ASCII, `[a-z0-9_]`
- single segment (no dot / space / hyphen / slash / uppercase)
- parsers reject invalid input; NEVER auto-normalise (`My-Pack` is rejected, not coerced to `my_pack`)

## 9. Capability syntax v1

- `<domain>.<capability>`, exactly two segments
- Each segment matches `[a-z0-9_]+`
- Rejected: missing dot, leading/trailing dot, double dot, uppercase, whitespace, hyphen, slash, 3+ segments, empty
- 3-segment nesting is a v2-forward-compatible option per the taxonomy doc; NOT implemented here

## 10. Parser behavior

All parsers are Zod-based and return branded types. Public API:

```
verticalIdSchema, packIdSchema, capabilityIdSchema
parseVerticalId, parsePackId, parseCapabilityId
safeParseVerticalId, safeParsePackId, safeParseCapabilityId
isVerticalId, isPackId, isCapabilityId
```

Parsers do not trim, do not lowercase, do not mutate.

## 11. Branded type safety

`@ts-expect-error` tests verify that `VerticalId`, `PackId`, and `CapabilityId` are mutually non-assignable while remaining assignable to `string`. Runtime values remain plain strings — zero wrappers, zero classes.

## 12. Canonical capability catalog

Constructed via `parseCapabilityId` (never `as CapabilityId`). Frozen with `Object.freeze`.

## 13. Canonical IDs v1 (15)

1. `inventory.product_requirements`
2. `inventory.proposal_demand`
3. `inventory.equipment_profiles`
4. `roleplay.archetype_types`
5. `proposal.vertical_sections`
6. `pricing.vertical_rules`
7. `opportunity.handoff_extensions`
8. `academy.vertical_content`
9. `operations.vertical_workflows`
10. `ai.vertical_context`
11. `navigation.vertical_entries`
12. `forms.vertical_fields`
13. `reports.vertical_metrics`
14. `automation.vertical_triggers`
15. `import_export.vertical_bindings`

`CanonicalCapabilityId` is a union derived from the map's values. `CANONICAL_CAPABILITY_IDS` is derived from `Object.values(CAPABILITY_IDS)` — single source of truth, no drift possible.

## 14. Catalog vs. registry

`CAPABILITY_IDS` is a CATALOG of known contract identifiers. It is NOT a runtime registry. No `registerCapability`, `resolveCapability`, `getInstalledCapabilities`, or tenant-enablement API exists in this sprint. Those belong to VERT-02.5 / VERT-04 / VERT-05 / VERT-06.

## 15. Capability vs. provider-local capability

Foundation `CapabilityId` and provider-local `InventoryProviderCapability` are distinct concerns:

| Concept | Scope | Owner |
|---|---|---|
| `CapabilityId` | Platform-level Foundation contract | `src/vertical/foundation/**` |
| `InventoryProviderCapability` | Which operations a single provider adapter supports | `src/inventory/providers/types.ts` |

## 16. `InventoryProviderCapability` coexistence

Untouched. No migration, no rename. Convergence (if ever) requires a dedicated future sprint modeling an explicit adapter between provider-local capabilities and Foundation capability ids.

## 17. Industry neutrality

Foundation source contains zero references to any Pack, provider, vendor, industry structural concept (event/venue/pavilion/exhibitor/organizer), or connectivity concept (router/sim_card/iccid/imei/ssid). Governance test lives OUTSIDE Foundation so its search tokens do not falsely trigger on themselves.

## 18. ADR-01 assertion

`src/vertical/__tests__/foundationIndustryNeutrality.test.ts` scans every `.ts`/`.tsx` file under `src/vertical/foundation/**` (excluding `__tests__`) and asserts no import path contains `vertical-packs/`. Runs on every test suite invocation.

## 19. ADR-10 assertion

Same test scans for forbidden vendor/provider/industry concept tokens (case-insensitive). Tokens are constructed at runtime by concatenation so the test file itself doesn't contain literal forbidden strings that would self-trigger.

## 20. Tests

- `src/vertical/foundation/__tests__/ids.test.ts` — 43 tests
- `src/vertical/foundation/__tests__/capabilities.test.ts` — 9 tests
- `src/vertical/__tests__/foundationIndustryNeutrality.test.ts` — 3 tests

Total: **55 new tests, 69/69 green** in the scoped run (`bunx vitest run src/vertical` + connectivity co-run).

## 21. Typecheck

`bunx tsgo --noEmit -p tsconfig.app.json` → clean (no output, exit 0).

## 22. Build

Runtime unchanged; Foundation module has no runtime consumers this sprint. Build baseline unaffected.

## 23. Zero DB

No migration, table, enum, RLS policy, RPC, trigger, Edge Function, seed. `VerticalId` / `PackId` / `CapabilityId` are code-level contracts only.

## 24. Zero runtime wiring

No Pack, provider, hook, service, page, or edge function was modified. Foundation exists without runtime consumers — intentional.

## 25. Rollback

Delete the seven files listed in §4 and the documentation addendum. Nothing else to revert.

## 26. Recommendation

Proceed to **`VERT-02.2 — EXTENSION SURFACE CONTRACTS`** upon authorisation. Do not auto-start.
