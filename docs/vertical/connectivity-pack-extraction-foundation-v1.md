# Connectivity Pack Extraction — Foundation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.3A`
**Decision:** `VERT-01.3A VALIDATED WITH LEGACY EQUIPMENT PROFILE BRIDGE`
**Classification:** YELLOW (code-level architectural reorganization; no DB, no data, no publish).

## 1. Context

Follows `VERT-01.2E COMPLETE — EVENTRIX CORE COUPLING REMOVED WITH LEGACY STORAGE BRIDGE`.
Purpose: extract from Core the router/SIM connectivity hardcodes flagged in VERT-01.1 as
HC-006 (`inventoryEquipmentProfile`) and HC-007 (connectivity labels in the generic
`formErrorFeedback` map), creating a formal Connectivity Vertical Pack code boundary.

**Not in scope:** Pack Engine, pack install/uninstall, tenant packs, entitlements,
versioning, migrations, Event Core, data rewrites.

## 2. Pre-flight

- Read: `src/lib/operations/inventoryEquipmentProfile.ts`, `src/lib/operations/formErrorFeedback.ts`.
- No pre-existing `src/packs/`, `src/vertical-packs/`, `src/vertical/` folder → created
  `src/vertical-packs/connectivity/inventory/` as the new code-level boundary.
- Storage contract intact: `inventory_items.metadata.router|sim_card` and
  `inventory_pre_reservation_allocations.custom_config.router|sim_card` unchanged.
- Baseline: typecheck green, no migration required.

## 3. Consumer map (legacy bridge remains authoritative until VERT-01.3B)

| Path | Symbols used | Domain | Kind | Risk | VERT-01.3B action |
| --- | --- | --- | --- | --- | --- |
| `src/services/operations/inventoryItems.ts` | schemas + factory types | Connectivity | Service | Low | Import from Pack |
| `src/components/operations/inventory/InventoryItemFormDialog.tsx` | profile + schemas + `showFormErrors` | Connectivity | UI | Low | Import from Pack + pass `CONNECTIVITY_INVENTORY_FIELD_LABELS` |
| `src/components/operations/inventory/InventoryQuantityItemFormDialog.tsx` | `showFormErrors` | Core | UI | None | Keep Core |
| `src/components/operations/inventory/InventoryCategoryFormDialog.tsx` | `EQUIPMENT_PROFILE_OPTIONS` | Connectivity | UI | Low | Move to Pack composition |
| `src/components/operations/inventory/InventoryAllocatedItemsList.tsx` | allocation helpers | Connectivity | UI | Low | Import from Pack |
| `src/components/operations/inventory/EquipmentProfileFactoryFields.tsx` | `SIM_CARRIERS` | Connectivity | UI | Low | Import from Pack |
| `src/components/operations/inventory/AllocationCustomConfigDialog.tsx` | custom schemas + helpers | Connectivity | UI | Low | Import from Pack |

## 4. Boundary

```
src/vertical-packs/connectivity/
├── index.ts
└── inventory/
    ├── equipment.ts     # profile, schemas, metadata/allocation helpers, SIM carriers
    ├── fieldLabels.ts   # CONNECTIVITY_INVENTORY_FIELD_LABELS
    └── index.ts
```

- `ConnectivityEquipmentProfile = 'router' | 'sim_card'` — no `generic`.
- `CONNECTIVITY_EQUIPMENT_PROFILE_LABELS`, `CONNECTIVITY_EQUIPMENT_PROFILE_OPTIONS`,
  `isConnectivityEquipmentProfile`, `isConnectivityProfileConfigured`.
- `RouterFactory`, `SimCardFactory`, `RouterCustom`, `SimCardCustom` (fields unchanged).
- Schemas: `routerFactorySchema`, `simCardFactorySchema`, `routerCustomSchema`,
  `simCardCustomSchema` (validation rules unchanged).
