# Vertical Foundation — Static Registry / Resolver (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.5`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

## Objective
In-memory, instance-based registry + deterministic resolver for extension surfaces and contributions. No installation, no tenant filtering, no merge, no execution.

## Baseline
Builds on VERT-02.1..02.4 (ids, capabilities, surfaces, contributions, composition context).

## Meaning of "static"
- In-memory
- First-party
- Code-level
- No persistence
- No dynamic remote loading

**Does NOT mean module-level singleton.** Foundation exports **no default registry**; callers must invoke `createExtensionRegistry()`.

## Registry API
- `createExtensionRegistry(): ExtensionRegistry`
- `registerSurface(surface)`
- `hasSurface(capabilityId)`
- `getSurface(capabilityId): ExtensionSurfaceDescriptor<unknown> | null`
- `registerContribution(declaration)`
- `resolve(context): ExtensionResolutionResult<T>`

No `unregister`, no admin API, no merge, no priority, no installation gating.

## Host / surface registration
- Descriptor validated shape-wise.
- Duplicate `capabilityId` → `surface_already_registered`, even if the exact same reference is passed. No silent overwrite.
- Registered descriptor reference is preserved (not re-wrapped).

## Descriptor identity
A capability is bound to **one** descriptor per registry instance. Contributions and contexts must reference **exactly** that descriptor (same identity). Distinct descriptors with equal `capabilityId` may carry different runtime schemas — rejected as `surface_descriptor_mismatch`.

## Contribution registration
- Surface must exist.
- `declaration.surface` must be the registered descriptor (identity).
- Provenance + contribution are **re-validated** via `validateExtensionContribution` (VERT-02.3 pipeline). No trust in caller types.
- Only the canonical declaration produced by the pipeline is stored.

## Unique contribution key (v1)
`(surface.capabilityId, provenance.packId)`.

- Same Pack, same surface → `duplicate_pack_contribution`.
- Same Pack, different surfaces → allowed.
- Different Packs, same surface → allowed (ADR-02).

`packVersion` is **not** part of the key. Multiple active versions per registry are out of scope (VERT-06 owns lifecycle).

## Merge contract deferred
V1 always rejects duplicate same-pack/surface. No merge, no priority, no precedence field. Explicit merge contract deferred until a real surface demonstrates the need.

## Deterministic ordering
Resolution orders contributions by **ascending lexicographic `PackId`**, independent of registration order, `packVersion`, `sourcePath`, or timing. Foundation determinism only — not a commercial precedence rule.

## Resolver
- Consumes `CompositionContext<T>`; does not re-take `capabilityId` separately.
- Validates: `context.surface` registered, `context.capabilityId === context.surface.capabilityId`, descriptor identity equals the registered one.
- Empty registered surface → success with `contributions: []`.
- Unregistered surface → `surface_not_registered` (never silent empty).

## Resolution result
Frozen wrapper `{ capabilityId, surface, context, contributions }`. `contributions` is a frozen, readonly snapshot. Mutating it does not affect the registry.

## Non-execution guarantees
Registry / resolver:
- Never call `context.tenantConfig.get(...)`
- Never call `context.sharedDomain.get(...)`
- Never invoke functions / builders inside contributions.

## Error model
`ExtensionRegistryError` carries only `{ code, capabilityId?, packId?, message }`. Codes:
- `surface_already_registered`
- `surface_not_registered`
- `surface_descriptor_mismatch`
- `duplicate_pack_contribution`
- `context_surface_mismatch`

Contribution shape/provenance failures continue to throw `ExtensionContributionValidationError` (VERT-02.3), whose diagnostic is already payload-sanitized.

## No-payload-leak
Neither the registry error message nor its structured fields include raw contribution payloads, provenance beyond `packId`, tenant values, shared-domain values, or context contents.

## Registry vs Provider Registry
`InventoryProviderRegistry` (`src/inventory/providers/**`) is a provider-local registry for inventory adapters. It is **not** the Vertical Foundation registry. This sprint does not touch it.

## Deferred (not in v1)
- Pack installation / active Packs per tenant → VERT-06
- Pack Engine + PackManifest → VERT-05
- Tenant Configuration filtering → VERT-04
- Entitlements / feature flags → operational / commercial layers
- Contribution execution semantics → per-surface hosts in later sprints
- Persistence → none

## Tests
`src/vertical/foundation/__tests__/registry.test.ts` covers: instance isolation, surface registration + duplicate rejection, descriptor identity, contribution revalidation (invalid payload rejected via `ExtensionContributionValidationError`), duplicate same-pack/surface rejection, multi-Pack coexistence, deterministic order (independent of registration/version/path), resolver context integrity, empty resolution, frozen result / readonly snapshot, non-execution of tenantConfig / sharedDomain / payload functions, no-payload-leak, absence of merge/priority/singleton APIs.

## Neutrality
Foundation neutrality scan extended over new files; zero concrete Pack, provider, vendor, or industry tokens.

## Impact
- Runtime existing changes: **zero**
- DB / migration / publish: **zero**
- Rollback: delete `registry.ts` + test, revert barrel + doc.

## Recommendation
Ready for authorization of **VERT-02.6 — Foundation Integration & Gate 2A**. Do not auto-start.
