# Roleplay Archetype — Decoupling Foundation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.4A`
**Status:** `VERT-01.4A VALIDATED WITH LEGACY EVENTS RUNTIME`

## 1. Context
`Archetype.type` was hardcoded to four Events-market values in Core (`src/services/roleplay/archetypes.ts`, `src/schemas/roleplay.ts`). This sprint extracts those values into an Events Vertical Pack and introduces a generic Core contract — without changing runtime behaviour or the database.

## 2. HC-004
`src/services/roleplay/archetypes.ts` — TS union `'Organizador' | 'Expositor' | 'Agência' | 'Empresa Contratante'`.

## 3. HC-005
`src/schemas/roleplay.ts` — `z.enum(['Organizador','Expositor','Agência','Empresa Contratante'])`.

## 4. Consumer Map
| Consumer | Class |
| --- | --- |
| `src/services/roleplay/archetypes.ts` | CORE_ROLEPLAY / LEGACY_COMPATIBILITY |
| `src/schemas/roleplay.ts` | CORE_ROLEPLAY / LEGACY_COMPATIBILITY |
| `src/components/roleplay/admin/ArchetypeModal.tsx` | ROLEPLAY_UI (select literals) |
| `src/pages/roleplay/RoleplayAdmin.tsx` | ROLEPLAY_UI |
| `src/pages/roleplay/NewRoleplay.tsx` | ROLEPLAY_UI |
| `src/pages/roleplay/ChatView.tsx`, `MySessions.tsx` | ROLEPLAY_UI (read-only) |
| `src/services/roleplay/{sessions,sellers}.ts` | ROLEPLAY_SERVICE (read-only) |
| `src/integrations/supabase/types.ts` | GENERATED_TYPE (enum `client_type`) |
| Playbook / Accounts / Tags pages containing "Expositor" | UNRELATED (segmentation copy, not archetypes) |

No cross-vertical consumer was found. All Events literals outside `types.ts` live inside the Roleplay module.

## 5. Storage Contract
`public.client_archetypes.type` — `USER-DEFINED` (Postgres enum `client_type`), nullable, no default.

## 6. DB Constraints
`client_type` enum values: `{Organizador, Expositor, Agência, Empresa Contratante}`. Sibling enums also present: `archetype_level_type`, `tone_style_type`, `decision_role_type`.

## 7. HC-018 Relationship
**Same root.** HC-018 tracks the Events literals inside the generated `client_type` enum in `src/integrations/supabase/types.ts`; that file is regenerated from the Postgres enum documented in §6. Resolving HC-018 requires the same database migration as the eventual runtime activation of the generic Archetype type (VERT-01.4B). HC-018 is therefore promoted to **linked-to-HC-004/005** but not resolved in this sprint.

## 8. Core Archetype Type
`src/roleplay/archetypes/types.ts` — `ClientArchetypeType = string` + `BaseArchetype` interface. Core has zero knowledge of Events values.

## 9. Generic Schema
`src/roleplay/archetypes/schema.ts` — `clientArchetypeTypeSchema` (trim + min/max), `baseArchetypeSchema` (universal shape).

## 10. Validation Factory
`createArchetypeSchema({ allowedTypes?, invalidTypeMessage? })` — no `allowedTypes` → generic; with list → refined enum. Core file imports nothing from `@/vertical-packs/**`.

## 11. Events Pack
`src/vertical-packs/events/roleplay/` — sister boundary of `src/vertical-packs/connectivity/`.

## 12. Events Archetype Values
`EVENTS_ARCHETYPE_TYPES = ['Organizador','Expositor','Agência','Empresa Contratante'] as const`. Derived: `EventsArchetypeType`, `EVENTS_ARCHETYPE_TYPE_LABELS`, `EVENTS_ARCHETYPE_TYPE_OPTIONS`, `isEventsArchetypeType`. Composed schema: `eventsArchetypeSchema = createArchetypeSchema({ allowedTypes: EVENTS_ARCHETYPE_TYPES })`.

## 13. Legacy Service
`src/services/roleplay/archetypes.ts` — untouched runtime; still exposes the Events union on `Archetype.type` because rows written today must satisfy the Postgres enum. Runtime migration is deferred to VERT-01.4B.

## 14. Legacy Schema
`src/schemas/roleplay.ts` — `archetypeSchema.type` now sources its enum values from `EVENTS_ARCHETYPE_TYPES` (single canonical list). Behaviour is byte-for-byte identical, but the four literals are no longer duplicated. Comment tagged `LEGACY EVENTS-CONSTRAINED CONTRACT`.

## 15. Other Roleplay Literals
Audited but not refactored in this sprint:

| Field | Physical enum | Classification |
| --- | --- | --- |
| `level` | `archetype_level_type` | TENANT_CONFIG_CANDIDATE |
| `tone_style` | `tone_style_type` | CORE_UNIVERSAL |
| `decision_role` | `decision_role_type` | CORE_UNIVERSAL |

Base schema keeps these as generic strings so future extractions do not require another Core edit; legacy schema still enforces the current enums for runtime parity.

## 16. Tests
`src/roleplay/archetypes/__tests__/archetypes.test.ts` — Core generic contract, factory behaviour, Events Pack canonicity, legacy schema regression (all four values still accepted, external rejected).

## 17. Regression
Legacy `archetypeSchema` unchanged in shape/messages/values. `Archetype` TS union unchanged. UI/select literals in `ArchetypeModal.tsx` unchanged.

## 18. Database Untouched
Zero migrations, zero `ALTER TYPE`, zero row writes, zero RLS/RPC/Edge changes.

## 19. Rollback
Deleting `src/roleplay/archetypes/`, `src/vertical-packs/events/`, and reverting `src/schemas/roleplay.ts` header restores the previous state. Tests and docs are additive.

## 20. B Activation Plan (VERT-01.4B — not started)
1. Convert `client_type` enum → text column + FK to a tenant/pack-scoped lookup table seeded by the Events Pack.
2. Migrate `Archetype.type` TS union to `ClientArchetypeType`.
3. Point the runtime schema at `createArchetypeSchema({ allowedTypes: tenantAllowedTypes })`.
4. Extend `ArchetypeModal.tsx` select to render `EVENTS_ARCHETYPE_TYPE_OPTIONS` (still the default set).
5. Preserve existing rows (backfill lookup with the four canonical Events values).
6. Resolve HC-004, HC-005 and re-evaluate HC-018.
7. Gate 1 closeout.

## Hardcode Register
- HC-004 → `EVENTS_PACK_FOUNDATION_READY_LEGACY_RUNTIME`
- HC-005 → `GENERIC_SCHEMA_FOUNDATION_READY_LEGACY_RUNTIME`
- HC-018 → `LINKED_TO_HC-004/005_PENDING_DB_MIGRATION`
