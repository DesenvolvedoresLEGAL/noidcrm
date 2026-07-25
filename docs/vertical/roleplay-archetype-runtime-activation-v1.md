# Roleplay Archetype — Runtime Activation (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.4B2`
**Status:** `VERT-01.4B2 VALIDATED — GENERIC ARCHETYPE TYPES ACTIVE IN ROLEPLAY`

## 1. Context
Closes the runtime side of the archetype decoupling started in VERT-01.4A and unlocked at the DB layer in VERT-01.4B1. Removes the Events-specific literal union from the runtime service and Zod schema, and routes the Events UI options through the Vertical Pack.

## 2. B1 State (recap)
`public.client_archetypes.type` is `text`, nullable, no default. Physical enum `public.client_type` retained (zero column consumers) for rollback only. 10 rows, all Events values, zero NULLs.

## 3. Preflight
- DB re-check: `client_archetypes.type = text`. Distinct values still `{Organizador, Expositor, Agência, Empresa Contratante}`.
- No non-Events writes since B1.
- Consumer scan (Events literals): only Events Pack, ArchetypeModal (UI), types.ts (generated), docs, tests. No other Core runtime hardcodes.
- Baseline: 20/20 VERT-01.4A tests green pre-change.

Decision: `VERT-01.4B2 PREFLIGHT READY`.

## 4. Service — before
`src/services/roleplay/archetypes.ts` — `Archetype.type` = union of the four Events values.

## 5. Service — after
`type: ClientArchetypeType` imported from `@/roleplay/archetypes`. Service is Pack-agnostic: does NOT import `@/vertical-packs/**`. CRUD, table, queries, organization scope, RLS dependency: unchanged.

## 6. Schema — before
`src/schemas/roleplay.ts` — `type: z.enum(EVENTS_ARCHETYPE_TYPES)` sourced from the Events Pack.

## 7. Schema — after
`type: clientArchetypeTypeSchema` from Core. `level`, `tone_style`, `decision_role`, `complexity_score`, `min_message_exchanges`, `objection_set` and `name` unchanged (their enums remain enforced by DB enums pending their own extraction).

## 8. ClientArchetypeType
`type ClientArchetypeType = string` (Core). No knowledge of Pack values.

## 9. Events default composition
Events Vertical Pack (`src/vertical-packs/events/roleplay/`) remains the canonical source of the four defaults and of `eventsArchetypeSchema`.

## 10. UI options
`src/components/roleplay/admin/ArchetypeModal.tsx` renders `EVENTS_ARCHETYPE_TYPE_OPTIONS.map(...)` — no inline Events literals. Order/labels preserved.

## 11. Unknown existing value preservation
If a loaded archetype has a `type` that fails `isEventsArchetypeType`, the modal appends a temporary `<current>` option labelled `(tipo existente)` so editing preserves the value instead of silently discarding it or defaulting to the first Events option.

## 12. Non-Events synthetic proof (mocked)
`archetypeSchema` accepts `Diretor de TI`, `Comprador Técnico`, `CFO`. Bounds enforced (empty/1-char/>60 rejected; trim applied). See `runtimeActivation.test.ts`.

## 13. Events strict schema
`eventsArchetypeSchema` still rejects `Diretor de TI` and still accepts the four canonical Events values. Pack-level strictness preserved.

## 14. DB unchanged
Zero migrations, zero writes, zero row changes.

## 15. Physical enum residual
`public.client_type` retained. Zero column consumers. Kept solely for rollback posture.

## 16. Rollback posture
Code-level rollback = revert `src/services/roleplay/archetypes.ts`, `src/schemas/roleplay.ts`, `ArchetypeModal.tsx`. DB unaffected. Once a non-Events row is persisted, DB `text → enum` rollback requires prior verification that all rows fit the four Events values.

## 17. Tests
- `src/roleplay/archetypes/__tests__/archetypes.test.ts` — 20 (updated Events-value regression, kept factory & Pack canonicity).
- `src/roleplay/archetypes/__tests__/runtimeActivation.test.ts` — 20 new (generic acceptance, bounds, trim, enum preservation for other fields, Events strict isolation).

## 18. Regression
40/40 Roleplay archetype tests pass. Typecheck clean. No DB migration, no publish.

## 19. HC-004 → `RESOLVED_GENERIC_ARCHETYPE_TYPE`
Service field `type` is `ClientArchetypeType`, no Events union.

## 20. HC-005 → `RESOLVED_GENERIC_ARCHETYPE_SCHEMA`
Runtime schema uses `clientArchetypeTypeSchema`; Events strictness confined to `eventsArchetypeSchema` inside the Pack.

## 21. HC-018 → `LEGACY_DB_ENUM_RETAINED_UNUSED`
Physical enum retained for rollback only. Zero column consumers.

## 22. Next gate
Trigger Gate 1 forensic reassessment (see `vertical-readiness-gate1-closeout-v1.md`).
