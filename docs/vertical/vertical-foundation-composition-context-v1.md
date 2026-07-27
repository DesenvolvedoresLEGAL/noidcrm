# VERT-02.4 — Composition Context Foundation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.4`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)
**Prev:** [VERT-02.3 — Contribution Model Foundation](./vertical-foundation-contribution-model-v1.md)

## Objective
Define the read-only context a future resolver will hand to contributions.
No registry, no resolver, no contribution execution, no live tenant
configuration, no live shared-domain, no permissions engine, no installed
Packs, no entitlements, no feature flags.

## Prior state (VERT-02.3)
Foundation shipped ids, capabilities, surfaces (with runtime schemas),
contribution provenance, and validation. There was no contract describing
WHAT a future resolver will know at composition time.

## What VERT-02.4 adds

### `ReadonlyCompositionAccessor<TValue = unknown>`
Minimal read-only key -> value contract with a single `get(key: string)`
method. Generic `TValue` is set by the accessor's owner, not by callers per
call — this avoids fake `get<T>(key): T` type-safety.

### `EMPTY_COMPOSITION_ACCESSOR`
Frozen singleton whose `get` always returns `null`. Reusable as the safe
default for any accessor slot with no live backing.

### `CompositionContext<TContribution>`
```
{
  organizationId: string,
  userId: string | null,
  capabilityId: CapabilityId,
  surface: ExtensionSurfaceDescriptor<TContribution>,
  tenantConfig: ReadonlyCompositionAccessor,
  sharedDomain: ReadonlyCompositionAccessor,
}
```

- **organizationId** — required plain string. Not empty, not whitespace-only,
  no surrounding whitespace. Not branded (would spread a Core-wide type
  migration outside scope).
- **userId** — `string | null`. `undefined`/`null` -> `null` (structural
  ausence). Empty / whitespace / padded strings are rejected — never coerced.
- **capabilityId** — DERIVED from `surface.capabilityId`. Caller cannot
  supply it. Prevents drift between surface and context capability.
- **surface** — the bound descriptor; `TContribution` is preserved.
- **tenantConfig** — accessor stub. Foundation knows the *concept*; VERT-04
  will provide the persistence-backed implementation.
- **sharedDomain** — accessor stub. See ADR-10 refinement below.

### `createCompositionContext(input)`
- validates `organizationId` and `userId`;
- derives `capabilityId` from the surface;
- defaults both accessors to `EMPTY_COMPOSITION_ACCESSOR`;
- validates caller-supplied accessors expose `get`;
- freezes the wrapper;
- never invokes accessors;
- never mutates caller-supplied accessors.

### ADR-10 refinement — why `sharedDomain`, not `eventCore`
The VERT-02.0 decomposition mentioned an "Event Core accessor stub". ADR-10
forbids Foundation from naming any industry concept. Foundation therefore
exposes `sharedDomain` — an industry-neutral accessor slot. VERT-03 will
adapt Event Core TO this Foundation contract, not the other way around
(Event Core -> Foundation, never Foundation -> Event Core). The neutrality
governance test now explicitly rejects the token `eventcore` inside
Foundation source.

### Sync-only decision
Accessors are synchronous. No `Promise`, no fetch, no query. Foundation has
no live data to fetch in this sprint. Should a future implementation prove
async is structurally unavoidable, that decision is deferred with its own
ADR.

### Read-only guarantee
No `set`/`insert`/`update`/`delete`/`subscribe`. Wrapper is frozen. Caller
accessors are NOT deep-frozen: Foundation does not own their internals.

### Deferred
- Registry / resolver -> VERT-02.5.
- Live tenant configuration -> VERT-04.
- Live shared-domain / Event Core adapter -> VERT-03.
- Installed Packs / lifecycle -> VERT-05 / VERT-06.
- Entitlement, feature flags, permissions engine -> out of scope (ADR-05).
- Async accessors, namespaced key registries -> not needed yet.

## Files touched
- `src/vertical/foundation/context.ts` (new)
- `src/vertical/foundation/index.ts` (re-exports)
- `src/vertical/foundation/__tests__/context.test.ts` (new, 20 tests)
- `src/vertical/__tests__/foundationIndustryNeutrality.test.ts`
  (forbid `eventcore` token)
- `docs/vertical/vert-02-sprint-decomposition-v1.md` (mark 02.4 done)

## Verification
- 133/133 vertical tests green (43 ids + 9 capabilities + 11 surfaces + 22
  contributions + 11 reference + 20 context + 3 neutrality + 14 Connectivity
  Pack regression).
- Typecheck / build green.
- Zero runtime integration changes. Zero DB. Zero migration. Zero publish.

## Rollback
Code-level only:
1. Delete `src/vertical/foundation/context.ts` and its test.
2. Revert `index.ts`.
3. Revert the `eventcore` token in the neutrality test.
4. Remove this doc and the 02.4 line in the decomposition.

Zero data impact.

## Recommendation
Proceed to **VERT-02.5 — Static Registry / Resolver Foundation** upon
explicit authorisation.
