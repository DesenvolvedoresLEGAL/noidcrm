# VERT-02.3 — Contribution Model Foundation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.3`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)
**Prev:** [VERT-02.2 — Extension Surface Contracts](./vertical-foundation-extension-surfaces-v1.md)

## Objective
Turn a raw contribution into a governed, provenance-tagged, runtime-validated declaration. No registry, no resolver, no composition context, no lifecycle.

## Prior state
`declareExtensionContribution(surface, contribution)` returned `{ surface, contribution }`. There was no provenance, no runtime shape check, no diagnostics.

## What VERT-02.3 adds

### Surface — runtime contribution schema
`ExtensionSurfaceDescriptor<TContribution>` now owns a `contributionSchema: z.ZodType<TContribution>`. The host is the single source of truth for the runtime shape its plug-ins must satisfy. `defineExtensionSurface` refuses to build a descriptor without a schema and rejects a value that is not a Zod schema at runtime.

### ContributionProvenance
```
{ packId: PackId, packVersion: string, sourcePath: string }
```
Frozen, opaque-only. Excludes `verticalId`, `tenantId`, `organizationId`, `userId`, `priority`, `installedAt`, feature flags, entitlements.

`packVersion` is an opaque, non-normalised string in v1 — no SemVer, no ordering, no compatibility, no upgrade path. Version semantics are owned by VERT-06.

`sourcePath` is diagnostic-only. Foundation never resolves it against the filesystem or performs dynamic import.

Both are validated: non-empty, non-whitespace-only, no surrounding whitespace, length-bounded.

Schema is `.strict()` — unknown fields (e.g. `priority`) are rejected.

### Declaration model
```
ExtensionContributionDeclaration<T> = {
  surface,
  provenance,
  contribution,
}
```
Wrapper and provenance are frozen. `capabilityId` is not duplicated — the single source is `declaration.surface.capabilityId`. The contribution payload is **not** deep-frozen: Foundation does not own its internals.

### Validation pipeline
Shared by safe and throwing APIs. Steps:
1. Parse provenance via `contributionProvenanceSchema`.
2. On failure → diagnostic `invalid_provenance` (no `packId` / `packVersion` / `sourcePath` echoed back).
3. Parse contribution via `surface.contributionSchema`.
4. On failure → diagnostic `invalid_contribution` (provenance echoed back for correlation).
5. Return a frozen declaration.

### Safe API
`validateExtensionContribution(surface, input: unknown)` — boundary API, never throws. Returns a discriminated union `{ ok: true, declaration } | { ok: false, diagnostic }`. `safeDeclareExtensionContribution` is an alias.

### Throwing API
`declareExtensionContribution(surface, provenance, contribution)` — first-party API. Runs the same pipeline; on failure throws `ExtensionContributionValidationError` carrying a sanitized diagnostic.

### Diagnostics
```
{
  code: 'invalid_provenance' | 'invalid_contribution',
  capabilityId,
  packId?, packVersion?, sourcePath?,       // only when provenance parsed
  issues: readonly { path, code, message }[]
}
```
No `duplicate`, `conflict`, `not_installed`, `disabled`, `entitlement_missing`, `unauthorized`, `priority_conflict` codes — those belong to later layers.

### No-payload-leak guarantee
Diagnostics never carry raw input, raw contribution, raw provenance, schema internals, function source, or full object dumps. Messages are collapsed to a single line and truncated to 240 chars. `ExtensionContributionValidationError.message` is a short capability-scoped string; the diagnostic itself is what callers should introspect. A synthetic-secret test asserts the sensitive marker never appears in the serialized diagnostic.

### Immutability
Foundation freezes: descriptor, provenance object, declaration wrapper, diagnostic object, and issues collection. It **does not** deep-freeze the contribution payload — future contributions may legitimately carry functions, schemas, or component references.

### Reference surface schema
`src/vertical/reference-surfaces/inventoryProductRequirementsSurface.ts` now provides a `contributionSchema` derived from the domain types:
- `providerType` — `z.enum(['native', 'eventrix'])`, validated **locally** in the reference surface. `InventoryProviderType` is a pure TypeScript type in `src/inventory/providers/types.ts`; promoting it to a runtime constant is out of scope for this sprint.
- `defaultUnitBasis` — reuses canonical `UNIT_BASIS_VALUES` from `src/inventory/requirements/unitBasis.ts`. Values are **not** re-declared in the surface.
- `acceptedCategoryRefs`, `acceptedFamilyRefs` — `z.array(z.string().min(1))`.
- `labels?` — `z.record(z.string(), z.string()).optional()`.

`InventoryProductRequirementsContribution` is inferred from the schema (single source of truth: `z.infer<typeof schema>`). No runtime consumer imports the surface — still reference-only.

### Foundation neutrality
Foundation has zero imports from `@/vertical-packs`, `@/inventory`, `@/roleplay`, `@/components`, React, or Supabase. The industry-neutrality governance test still passes.

### Deferred
Priority / ordering / conflict → VERT-02.5 (Registry / Resolver).
Registry / resolver → VERT-02.5.
`CompositionContext` → VERT-02.4.
Tenant config / installation state / entitlement / feature flag → VERT-04 / VERT-05.
PackManifest / PackDescriptor / dependencies / migrations → VERT-05 / VERT-06.
SemVer / version engine / upgrade / downgrade → VERT-06.

## Files touched
- `src/vertical/foundation/contributions.ts` (new)
- `src/vertical/foundation/surfaces.ts` (schema required; declaration carries provenance; strong API validates)
- `src/vertical/foundation/index.ts` (re-exports)
- `src/vertical/reference-surfaces/inventoryProductRequirementsSurface.ts` (runtime schema)
- `src/vertical/foundation/__tests__/contributions.test.ts` (new, 22 tests)
- `src/vertical/foundation/__tests__/surfaces.test.ts` (updated for schema + provenance)
- `src/vertical/reference-surfaces/__tests__/inventoryProductRequirementsSurface.test.ts` (schema + validation coverage)

## Verification
- 113/113 vertical tests green (43 ids + 9 capabilities + 11 surfaces + 22 contributions + 11 reference + 3 neutrality + 14 pack).
- Typecheck / build green (CI harness runs both).
- Zero runtime integration changes anywhere else in the codebase.
- Zero DB, zero migration, zero RLS, zero publish.

## Rollback
Purely code-level:
1. Delete `src/vertical/foundation/contributions.ts` and its test.
2. Restore VERT-02.2 versions of `surfaces.ts`, `index.ts`, reference surface, tests.
3. Remove this document and revert the VERT-02.3 line in `vert-02-sprint-decomposition-v1.md`.

Zero data impact.

## Recommendation
Proceed to **VERT-02.4 — Composition Context Foundation** upon explicit authorisation.
