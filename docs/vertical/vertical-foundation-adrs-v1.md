# Vertical Foundation — Architectural Decision Records (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

Normative ADRs that govern VERT-02 through VERT-06. Each ADR is binding until superseded by a new ADR referenced here.

---

## ADR-01 — Core cannot import concrete Packs

**Status:** Accepted.
**Context.** VERT-01 demonstrated that any Core→Pack import (e.g. Core referencing `router`/`sim_card` schemas) blocks multi-vertical evolution.
**Decision.** Core Universal must not import any module under `src/vertical-packs/**`. Extension happens via Foundation-typed contracts.
**Consequence.** Bridges that currently violate this (e.g. `src/lib/operations/inventoryEquipmentProfile.ts`) remain `@deprecated` with zero active runtime consumers and a removal owner.

---

## ADR-02 — Tenants may have multiple Packs

**Status:** Accepted.
**Context.** A single tenant may sell Connectivity + AV + Rental.
**Decision.** Modeling MUST NOT assume `tenant.vertical = <single enum>`. Pack presence is a set.
**Consequence.** No column, RLS predicate, or UI selector may reduce tenant vertical to a scalar.

---

## ADR-03 — Event Core is shared domain, not a Pack

**Status:** Accepted.
**Context.** Concepts like `event`, `venue`, `pavilion`, `stand` are shared by essentially all event-industry tenants regardless of which supplier discipline they run.
**Decision.** These concepts live in Event Core (VERT-03), not in Events Pack. Events Pack retains content/configuration specific to the Events context.
**Consequence.** Structural Events concepts migrate out of `src/vertical-packs/events/**` in VERT-03.

---

## ADR-04 — Provider is not Pack

**Status:** Accepted.
**Context.** `EventrixInventoryProvider` implements the provider adapter; it is not a vertical specialisation.
**Decision.** A Pack may use providers. A provider is never a Pack. Provider-specific settings stay confined to the provider adapter.
**Consequence.** `src/inventory/providers/**` remains provider-layer; capabilities and Pack manifests never encode provider identity.

---

## ADR-05 — Capability is not entitlement / feature flag / configuration / installation

**Status:** Accepted.
**Context.** These five concepts have been conflated in prior systems, producing brittle code.
**Decision.** Each concept has its own owner: Capability (Foundation contract), Feature flag (operational), Entitlement (commercial), Tenant configuration (VERT-04), Pack installation (VERT-06).
**Consequence.** No table may mix these concerns. Names, columns, and UI reflect the distinction.

---

## ADR-06 — Config before customization

**Status:** Accepted.
**Context.** Per-client forks and per-client tables have historically produced unsustainable maintenance.
**Decision.** Tenant needs must be met by configuration (VERT-04) before any code branch is considered.
**Consequence.** Per-client React components, per-client migrations, and per-client hardcoded flows are prohibited.

---

## ADR-07 — Historical meaning must be preserved

**Status:** Accepted.
**Context.** Changing a label, default, price, or Pack should not silently rewrite the meaning of records created earlier.
**Decision.** Surfaces that persist Pack-dependent semantics must snapshot resolved values, algorithm version, and/or `pack_version`. Reference: proposal inventory demand snapshot v2.
**Consequence.** Every persistence contribution in Foundation/Packs specifies its historical-semantics strategy.

---

## ADR-08 — No third-party arbitrary plugin execution

**Status:** Accepted.
**Context.** NOID is a governed vertical platform, not a plugin marketplace.
**Decision.** Vertical Packs are first-party, governed, type-safe, versioned, and known to NOID. No dynamic remote code loading, no public plugin registry, no third-party execution.
**Consequence.** Pack Engine (VERT-05) resolves only statically-registered manifests.

---

## ADR-09 — Pack lifecycle separated from Pack runtime composition

**Status:** Accepted.
**Context.** Merging lifecycle and composition produces a monolithic Pack Engine.
**Decision.** VERT-05 owns "how to compose". VERT-06 owns "how to manage lifecycle". They are distinct modules with distinct tables.
**Consequence.** Install/upgrade/rollback logic never lives in the resolver.

---

## ADR-10 — Foundation must remain industry-neutral

**Status:** Accepted.
**Context.** Foundation is the substrate for all verticals (Events today; possibly others later).
**Decision.** `src/vertical/foundation/**` (to be created in VERT-02.x) must not reference `event`, `venue`, `router`, or any industry-specific concept.
**Consequence.** Any leakage of industry concepts into Foundation is a Gate 2A blocker.
