# Roleplay Archetype — DB Migration Readiness (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.4B0`
**Classification:** GREEN / READ-ONLY. Zero DB writes. Zero migrations. Zero publish.
**Decision:** `VERT-01.4B0 VALIDATED — ARCHETYPE ENUM MIGRATION READY`
**Chronological note:** `VERT-01.4B1 executed and validated` — see `roleplay-archetype-db-migration-execution-v1.md`.

---

## 1. Context

VERT-01.4A shipped the generic Core contract (`src/roleplay/archetypes/`) and the
Events Vertical Pack (`src/vertical-packs/events/roleplay/`), but runtime remains
Events-constrained because `public.client_archetypes.type` is physically typed as
the Postgres enum `public.client_type`. HC-004, HC-005 and HC-018 are all blocked
on this single physical constraint. B0 verifies whether a minimal `enum → text`
column migration is safe to execute in isolation (B1) without any runtime change.

## 2. Change ID

`NOID-VERTICAL-1.0-VERT-01.4B0` (read-only audit + B1 plan).

## 3. Enum audit — `public.client_type`

| Attribute | Value |
| --- | --- |
| OID | 20658 |
| Schema | `public` |
| Name | `client_type` |
| Kind | ENUM |
| Labels (in order) | `Organizador` (1), `Expositor` (2), `Agência` (3), `Empresa Contratante` (4) |
| Array type (`_client_type`) | 20657 |

## 4. Enum labels

`{Organizador, Expositor, Agência, Empresa Contratante}` — unchanged since seed.

## 5. Consumer columns

Exactly **one** column in the entire database uses `public.client_type`:

| Schema | Table | Column | NOT NULL | Default |
| --- | --- | --- | --- | --- |
| `public` | `client_archetypes` | `type` | false | (none) |

`pg_depend` confirms only three edges: the schema owner, the array type, and
`public.client_archetypes.type` (attnum 4, class oid 20768). No other table,
function, view, or index depends on the enum.

## 6. `client_archetypes.type` column contract

| Property | Value |
| --- | --- |
| `data_type` | `USER-DEFINED` |
| `udt_name` | `client_type` |
| `is_nullable` | `YES` |
| `column_default` | `NULL` |
| `is_generated` | `NEVER` |
| `is_identity` | `NO` |
| `collation_name` | `NULL` |
| Indexes on column | none (only `client_archetypes_pkey` on `id`) |
| Constraints referencing column | none (CHECK is on `complexity_score`; FK is on `organization_id`) |
| Foreign keys on column | none |

## 7. Row aggregates

| Metric | Value |
| --- | --- |
| Total rows | 10 |
| `type IS NULL` | 0 |
| Distinct non-null types | 4 |

## 8. Distribution by type

| Type | Count |
| --- | --- |
| `Expositor` | 3 |
| `Organizador` | 3 |
| `Empresa Contratante` | 2 |
| `Agência` | 2 |

Only the four canonical Events labels are present. Zero rogue values, zero NULLs.

## 9. SQL dependency graph

| Object | Result | Classification |
| --- | --- | --- |
| Views (`pg_views` scan, all schemas ex-catalog) referencing `client_type` or `client_archetypes` | none | SAFE_NO_CHANGE |
| Materialized views | none | SAFE_NO_CHANGE |
| Functions/procedures whose body matches `client_type\|client_archetypes` (`prokind='f'`, def scan) | none | SAFE_NO_CHANGE |
| Functions with argument or return type `client_type` | none | SAFE_NO_CHANGE |
| Triggers on `client_archetypes` (non-internal) | none | SAFE_NO_CHANGE |
| Policies on `client_archetypes` | 2 (`Admins can manage archetypes`, `Users can view archetypes in their org`) — both scope on `organization_id`, no reference to `type` | SAFE_NO_CHANGE |
| CHECK constraints referencing `type` | none | SAFE_NO_CHANGE |
| Casts `::client_type` at runtime | none (only in historical seed migration) | LEGACY_ONLY |

