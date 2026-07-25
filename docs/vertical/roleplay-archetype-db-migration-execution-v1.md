# Roleplay Archetype — DB Migration Execution (v1)

**Change ID:** `NOID-VERTICAL-1.0-VERT-01.4B1`
**Classification:** YELLOW — DATABASE SCHEMA CHANGE (executed)
**Decision:** `VERT-01.4B1 VALIDATED — CLIENT_ARCHETYPES.TYPE MIGRATED TO TEXT`
**Qualification:** `RUNTIME REMAINS EVENTS-CONSTRAINED`

## 1. Change ID
`NOID-VERTICAL-1.0-VERT-01.4B1`.

## 2. Preflight decision
GO. Re-audit immediately before execution reproduced B0 exactly.

## 3. Timestamp / migration file
Timestamp: `20260725-194808` (per Supabase migration runner).
Applied migration: single-file forward SQL described in §5.

## 4. Baseline (pré-migration)
| Metric | Value |
| --- | --- |
| `udt_name` | `client_type` |
| `is_nullable` | `YES` |
| `column_default` | `NULL` |
| Total rows | 10 |
| Null count | 0 |
| Distribution | Agência=2, Empresa Contratante=2, Expositor=3, Organizador=3 |
| Checksum `md5(id\|type)` | `5ac79445b4b6044901abcf29b75deea2` |
| Policies on `client_archetypes` | 2 (`Admins can manage archetypes`, `Users can view archetypes in their org`) |
| RLS enabled | `true` |
| Consumers of `public.client_type` | 1 column (`public.client_archetypes.type`) |
| Enum labels | `Organizador`, `Expositor`, `Agência`, `Empresa Contratante` |

## 5. Migration applied (forward SQL)
```sql
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

ALTER TABLE public.client_archetypes
  ALTER COLUMN type TYPE text
  USING type::text;

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
```

## 6-10. Column contract & data parity
| Aspect | Before | After |
| --- | --- | --- |
| `udt_name` | `client_type` | `text` |
| `is_nullable` | `YES` | `YES` |
| `column_default` | `NULL` | `NULL` |
| Total rows | 10 | 10 |
| Null count | 0 | 0 |
| Distribution | Agência=2, Empresa Contratante=2, Expositor=3, Organizador=3 | **identical** |

## 11. Checksum parity
`md5(id + '|' + type)` before = after = **`5ac79445b4b6044901abcf29b75deea2`**. Zero rows semantically rewritten.

## 12. Enum retention
`public.client_type` intentionally kept. Labels unchanged (Organizador/Expositor/Agência/Empresa Contratante). No `DROP TYPE`, no `ALTER TYPE`.

## 13. `client_type` column consumers post-B1
**Zero.** `pg_attribute` scan for `atttypid='public.client_type'::regtype` returns no rows. Enum is now an orphan physical artefact by design (rollback safety).

## 14. RLS parity
`pg_class.relrowsecurity` = `true` (unchanged).

## 15. Policies parity
| Policy | Command | USING | WITH CHECK |
| --- | --- | --- | --- |
| `Admins can manage archetypes` | ALL | `user_is_org_admin(organization_id)` | `user_is_org_admin(organization_id)` |
| `Users can view archetypes in their org` | SELECT | `user_is_org_member(organization_id)` | — |

Definitions byte-identical to baseline. No policy added or removed.

## 16. Read-only application smoke
`listArchetypes` continues to compile against `client_archetypes.Row.type: string | null`; PostgREST reads under RLS remain functional; no cast errors observed. No synthetic row was created, updated, or deleted.

## 17. Generated Supabase types
Regenerated automatically by the platform after migration approval:
- `Database.public.Tables.client_archetypes.Row.type` — before: `Database["public"]["Enums"]["client_type"] | null`; **after: `string | null`**.
- Same transition for `Insert` and `Update`.
- `Database.public.Enums.client_type` remains listed (physical enum preserved). Acceptable.

## 18. Runtime service unchanged
`src/services/roleplay/archetypes.ts` still declares `type: 'Organizador' | 'Expositor' | 'Agência' | 'Empresa Contratante'`. No code edit.

## 19. Runtime schema unchanged
`src/schemas/roleplay.ts` still validates `type` against `EVENTS_ARCHETYPE_TYPES` (imported from the Events Pack). No code edit.

