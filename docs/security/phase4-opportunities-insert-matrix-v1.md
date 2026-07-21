# Fase 4 — Matriz completa de INSERT básico em `public.opportunities`

**Sprint:** NOID-SECURITY 1.2
**Mudança:** NSEC-1.2-CHG-016
**Data (UTC):** 2026-07-21
**Classificação:** AMARELA controlada — probes reversíveis + cleanup de RPC temporária
**Decisão final:** **OPPORTUNITIES INSERT BÁSICO HOMOLOGADO**

---

## 1. Contexto

Consolidação da homologação de INSERT básico em `public.opportunities` após:

- **CHG-013:** canary mínima (detectou SEC-013/014/015).
- **CHG-014:** policy restritiva `nsec12_opportunities_insert_block_viewer` — SEC-013 RESOLVED.
- **CHG-015:** policy restritiva `nsec12_opportunities_insert_tenant_relations_guard` — SEC-014 e SEC-015 RESOLVED.

Esta mudança completa a matriz de papéis para o **INSERT básico** — sem `account_id`, sem `contact_id`, sem propostas, sem qualificação, sem fechamento — e remove a RPC canary após aprovação total.

## 2. Policies ativas em `public.opportunities` (baseline pré/pós idêntico)

Total: **8 policies** (6 permissivas + 2 restritivas).

| # | Nome | Kind | Cmd |
|---|---|---|---|
| 1 | `Admins and managers can delete org opportunities` | permissive | DELETE |
| 2 | `Org members can insert opportunities` | permissive | INSERT |
| 3 | `Org members insert opportunities` | permissive | INSERT |
| 4 | `Org members update opportunities` | permissive | UPDATE |
| 5 | `Users can insert org opportunities` | permissive | INSERT |
| 6 | `opportunities_select_by_visibility` | permissive | SELECT |
| 7 | `nsec12_opportunities_insert_block_viewer` | **RESTRICTIVE** | INSERT |
| 8 | `nsec12_opportunities_insert_tenant_relations_guard` | **RESTRICTIVE** | INSERT |

Nenhuma policy foi alterada nesta mudança. Nenhum trigger foi alterado.

## 3. Estado da RPC temporária (antes → depois)

**Antes (pre-flight):**
- `public.nsec12_probe_insert_opportunity(text, text, text, text)`
- `prosecdef = false` (SECURITY INVOKER)
- `search_path = public`
- Payload interno fixo: `status='new'`, `automation_enabled=false`, `account_id=NULL`, `contact_id=NULL`, `owner_user_id=auth.uid()`, todos os relacionais opcionais `NULL`.
- Whitelist: apenas 12 UUIDs de usuários sintéticos + 2 orgs sintéticas + 2 pipelines + 2 stages.
- Rollback interno via `RAISE EXCEPTION 'NSEC12_ROLLBACK'`.
- Prefixo de título obrigatório: `SECURITY_TEST_OPPORTUNITY_CANARY_`.

**Depois (cleanup CHG-016):**
- Migration aplicada com `REVOKE ALL … + DROP FUNCTION IF EXISTS`.
- `pg_proc` retorna **0 funções** com esse nome/assinatura.
- Nenhum grant residual.
- Nenhuma referência no frontend ou em Edge Functions de produto (`rg` limpo).

## 4. Metodologia dos probes

- **Transporte:** PostgREST + JWT sintético real (via `nsec12-provision-fixtures` action `issueToken`).
- **Nunca:** service role no `Authorization`.
- **Prefixo dos títulos:** `SECURITY_TEST_OPPORTUNITY_CANARY_MATRIX_*` (mantém prefixo `CANARY_` exigido pela RPC + tag `MATRIX_` para audit trail).
- **Total autorizado:** 30 probes via RPC + 2 INSERTs diretos (organization_id NULL) = **32 probes**.

## 5. Bloco 1 — Matriz same-org (12 probes)

Payload: `org_id = ator`, `pipeline_id = pipeline do ator`, `stage_id = stage do ator`.