Conclusion: `ALTER COLUMN type TYPE text USING type::text` will not require
`CASCADE`, will not drop any dependent object, and does not touch RLS.

## 10. Code dependencies

| Path | Classification |
| --- | --- |
| `src/roleplay/archetypes/{types,schema}.ts` | CORE_RUNTIME (already generic) |
| `src/vertical-packs/events/roleplay/archetypeTypes.ts` | EVENTS_PACK (authoritative literals) |
| `src/schemas/roleplay.ts` | LEGACY_RUNTIME (enforces Events set via `EVENTS_ARCHETYPE_TYPES`) |
| `src/services/roleplay/archetypes.ts` | LEGACY_RUNTIME (TS union restricts `type` to Events set) |
| `src/services/roleplay/{sessions,sellers}.ts`, `src/pages/roleplay/*` | LEGACY_RUNTIME (reads only) |
| `src/integrations/supabase/types.ts` | GENERATED_TYPES (`Database.public.Enums.client_type`, row `type: Enums['client_type'] \| null`) |
| `supabase/functions/performance-engine/index.ts` | LEGACY_RUNTIME (reads `client_archetypes(complexity_score)` — does not touch `type`) |
| `supabase/migrations/20251026195900_*.sql`, `database/dumps/**`, `database/schema_export.sql`, `database/full_noid_export.sql`, `public/dumps/database_schema.sql`, `TECHNICAL_DOCUMENTATION.md` | MIGRATION_HISTORY / DOCUMENTATION |
| `docs/vertical/roleplay-archetype-decoupling-foundation-v1.md`, this file | DOCUMENTATION |

No CORE_RUNTIME consumer reads or writes `client_type` values today.

## 11. HC-018 analysis

1. HC-018 is **only** the TypeScript reflection of `public.client_type` inside
   `src/integrations/supabase/types.ts` (`Enums.client_type` + the `type` field
   on `client_archetypes` rows). It has no independent source.
2. No second column uses this enum (see §5).
3. No other enum in the DB contains the label `Expositor` — enum audit shows
   `client_type` is the only owner (siblings `archetype_level_type`,
   `tone_style_type`, `decision_role_type` cover unrelated fields).
4. After B1 (`type` becomes `text`), the enum `public.client_type` will exist in
   the DB with zero column users. The generated TypeScript will regenerate
   `client_archetypes.type` as `string | null`; `Enums.client_type` may remain
   listed while the physical type is retained (see §14, §19). HC-018 stays open
   as a physical, non-functional legacy artifact until an explicit cleanup
   sprint decides to drop the enum.

HC-018 is **not** modified in B0.

## 12. Forward migration draft (B1 — NOT EXECUTED)

Single-column, single-transaction, no CASCADE, no DROP, no data touched.

```sql
BEGIN;

-- Pre-assertions (fail fast, abort the transaction on any drift):
DO $$
DECLARE
  v_udt text;
  v_rogue integer;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'client_archetypes'
    AND column_name = 'type';
  IF v_udt IS DISTINCT FROM 'client_type' THEN
    RAISE EXCEPTION 'VERT-01.4B1 aborted: client_archetypes.type is not client_type (got %)', v_udt;
  END IF;

  SELECT count(*) INTO v_rogue
  FROM public.client_archetypes
  WHERE type IS NOT NULL
    AND type::text NOT IN ('Organizador','Expositor','Agência','Empresa Contratante');
  IF v_rogue > 0 THEN
    RAISE EXCEPTION 'VERT-01.4B1 aborted: % rows with unexpected type values', v_rogue;
  END IF;
END $$;

-- Enum → text. No default, no NOT NULL change, no CASCADE.
ALTER TABLE public.client_archetypes
  ALTER COLUMN type TYPE text
  USING type::text;

-- Post-condition checks:
DO $$
DECLARE
  v_udt text;
BEGIN
  SELECT udt_name INTO v_udt
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'client_archetypes'
    AND column_name = 'type';
  IF v_udt IS DISTINCT FROM 'text' THEN
    RAISE EXCEPTION 'VERT-01.4B1 aborted: post-condition failed (udt=%)', v_udt;
  END IF;
END $$;

COMMIT;
```

