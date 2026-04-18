

## Sprint 2.3 — Histórico Real de Estágio, Qualificação e Ownership

### Auditoria rápida do schema (preciso confirmar antes do plano final)
<lov-tool-use id="toolu_vrtx_013GVBtMqiDJt3gbE6Dp9jTp" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name IN ('id','organization_id','pipeline_id','stage_id','owner_user_id','qualified_by_user_id','qualified_at','created_at') ORDER BY column_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_018HrRAkc2Us9Va87zSTUfp6" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_schema='public' AND table_name='opportunities' AND column_name IN ('id','organization_id','pipeline_id','stage_id','owner_user_id','qualified_by_user_id','qualified_at','created_at','updated_at') ORDER BY column_name;\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01FpWe1Nf3yLGFdvG7kjqT6k" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('opportunity_stage_history','opportunity_owner_history','opportunity_qualification_history','timeline_events','activities','audit_logs','stages','pipelines');\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_015whKpaqxQRBwoRRv4zF6dD" name="supabase--read_query" integration-id="supabase" data="{\"query\": \"SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('stages','pipelines') AND column_name='id' ORDER BY table_name;\"}">
</lov-tool-use>
Schema confirmado. `pipeline_id` e `stage_id` são `text`, `qualified_at` existe. Nenhuma das 3 tabelas históricas existe. Pronto pro plano.

<lov-plan>

## Sprint 2.3 — Histórico Real de Estágio, Owner e Qualificação

### Schema confirmado
- `opportunities.stage_id` e `pipeline_id` são `text` (não uuid) — ajusto FKs
- `qualified_at` existe ✅
- Nenhuma das 3 tabelas históricas existe — partida limpa
- `timeline_events` e `activities` existem (avaliados como fonte opcional, mas não vou importar — risco de duplicação/invenção)

### Plano de execução

**FASE 1 — Migration única (DDL aditivo):**

1. **3 tabelas** com FKs corretas (`text` p/ pipeline/stage), RLS habilitado + policy "tenant isolation via organization_id" (SELECT por membros da org, INSERT/UPDATE só via trigger SECURITY DEFINER) + 7 índices conforme spec.

2. **3 trigger functions** com `SECURITY DEFINER` + `SET search_path = public`:
   - `track_opportunity_stage_history()` — INSERT (initial) + UPDATE quando `stage_id` muda
   - `track_opportunity_owner_history()` — INSERT (initial se owner) + UPDATE quando `owner_user_id` muda
   - `track_opportunity_qualification_history()` — INSERT/UPDATE quando `qualified_at` ou `qualified_by_user_id` saem de NULL → preenchido (idempotente, sem duplicar)
   - `changed_by_user_id = auth.uid()` (NULL se sistema)

3. **3 triggers AFTER INSERT OR UPDATE** em `public.opportunities`.

4. **Backfill conservador** (single migration, idempotente):
   - Stage: `INSERT ... source='backfill_initial_stage'` p/ oportunidades sem histórico, usando `created_at` como `changed_at` (evento inicial só, zero invenção de transições)
   - Owner: idem, source `backfill_initial_owner`, somente se `owner_user_id IS NOT NULL`
   - Qualification: source `backfill_explicit_qualification`, **somente** quando `qualified_at IS NOT NULL` (jamais usar `created_at` como proxy)

5. **6 views** (todas `security_invoker=true`):
   - `v_opportunity_current_stage_entry_v2` — DISTINCT ON por `opportunity_id` ORDER BY `changed_at DESC`
   - `v_opportunity_stage_age_v2` — JOIN com `v_opportunities_hygiene_base`, expõe `hours_in_current_stage`, `days_in_current_stage`
   - `v_opportunity_first_owner_v2` — DISTINCT ON ORDER BY `changed_at ASC`
   - `v_opportunity_current_owner_v2` — DISTINCT ON ORDER BY `changed_at DESC`
   - `v_opportunity_first_qualification_v2` — DISTINCT ON ORDER BY `qualification_at ASC`
   - `v_opportunity_history_coverage_v2` — agregação por org com 3 percentuais de cobertura

**FASE 2 — Frontend (8 arquivos novos, zero edição em telas):**

1. `src/types/historyV2.ts` — interfaces `StageHistoryEntry`, `OwnerHistoryEntry`, `QualificationHistoryEntry`, `StageAgeV2`, `HistoryCoverageV2`
2. `src/lib/reports/stageHistory.ts` — helpers `formatStageAge(days)`, `getStageAgeBadgeVariant(days)`
3. `src/lib/reports/ownerHistory.ts` — helpers `getOwnerChangeLabel(source)`
4. `src/lib/reports/qualificationHistory.ts` — helpers `formatTimeToQualification(hours)`
5. `src/lib/reports/historyCoverage.ts` — `getHistoryCoverageLabel(pct)` (Excelente/Bom/Parcial/Insuficiente)
6. `src/hooks/useHistoryCoverageV2.ts` — React Query, lê `v_opportunity_history_coverage_v2`
7. `src/hooks/useOpportunityStageAgeV2.ts` — aceita `opportunityId` opcional, lê `v_opportunity_stage_age_v2`
8. `src/hooks/useOpportunityFirstQualificationV2.ts` — lê `v_opportunity_first_qualification_v2`

**FASE 3 — Atualizar `reportsAuditStatus.ts`:**
Adicionar `REPORTS_HISTORY_LAYER` mapeando quais relatórios podem migrar agora (Conversão, Estágios, Balanceamento, Handoff, SDR temporal) vs. quais ainda precisam de mais sprints.

**FASE 4 — Artifact `relatorios-v2-sprint2.3-checklist.md`:**
Mapa de cobertura inicial esperada (oportunidades novas = 100%, antigas = depende do backfill conservador).

### Decisões técnicas

- **`SECURITY DEFINER` + `SET search_path = public`** em todas as trigger functions (padrão de segurança do projeto)
- **RLS nas tabelas históricas**: SELECT permitido p/ membros da org via `has_organization_access()`, INSERT/UPDATE/DELETE bloqueado p/ usuários (só triggers escrevem)
- **Idempotência da qualificação**: trigger usa `IS DISTINCT FROM` + cláusula NOT EXISTS p/ não duplicar evento se update irrelevante
- **Sem import de `timeline_events`/`activities`**: spec permite "opcional com evidência clara" — opto por NÃO importar (risco de invenção). Histórico real começa do zero p/ deals antigos, com evento inicial de backfill apenas
- **`DISTINCT ON`** em todas as views (consistente com Sprint 2.2)
- **`hours_in_current_stage` calculada via `EXTRACT(EPOCH FROM ...)/3600`** (numeric, não int)

### Critérios de aceite (mapeamento)

| # | Como atende |
|---|---|
| 1 | FASE 1.1 — 3 tabelas |
| 2 | FASE 1.2-3 — triggers AFTER INSERT/UPDATE |
| 3 | FASE 1.4 — backfill só com evidência (qualified_at explícito) |
| 4 | FASE 1.5 — `v_opportunity_stage_age_v2` |
| 5 | FASE 1.5 — `v_opportunity_history_coverage_v2` |
| 6 | Triggers ativos a partir desta migration |
| 7 | Views de owner + qualification disponíveis |
| 8 | `v_opportunity_first_qualification_v2` + cálculo via diferença com `created_at` |
| 9 | Hooks novos prontos p/ substituir placeholders na Sprint 6 |
| 10 | Tudo aditivo, zero edição de Sprint 2.1/2.2 |

### Fora de escopo

- ❌ Refator de telas (Sprint 6)
- ❌ Edge functions (Sprint 5)
- ❌ Import de `timeline_events`/`activities` (alto risco de invenção)
- ❌ Backfill de qualificação via `created_at` (proibido pela spec)

### Risco

Baixo. DDL puramente aditivo + 8 arquivos novos. Triggers só inserem em tabelas novas — zero impacto no fluxo de UPDATE de oportunidades existente.

### Tempo estimado

~30 min. 1 migration grande + 8 arquivos frontend + 1 artifact.

