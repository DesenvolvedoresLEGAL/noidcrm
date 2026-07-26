# Vertical Extension Surfaces — Initial Catalog (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-02.0`
**Parent:** [Vertical Foundation Architecture](./vertical-foundation-architecture-v1.md)

Initial catalog of surfaces in Core where Vertical Packs will contribute in future sprints. This document freezes intent, ownership, and priority — it does NOT implement any surface.

## Legend

- **Purpose** — what the surface enables.
- **Core owner** — the Core module that hosts the surface.
- **Contribution type** — kind of value a Pack will contribute (schema, component, resolver, config, seed).
- **Persistence** — does it require persisted contributions?
- **Tenant config** — does it require tenant-facing overrides?
- **Event Core dep.** — does it depend on Event Core?
- **Pack Engine dep.** — does it depend on runtime resolution?
- **Priority** — P0 (needed by VERT-02.x reference implementation) / P1 (needed for first Pack MVP) / P2 (later).

## Catalog

| # | Surface | Purpose | Core owner | Contribution type | Persistence | Tenant cfg | Event Core dep | Pack Engine dep | Priority |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `inventory.product_requirements` | Pack declares product requirement schemas & labels | `src/inventory/requirements` | schema + labels + validators | no (contribution) / yes (records) | yes (allowed categories) | no | yes | P0 |
| 2 | `inventory.proposal_demand` | Pack contributes demand normalizers & preview shapes | `src/inventory/demand` | normalizer + preview component | snapshot yes | no | possibly | yes | P0 |
| 3 | `inventory.equipment_profiles` | Pack declares equipment profile schemas (router/SIM/AV rig…) | `src/inventory/**` catalog hosts | schema + labels + custom-config merger | yes (records only) | no | no | yes | P1 |
| 4 | `roleplay.archetype_types` | Pack contributes allowed archetype types & metadata | `src/roleplay/archetypes` | options + optional schema extension | yes (records only) | yes (allowed list) | possibly | yes | P1 |
| 5 | `proposal.vertical_sections` | Pack contributes proposal sections rendered in public view | proposal renderer | React section component + schema | snapshot yes | yes (enable/order) | possibly | yes | P1 |
| 6 | `pricing.vertical_rules` | Pack contributes pricing rules (surcharges, kits, bundles) | pricing engine | pure rule fn + metadata | audit yes | yes | possibly | yes | P1 |
| 7 | `opportunity.handoff_extensions` | Pack contributes extra data cloned/reset on handoff/duplicate | opportunities service | field descriptor + reset policy | yes (records only) | no | no | yes | P2 |
| 8 | `academy.vertical_content` | Pack contributes courses/playbooks/terminology | Academy Core | content bundle | yes (references only) | yes | possibly | yes | P2 |
| 9 | `operations.vertical_workflows` | Pack contributes operational workflow templates | workflow engine | template + trigger declarations | yes | yes | possibly | yes | P2 |
| 10 | `navigation.vertical_entries` | Pack contributes sidebar / route entries | `AppSidebar` + router | menu descriptor + route lazy loader | no | yes (enable) | no | yes | P1 |
| 11 | `forms.vertical_fields` | Pack contributes custom fields to Core forms | form composition host | field descriptor + validator | yes (values only) | yes | possibly | yes | P1 |
| 12 | `reports.vertical_metrics` | Pack contributes reportable metrics/views | reports engine | metric definition + query | no (query) | yes | possibly | yes | P2 |
| 13 | `ai.vertical_context` | Pack contributes context blocks for prompts | AI runtime | context builder fn + scope | no | yes | yes | yes | P1 |
| 14 | `automation.vertical_triggers` | Pack contributes trigger/action registrations | automation engine | trigger/action manifest | yes (execution log) | yes | possibly | yes | P2 |
| 15 | `import_export.vertical_bindings` | Pack contributes import/export field bindings | import/export tooling | field map + parser | no | yes | possibly | yes | P2 |

## Notes

- Every surface must satisfy the dependency direction in [Vertical Foundation Architecture §11](./vertical-foundation-architecture-v1.md). Core hosts the surface; Packs contribute; Foundation types the contract; Pack Engine resolves.
- Surfaces requiring persisted contributions must snapshot resolved values per [Historical Semantics §15](./vertical-foundation-architecture-v1.md).
- Surface priorities may be reordered when VERT-02 sprint decomposition is finalised at the end of Foundation delivery.