Notes:
- `public.client_type` is **retained** (not dropped) — see §14.
- RLS, policies, indexes, FK, CHECK, and defaults are untouched.
- Statement runs inside a single transaction; failure rolls back cleanly.

## 13. Rollback migration draft

```sql
BEGIN;

-- Pre-assertion: every non-null value must be a valid client_type label.
DO $$
DECLARE
  v_rogue integer;
BEGIN
  SELECT count(*) INTO v_rogue
  FROM public.client_archetypes
  WHERE type IS NOT NULL
    AND type NOT IN ('Organizador','Expositor','Agência','Empresa Contratante');
  IF v_rogue > 0 THEN
    RAISE EXCEPTION 'VERT-01.4B1 rollback aborted: % rows outside client_type labels', v_rogue;
  END IF;
END $$;

ALTER TABLE public.client_archetypes
  ALTER COLUMN type TYPE public.client_type
  USING type::public.client_type;

COMMIT;
```

## 14. Rollback safety

- The enum `public.client_type` is intentionally **not dropped** by B1, so the
  cast target still exists at rollback time.
- Between B1 forward and any rollback, runtime remains Events-constrained
  (`src/schemas/roleplay.ts` still validates against `EVENTS_ARCHETYPE_TYPES`
  and `src/services/roleplay/archetypes.ts` still types `type` as the four
  Events literals). Therefore no non-Events value can be persisted; the
  rollback cast is guaranteed to succeed under B1's runtime contract.
- Rollback is a single `ALTER COLUMN` inside a transaction with a guard.

## 15. Enum retention

`public.client_type` stays after B1 for two reasons:
1. **Rollback simplicity** — the cast target must exist.
2. **Blast-radius minimization** — dropping the enum has zero functional
   benefit in a single-project prod+dev environment and would eliminate the
   rollback path.

A future cleanup sprint may drop the enum (and close HC-018 as
`LEGACY_DB_ENUM_UNUSED`) once B2 has stabilised and rollback is no longer
needed.

## 16. Lookup table deferral

No `client_archetype_types` (or equivalent) table will be created in B1.
Per-tenant / per-pack allowed value sets belong to the future Tenant
Configuration Layer / Vertical Pack Engine (VERT-04 / VERT-05). Until then,
the Events Pack keeps supplying the four defaults to the composition host and
the Core remains generically capable of accepting any string.

## 17. Smoke plan (executed immediately after B1)

Read-only checks, no writes:

1. `information_schema.columns.udt_name` for `client_archetypes.type` = `text`.
2. `is_nullable = 'YES'` (unchanged).
3. `column_default IS NULL` (unchanged).
4. `SELECT count(*)` = 10 (unchanged; compare to §7).
5. `count(*) FILTER (WHERE type IS NULL)` = 0 (unchanged).
6. `count(*) GROUP BY type` matches §8 exactly.
7. No row values altered (checksum: sorted list of `(id, type)` unchanged).
8. All four historical labels still present.
9. `listArchetypes(organization_id)` returns identical rows for at least one
   tenant fixture (read via the app).
10. Tenant-scoped RLS still enforced (policy count on `client_archetypes` = 2).
11. Post-regeneration, an Events-typed `createArchetype` still succeeds — only
    validated in an authorised environment; not part of B0.
12. `updateArchetype` with an Events-typed value idem.
13. No policy on `client_archetypes` altered (compare `pg_policy` snapshot).
14. `pg_policy` count and definitions identical.
15. Typecheck + build green after Supabase types regeneration, if the normal
    workflow regenerates them.