## 20. Tests
`bunx vitest run src/roleplay/archetypes` → **20 / 20 passed**. The full 01.4A regression set is green.

## 21. Typecheck
`bunx tsgo --noEmit -p tsconfig.app.json` → clean (no diagnostics).

## 22. Build
Build pipeline runs automatically in the harness after code changes; no manual invocation needed. Runtime files were not modified in this sprint, so no build regression is possible from B1's code diff (which is limited to auto-generated `types.ts` + docs).

## 23. Files touched
- `supabase/migrations/<timestamp>_vert_01_4b1_client_archetypes_type_enum_to_text.sql` (created via migration tool).
- `src/integrations/supabase/types.ts` (regenerated automatically — `client_archetypes.type` becomes `string | null`).
- `docs/vertical/roleplay-archetype-db-migration-execution-v1.md` (this file).
- `docs/vertical/roleplay-archetype-db-migration-readiness-v1.md` (chronological addendum).

Explicitly NOT touched: `src/services/roleplay/*`, `src/schemas/roleplay.ts`, Roleplay UI, Events Pack, Core Roleplay foundation, Academy, AI prompts, Edge Functions, RLS, policies, RPC, storage, auth, other schemas, Pack Engine.

## 24. Exact DB changes
- `public.client_archetypes.type`: `client_type` → `text` (values unchanged, nullability unchanged, default unchanged).
- Nothing else changed. Enum retained. No CASCADE, no DROP, no policy edit, no trigger, no function.

## 25. Synthetic data
None. Zero rows inserted, updated, or deleted. All validation was `SELECT`-only.

## 26. Rollback status
**Not executed.** Rollback SQL remains ready and safe (guard + `ALTER COLUMN type TYPE public.client_type USING type::public.client_type`). Because the runtime is still Events-constrained (§18, §19), no non-Events value can be persisted between forward and any hypothetical rollback, so the reverse cast is guaranteed.

## 27. HC-004
Unchanged: `EVENTS_PACK_FOUNDATION_READY_LEGACY_RUNTIME` → recommended reclassification: **`DB_UNLOCKED_EVENTS_RUNTIME_PENDING`**. Physical restriction removed; runtime still Events-only.

## 28. HC-005
Unchanged: `GENERIC_SCHEMA_FOUNDATION_READY_LEGACY_RUNTIME` → recommended reclassification: **`DB_UNLOCKED_GENERIC_SCHEMA_RUNTIME_PENDING`**. Runtime schema unchanged; generic factory awaits B2.

## 29. HC-018
Recommended reclassification: **`LEGACY_DB_ENUM_RETAINED_FOR_ROLLBACK`** (enum exists, zero consumers, retained intentionally). Not marked RESOLVED while enum exists.

## 30. Publish
Not executed. No publish, no deploy triggered by this sprint.

## 31. Readiness for B2
GO. Physical constraint removed; DB accepts arbitrary text for `type`. B2 may now:
1. Swap `Archetype.type` from the Events union to `ClientArchetypeType` in `src/services/roleplay/archetypes.ts`.
2. Point `archetypeSchema` at `createArchetypeSchema({ allowedTypes: … })` composed by the host.
3. Keep Events Pack as default composition; UI options continue to source from the Pack.
4. Add authorised synthetic test for a non-Events value.
5. Reclassify HC-004 / HC-005.

## Residual risks
- `public.client_type` remains orphan; harmless until a future cleanup sprint decides to drop it.
- Runtime schema/service still hard-codes the four Events labels (by design). B2 addresses this.
- Baseline linter warnings surfaced by the platform after migration are pre-existing (SECURITY DEFINER functions, extensions in public) and unrelated to B1's diff.

## Rollback SQL (documented, not executed)
```sql
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
```

## Rollback triggers (would justify running the SQL above)
- Column did not become `text`.
- Any row value altered.
- Row count changed unexpectedly during migration.
- Checksum divergence.
- RLS/policy change caused by the ALTER.
- `listArchetypes` broken by the migration.
- PostgREST or Supabase client began failing on `type`.
- Cast error directly caused by the migration.
- Generated types blocked the build with no safe regeneration path.

None of these were triggered. **Do not execute rollback.**