| # | Ator | Resultado | Esperado |
|---|---|---|---|
| P01 | A_owner   | `ALLOWED_ROLLED_BACK` | ✅ |
| P02 | A_admin   | `ALLOWED_ROLLED_BACK` | ✅ |
| P03 | A_manager | `ALLOWED_ROLLED_BACK` | ✅ |
| P04 | A_sales   | `ALLOWED_ROLLED_BACK` | ✅ |
| P05 | A_viewer  | `BLOCKED_RLS`         | ✅ |
| P06 | A_cs      | `ALLOWED_ROLLED_BACK` | ✅ |
| P07 | B_owner   | `ALLOWED_ROLLED_BACK` | ✅ |
| P08 | B_admin   | `ALLOWED_ROLLED_BACK` | ✅ |
| P09 | B_manager | `ALLOWED_ROLLED_BACK` | ✅ |
| P10 | B_sales   | `ALLOWED_ROLLED_BACK` | ✅ |
| P11 | B_viewer  | `BLOCKED_RLS`         | ✅ |
| P12 | B_cs      | `ALLOWED_ROLLED_BACK` | ✅ |

**Resultado:** 10 permitidos (com rollback) + 2 viewers bloqueados — conforme especificação.

## 6. Bloco 2 — Matriz organization cross-org (12 probes)

Payload: `org_id` do OUTRO tenant, `pipeline_id`/`stage_id` do próprio ator (para isolar a dimensão `organization_id`).

| # | Ator | Alvo | Resultado |
|---|---|---|---|
| P13 | A_owner   | Org B | `BLOCKED_RLS` ✅ |
| P14 | A_admin   | Org B | `BLOCKED_RLS` ✅ |
| P15 | A_manager | Org B | `BLOCKED_RLS` ✅ |
| P16 | A_sales   | Org B | `BLOCKED_RLS` ✅ |
| P17 | A_viewer  | Org B | `BLOCKED_RLS` ✅ |
| P18 | A_cs      | Org B | `BLOCKED_RLS` ✅ |
| P19 | B_owner   | Org A | `BLOCKED_RLS` ✅ |
| P20 | B_admin   | Org A | `BLOCKED_RLS` ✅ |
| P21 | B_manager | Org A | `BLOCKED_RLS` ✅ |
| P22 | B_sales   | Org A | `BLOCKED_RLS` ✅ |
| P23 | B_viewer  | Org A | `BLOCKED_RLS` ✅ |
| P24 | B_cs      | Org A | `BLOCKED_RLS` ✅ |

**Resultado:** 12/12 bloqueados. Nenhum `ALLOWED_ROLLED_BACK`. Nenhum `UNEXPECTED_ERROR`.

## 7. Bloco 3 — Pipeline/Stage opcionais (6 probes, somente owners)

| # | Ator | Org | Pipeline | Stage | Resultado |
|---|---|---|---|---|---|
| P25 | A_owner | A | NULL   | NULL   | `ALLOWED_ROLLED_BACK` ✅ |
| P26 | B_owner | B | NULL   | NULL   | `ALLOWED_ROLLED_BACK` ✅ |
| P27 | A_owner | A | Pipe A | NULL   | `ALLOWED_ROLLED_BACK` ✅ |
| P28 | B_owner | B | Pipe B | NULL   | `ALLOWED_ROLLED_BACK` ✅ |
| P29 | A_owner | A | NULL   | Stage A| `ALLOWED_ROLLED_BACK` ✅ |
| P30 | B_owner | B | NULL   | Stage B| `ALLOWED_ROLLED_BACK` ✅ |

**Resultado:** 6/6 permitidos — o guard `nsec12_opportunities_insert_tenant_relations_guard` não tornou obrigatório nenhum campo que continua opcional no schema.

## 8. Bloco 4 — `organization_id` NULL (2 probes, INSERT direto)

INSERTs diretos via PostgREST (a RPC rejeitaria por whitelist antes do INSERT).

| # | Ator | Título | HTTP | Resultado |
|---|---|---|---|---|
| P31 | A_owner | `SECURITY_TEST_OPPORTUNITY_CANARY_MATRIX_NULL_ORG_A` | 403 | `BLOCKED_RLS` ✅ |
| P32 | B_owner | `SECURITY_TEST_OPPORTUNITY_CANARY_MATRIX_NULL_ORG_B` | 403 | `BLOCKED_RLS` ✅ |

