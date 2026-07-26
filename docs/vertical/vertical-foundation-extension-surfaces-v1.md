# Vertical Foundation — Extension Surface Contracts (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.2`
**Classification:** GREEN — Foundation code, isolated. No runtime wiring, no DB, no publish.
**Predecessors:** [VERT-02.0 Architecture](./vertical-foundation-architecture-v1.md), [VERT-02.1 Core Types & Capabilities](./vertical-foundation-core-types-capabilities-v1.md), [Extension Surfaces Catalog](./vertical-extension-surfaces-v1.md).
**Decision:** `VERT-02.2 VALIDATED — EXTENSION SURFACE CONTRACTS ACTIVE` (qualified: **REFERENCE SURFACE ONLY — NO RUNTIME RESOLUTION**).

## 1. Objective

Deliver the second Foundation block: type-safe extension surface contracts (`ExtensionSurfaceDescriptor`, host declaration, contribution declaration, `ContributionOf`) plus one reference-only surface for `inventory.product_requirements`. No registry, no resolver, no runtime wiring.

## 2. Extension Surface — definition

A Surface is a declared extension point where a future Pack contribution can plug in. Foundation defines the socket format; Core hosts the socket; Packs (in later sprints) provide the plug. This sprint delivers only the socket contract.

## 3. Host vs. contribution

- **Host declaration** — a Core module states "there is a socket here" via `defineExtensionSurface<TContribution>({ capabilityId })`.
- **Contribution declaration** — a would-be contributor states "this plug matches that socket" via `declareExtensionContribution(surface, payload)`. Neither call registers anything anywhere.

## 4. Descriptor

```ts
interface ExtensionSurfaceDescriptor<TContribution> {
  readonly capabilityId: CapabilityId;
  readonly description?: string;
  readonly __contributionType?: TContribution; // phantom, undefined at runtime
}
```

Descriptors are frozen (`Object.freeze`) and readonly at the type level. The `TContribution` generic is compile-time only — no fake runtime payload is fabricated for it.

## 5. Capability binding

Every surface is identified by its `CapabilityId`. No separate `SurfaceId` is introduced in v1 — capability IS surface identity. Reference surface uses `CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS`, never the raw string.

## 6. Host declaration API

```ts
defineExtensionSurface<TContribution>({
  capabilityId: CAPABILITY_IDS.INVENTORY_PRODUCT_REQUIREMENTS,
  description: '...',
});
```

- Requires an already-branded `CapabilityId` (invalid strings fail at compile and, defensively, at runtime).
- Returns a frozen descriptor.
- Does NOT register anywhere.

## 7. Contribution declaration API

```ts
declareExtensionContribution(surface, contribution);
```

- Signature uses `NoInfer<TContribution>` so `TContribution` is driven by the surface — the caller never restates the generic and the payload is checked against the surface's shape.
- Returns a frozen `ExtensionContributionDeclaration<TContribution>` carrying only `{ surface, contribution }`.

## 8. Type inference

Callers never restate the generic. Incompatible payloads fail at compile time (verified via `@ts-expect-error` tests).

## 9. `ContributionOf<TSurface>`

Utility that extracts the contribution type from a descriptor. Useful for downstream sprints.

## 10. Immutability

`Object.freeze` at construction; `readonly` on every field. Attempts to mutate throw at runtime and fail at the type level.

## 11. Reference surface

`src/vertical/reference-surfaces/inventoryProductRequirementsSurface.ts` — reference-only, not wired to any runtime consumer. Lives OUTSIDE Foundation because it imports Inventory types. Proves the Foundation contract can type a real capability without Foundation itself learning about Inventory.

## 12. Reference contribution type

`InventoryProductRequirementsContribution` — deliberately narrow (`providerType`, `acceptedCategoryRefs`, `acceptedFamilyRefs`, `defaultUnitBasis`, optional `labels`). Not intended to replace the existing runtime domain.

## 13. Dependency direction

| From | May import | Must NOT import |
|---|---|---|
| `src/vertical/foundation/**` | its own modules; `zod` | Packs, providers, Inventory, Roleplay, React, Supabase |
| `src/vertical/reference-surfaces/**` | Foundation; Inventory types | Packs, providers, runtime hosts |
| Existing runtime | (unchanged this sprint) | Foundation (no runtime consumer wired yet) |

## 14. Foundation neutrality

`src/vertical/foundation/surfaces.ts` references only `CapabilityId`, `isCapabilityId`, and generic terms (`surface`, `contribution`, `capability`). Zero concrete Pack / provider / vendor / industry tokens. ADR-01 and ADR-10 assertions in `src/vertical/__tests__/foundationIndustryNeutrality.test.ts` cover the new file automatically (test walks `src/vertical/foundation/**`).

## 15. Provenance — DEFERRED

`packId`, `packVersion`, `sourcePath`, `verticalId`, `tenantId`, `organizationId`, `registeredAt`, `priority` do NOT exist on any contribution shape in this sprint. Ownership: **VERT-02.3 — Contribution Model Foundation**.

## 16. Validation — DEFERRED

No Zod contribution validator, no diagnostic type, no rejected-contribution flow. Runtime shape validation ships in VERT-02.3.

## 17. Registry — DEFERRED

No global `Map`, no singleton, no `registerSurface` / `registerContribution` / `resolveSurface` / `listContributions`. Ownership: **VERT-02.5**.

## 18. Composition context — DEFERRED

Contributions receive no `organization`, `user`, tenant config, Event Core context, or permissions. Ownership: **VERT-02.4**.

## 19. Tests

- `src/vertical/foundation/__tests__/surfaces.test.ts` — descriptor creation, freeze, generic preservation, capabilityId validation, absence of provenance fields, `ContributionOf` extraction, contribution inference, `@ts-expect-error` compatibility checks, capability binding.
- `src/vertical/reference-surfaces/__tests__/inventoryProductRequirementsSurface.test.ts` — canonical capability binding, contribution type extraction, freeze, absence of provenance.
- `src/vertical/foundation/__tests__/ids.test.ts` — unchanged (VERT-02.1).
- `src/vertical/foundation/__tests__/capabilities.test.ts` — unchanged (VERT-02.1).
- `src/vertical/__tests__/foundationIndustryNeutrality.test.ts` — unchanged; automatically covers new `surfaces.ts`.

## 20. Typecheck

`bunx tsgo --noEmit -p tsconfig.app.json` — clean.

## 21. Build

Runtime unchanged. Baseline unaffected.

## 22. DB = zero

No migration, table, enum, RLS, RPC, trigger, edge function, seed.

## 23. Runtime wiring = zero

No Pack, provider, hook, service, page, edge function, or React component was modified. Existing Inventory / Product Requirements / Proposal Demand / Roleplay flows are untouched. The reference surface has zero consumers.

## 24. Rollback

Delete:

```
src/vertical/foundation/surfaces.ts
src/vertical/foundation/__tests__/surfaces.test.ts
src/vertical/reference-surfaces/inventoryProductRequirementsSurface.ts
src/vertical/reference-surfaces/__tests__/inventoryProductRequirementsSurface.test.ts
docs/vertical/vertical-foundation-extension-surfaces-v1.md
```

Revert the barrel export block in `src/vertical/foundation/index.ts` and the "Implemented in VERT-02.2" addendum in the two docs. No data, no DB.

## 25. Recommendation

Proceed to **`VERT-02.3 — CONTRIBUTION MODEL FOUNDATION`** upon authorisation. That sprint owns `PackId`-tagged contributions, provenance metadata, runtime shape validation (Zod), and rejection diagnostics. Do NOT auto-start.