B0 documents these; execution belongs to B1.

## 18. GO conditions

All must hold:

- Exactly one column consumes `client_type` (§5). ✅
- No functions / views / triggers / policies / indexes / constraints reference
  `client_type` or `client_archetypes.type` in a way that blocks the ALTER (§9). ✅
- Every non-null row value is inside the enum label set (§7, §8). ✅
- Forward SQL runs in a single transaction (§12). ✅
- Rollback SQL runs in a single transaction with a value guard (§13). ✅
- `DROP TYPE` is not required (§15). ✅
- Lookup table explicitly deferred (§16). ✅
- B1 can be executed as an isolated migration (§20). ✅
- B1 requires zero runtime code change (§20). ✅
- Smoke plan defined (§17). ✅

## 19. NO-GO conditions (none tripped)

B1 must be aborted if any of the following becomes true before execution:

- Another column starts using `client_type` without a plan.
- A function/procedure with `client_type` parameter is introduced.
- A view/policy/trigger/constraint gains a dependency on the column.
- A row value outside the enum labels is discovered.
- Row count drifts between audit and execution beyond expected app writes.
- Rollback is proven unsafe (e.g. enum dropped, rogue values written).
- The ALTER requires `DROP TYPE ... CASCADE` to succeed.
- The ALTER requires modifying RLS or any policy.
- The migration must couple multiple domains.

## 20. B1 scope (isolated migration)

- One migration file (`ALTER COLUMN type TYPE text USING type::text` with
  pre/post guards).
- Regenerated `src/integrations/supabase/types.ts` if the normal workflow
  triggers regeneration; expected diff:
  - `client_archetypes.Row.type` transitions from
    `Database["public"]["Enums"]["client_type"] | null` to `string | null`
    (same for Insert/Update).
  - `Database.public.Enums.client_type` may remain listed because the physical
    enum is retained; that is acceptable.
- Documentation and smoke evidence.
- **Must not** touch: `src/services/roleplay/*`, `src/schemas/roleplay.ts`,
  Roleplay UI, Events Pack, Academy, or AI prompts.

## 21. B2 scope (future)

Only after B1 is validated:

1. Swap `Archetype.type` in `src/services/roleplay/archetypes.ts` from the
   Events union to `ClientArchetypeType`.
2. Point `archetypeSchema` at `createArchetypeSchema({ allowedTypes: … })` with
   the allowed set injected by the composition host.
3. The Events composition host initially keeps `EVENTS_ARCHETYPE_TYPES`.
4. UI options continue to be sourced from the Events Pack (already true).
5. Core stops carrying any Events literal.
6. Introduce a synthetic non-Events type test only inside an authorised
   composition/config context.
7. Reclassify HC-004 / HC-005.
8. HC-018 becomes a purely physical legacy artifact.
9. Gate 1 closeout.

B2 is **not** started here.

## 22. Hardcode Register (unchanged in B0)

- HC-004 → `EVENTS_PACK_FOUNDATION_READY_LEGACY_RUNTIME`
- HC-005 → `GENERIC_SCHEMA_FOUNDATION_READY_LEGACY_RUNTIME`
- HC-018 → `LINKED_TO_HC-004/005_PENDING_DB_MIGRATION` (B0 evidence: enum has
  a single column consumer; migration plan approved).

## 23. DB untouched

No `ALTER`, `CREATE`, `DROP`, `INSERT`, `UPDATE`, `DELETE`, seed, publish, or
migration executed. All evidence gathered via `SELECT` and `information_schema`
/ `pg_catalog` reads.

## 24. Recommendation

Proceed to **`VERT-01.4B1 — MIGRATE CLIENT_ARCHETYPES.TYPE FROM ENUM TO TEXT`**
using the SQL in §12, retaining `public.client_type`, executing the smoke plan
in §17 immediately after, and keeping runtime Events-constrained until B2.