- Metadata helpers: `getRouterFactory`, `getSimCardFactory`, `mergeFactoryRouter`,
  `mergeFactorySim`.
- Allocation helpers: `getRouterCustom`, `getSimCardCustom`, `hasRouterCustom`,
  `hasSimCustom`.
- `SIM_CARRIERS = ['Vivo','Claro','TIM','Algar','Outra']` (verbatim).

## 5. Core-generic error feedback

`src/lib/operations/formErrorFeedback.ts` refactored:

- Exposes `CORE_FIELD_LABELS` (name, category, family, location, quantities, serial,
  asset code, brand, model, notes, description, technical_specs). **No connectivity keys.**
- `showFormErrors(errors, options?)` — new optional `options.fieldLabels` layered on
  top of `CORE_FIELD_LABELS` with precedence to caller-provided labels. Signature is
  backwards-compatible when passed directly as a react-hook-form error handler (the
  second RHF `event` argument is ignored unless it carries a `fieldLabels` property).
- No global registry; extensions are per-call.

## 6. Legacy bridge

`src/lib/operations/inventoryEquipmentProfile.ts` is now a `@deprecated` compatibility
bridge that re-exports the Pack surface and keeps:

- `EquipmentProfile = 'generic' | 'router' | 'sim_card'`
- `EQUIPMENT_PROFILE_LABELS` and `EQUIPMENT_PROFILE_OPTIONS` composed from
  `{ generic: 'Genérico' }` + connectivity labels/options (no duplicated literals).
- `getEquipmentProfile(value)` — unchanged behaviour (unknown → `'generic'`).
- `isAllocationConfigured(profile, cfg)` — kept for legacy consumers; delegates to
  `hasRouterCustom` / `hasSimCustom` and returns `true` on generic.

No schemas or helpers are duplicated; everything delegates to the Pack.

## 7. Sensitive data

Fields `wifi_password_*`, `admin_password`, `pin` are moved *by reference only*. No real
values were read, logged, or fixtured. Tests use synthetic strings.

## 8. Tests

- `src/vertical-packs/connectivity/inventory/__tests__/connectivity.test.ts` — profile,
  schemas, helpers, labels, SIM carriers.
- `src/lib/operations/formErrorFeedback.test.ts` — Core labels exclude connectivity,
  `showFormErrors` extension point precedence and RHF compatibility.
- `src/lib/operations/inventoryEquipmentProfile.test.ts` — pre-existing legacy tests
  continue to pass via bridge re-exports.

## 9. Regression

- `bunx tsgo --noEmit -p tsconfig.app.json` → green.
- No DB / RLS / RPC / Edge Function / migration change.
- `inventory_items.metadata` and allocation `custom_config` shapes intact.

## 10. Hardcode register updates

- **HC-006:** `EXTRACTED_TO_CONNECTIVITY_PACK_WITH_LEGACY_BRIDGE`.
- **HC-007:** `PACK_LABELS_EXTRACTED_CONSUMERS_PENDING` (labels removed from
  `CORE_FIELD_LABELS`; consumers still call `showFormErrors` without passing the Pack
  labels — migration is VERT-01.3B).

## 11. Risks & rollback

- Risk: connectivity-form error toasts now fall back to the raw path segment for
  router/SIM fields until consumers pass `CONNECTIVITY_INVENTORY_FIELD_LABELS`. Low
  user impact; targeted in VERT-01.3B.
- Rollback: revert `formErrorFeedback.ts`, `inventoryEquipmentProfile.ts`, and delete
  `src/vertical-packs/connectivity/`. Data untouched.

## 12. Next sprint

`VERT-01.3B — ACTIVATE CONNECTIVITY PACK BOUNDARY IN INVENTORY CONSUMERS`
— migrate the seven consumers above to import from `@/vertical-packs/connectivity/inventory`
and pass the pack field labels to `showFormErrors`. Do not start automatically.
