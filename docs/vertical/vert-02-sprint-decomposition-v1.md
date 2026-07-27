# VERT-02 — Sprint Decomposition (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

Proposed decomposition of the VERT-02 epic (Vertical Foundation) into small, individually validated sprints. Each sprint is a hypothesis: order and scope may be adjusted at the start of each sprint based on findings from the previous one. **No sprint below is authorised by this document — each requires explicit authorisation.**

---

## VERT-02.1 — Core Vertical Types & Namespaced Capability Contract

**Goal.** Introduce `src/vertical/foundation/**` with:
- branded string types for `VerticalId`, `PackId`, `CapabilityId`
- parser/validator for capability IDs enforcing [Capability Taxonomy §1](./vertical-capability-taxonomy-v1.md)
- canonical capability ID constants for the v1 catalog (§3 of taxonomy)
- unit tests proving industry-neutrality (Foundation must not import Packs / Events / Connectivity)

**Non-goals.** No runtime resolver. No registry state. No DB.

**Exit criteria.** Types + validator + constants + tests green; ADR-10 assertion test in place.

**Status.** `VERT-02.1 implemented / validated` — see [Core Types & Capability Contract](./vertical-foundation-core-types-capabilities-v1.md).

---

## VERT-02.2 — Extension Surface Contracts

**Goal.** Define TypeScript contracts for hosting an extension surface: `ExtensionSurfaceDescriptor<TContribution>`, host declaration API, and contribution declaration API. Ship contracts + reference-only host stub for `inventory.product_requirements`.

**Non-goals.** No wiring into runtime. No Pack contributions accepted yet.

**Exit criteria.** Contracts compile; reference host stub demonstrates intent; type-level tests prove surface generics are sound.

**Status.** `VERT-02.2 implemented / validated` — see [Extension Surface Contracts](./vertical-foundation-extension-surfaces-v1.md).

---

## VERT-02.3 — Contribution Model Foundation

**Goal.** Define contribution shape validation (Zod), contribution provenance metadata (`packId`, `packVersion`, `sourcePath`), and diagnostic types for rejected contributions.

**Non-goals.** No Pack Engine. No install state.

**Exit criteria.** Contribution validator accepts/rejects synthetic samples; diagnostics carry provenance.

**Status.** `VERT-02.3 implemented / validated` — see [Contribution Model Foundation](./vertical-foundation-contribution-model-v1.md).

---

## VERT-02.4 — Composition Context Foundation

**Goal.** Define `CompositionContext` — the read-only value passed to contributions at resolution time: organization ID, user, capability ID, surface descriptor, tenant-config accessor stub, Event Core accessor stub. Stubs are typed but return `null`.

**Non-goals.** No live tenant config, no live Event Core.

**Exit criteria.** Context type + factory + tests.

**Status.** `VERT-02.4 implemented / validated` — see [Composition Context Foundation](./vertical-foundation-composition-context-v1.md). Foundation exposes `sharedDomain` (industry-neutral) instead of `eventCore` per ADR-10; VERT-03 will adapt Event Core to this contract.

---

## VERT-02.5 — Static Registry / Resolver Foundation

**Goal.** In-memory static registry: register a host, register contributions, resolve by capability ID + surface. Deterministic order; conflict policy = reject on duplicate contribution for same `(surface, packId)` unless explicit merge contract.

**Non-goals.** No persistence. No installation gating. No tenant-config filter (comes in VERT-04).

**Exit criteria.** Registry + resolver + conflict tests; zero concrete Pack knowledge in Foundation.

---

## VERT-02.6 — Foundation Integration & Gate 2A

**Goal.** Migrate ONE existing generic surface (recommended: `inventory.product_requirements`) to be hosted through the Foundation surface API, with the existing Connectivity Pack registering its contribution through the Foundation. No behavior change for end users.

**Non-goals.** No new Pack. No Event Core. No tenant config.

**Exit criteria.**
- Existing tests still green.
- Foundation-hosted surface serves the same data path.
- Deprecation notice added to any direct Pack-import that bypasses the surface.
- `GATE 2A — VERTICAL FOUNDATION CONTRACT READY` declared.

---

## Gate 2A — Vertical Foundation Contract Ready

Criteria:

1. Capability contract implemented and validated.
2. Extension surface contract implemented.
3. Contribution model implemented with provenance + diagnostics.
4. Composition context implemented (stubs for tenant/Event Core acceptable).
5. Static resolver implemented with conflict policy.
6. Dependency-direction assertion tests green (Foundation imports zero concrete Packs; zero Events/Connectivity/vendor concepts in Foundation).
7. At least one real capability served end-to-end through the Foundation surface without user-visible regression.

Gate 2A unblocks VERT-03 (Event Core) to build on stable Foundation contracts. It does NOT complete Gate 2 of the PRD, which encompasses VERT-02..06.

---

## Ordering Notes

- VERT-02.1 → VERT-02.2 is strict (types before contracts).
- VERT-02.3 and VERT-02.4 can be parallelised if a second implementer is available.
- VERT-02.5 depends on 2.2 + 2.3 + 2.4.
- VERT-02.6 depends on 2.5 and touches existing runtime — it is the only sprint in the decomposition that changes runtime behaviour, and only to route an already-generic surface through Foundation.

---

## Recommendation

Start with **VERT-02.1 — Core Vertical Types & Namespaced Capability Contract** upon authorisation. Do not auto-start.