**Resultado:** 2/2 bloqueados. Nenhuma opportunity persistiu.

## 9. Resultado por papel (consolidado)

| Papel | Same-org (A) | Same-org (B) | Cross-org (A→B) | Cross-org (B→A) |
|---|---|---|---|---|
| owner   | ALLOWED | ALLOWED | BLOCKED | BLOCKED |
| admin   | ALLOWED | ALLOWED | BLOCKED | BLOCKED |
| manager | ALLOWED | ALLOWED | BLOCKED | BLOCKED |
| sales   | ALLOWED | ALLOWED | BLOCKED | BLOCKED |
| viewer  | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
| cs      | ALLOWED | ALLOWED | BLOCKED | BLOCKED |

- Viewer enforcement (`nsec12_opportunities_insert_block_viewer`): **PASS** em 4/4 dimensões.
- Tenant enforcement (`nsec12_opportunities_insert_tenant_relations_guard` + policies permissivas com `organization_id = get_user_organization_id()`): **PASS** em 12/12.

## 10. Baseline pré/pós

| Métrica | Pré | Pós |
|---|---|---|
| `opportunities` totais                                   | 2621 | 2621 |
| `opportunities` ativas (`deleted_at IS NULL`)            | 2218 | 2218 |
| `opportunities` com prefixo `SECURITY_TEST_OPPORTUNITY_%`| 0    | 0    |
| Pipelines sintéticos (A/B)                               | 2    | 2    |
| Stages sintéticas (A/B)                                  | 2    | 2    |
| Policies em `opportunities`                              | 8    | 8    |
| RPC `nsec12_probe_insert_opportunity`                    | 1    | **0** |

**Concorrência real:** validação primária por prefixo sintético + orgs/pipelines/stages sintéticos. Nenhuma linha real foi alterada.

## 11. Smoke read-only pós-mudança

- Módulo Oportunidades: carrega, oportunidades reais visíveis, fixtures invisíveis.
- Forecast: carrega, KPIs preservados.
- Revenue Command: carrega, KPIs preservados.
- Pipelines/stages reais: disponíveis.
- Fixtures sintéticas: continuam invisíveis para orgs reais.
- Nenhum erro novo de RLS.

## 12. Findings

| ID | Estado | Evidência (esta mudança) |
|---|---|---|
| SEC-013 | RESOLVED | 4/4 viewers bloqueados na matriz (same-org A/B + cross-org A/B). |
| SEC-014 | RESOLVED (regressão testada em CHG-015; não reexecutado aqui). | — |
| SEC-015 | RESOLVED (regressão testada em CHG-015; não reexecutado aqui). | — |

**Risco residual (fora do escopo desta mudança, autorização explícita necessária):**
- `account_id` em `opportunities`: NÃO EXECUTADO.
- `contact_id` em `opportunities`: NÃO EXECUTADO.
- UPDATE / DELETE em `opportunities`: NÃO EXECUTADOS.

## 13. Cleanup da RPC

Migration separada aplicada após aprovação dos 32 probes:

```sql
REVOKE ALL ON FUNCTION public.nsec12_probe_insert_opportunity(text, text, text, text)
  FROM PUBLIC, authenticated, anon, service_role;
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity(text, text, text, text);
```

Confirmações pós-cleanup:
- `pg_proc` → 0 funções com esse nome/assinatura.
- Nenhum grant residual (`information_schema.routine_privileges` limpo).
- `rg "nsec12_probe_insert_opportunity" src supabase/functions` → sem resultados.
- 8 policies em `opportunities` intactas.
- Triggers de `opportunities` intactos.
- Pipelines/stages sintéticos ativos.
- Tela de oportunidades continua carregando.

## 14. Dados reais intocados

- Zero opportunities reais criadas/alteradas.
- Zero contas/contatos/atividades/propostas/interações reais tocadas.
- Zero efeitos derivados sintéticos persistidos (score_recalc, nrhs_recalc, notifications, revenue_events, stage_history, audit_log, entity_snapshots, workflow_executions).
- Fixtures preservadas.
- Nenhum egress externo.
- Nenhum secret/JWT em log.

## 15. Decisão final

**OPPORTUNITIES INSERT BÁSICO HOMOLOGADO.**
