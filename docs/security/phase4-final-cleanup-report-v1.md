# Phase 4 — Final Cleanup Report v1 (NSEC-1.2-CHG-029)

**Data (UTC):** 2026-07-22 · **Classificação:** AMARELA controlada
**Decisão final:** `NSEC-1.2-CHG-029 EXECUTED — CLEANUP CONCLUÍDO COM EVIDÊNCIA RETIDA`
**GO/NO-GO desta CHG:** ~~GO~~ · **não emitido nesta mudança** (a critério da próxima autorização explícita).

## 1. Escopo

Cleanup controlado das fixtures sintéticas remanescentes do programa
NSEC-1.2 (CHG-001 → CHG-028), preservando **policies RESTRICTIVE
permanentes** que corrigiram findings reais (SEC-011/012/013/018/019/023/024),
**migrations históricas** (auditoria imutável) e **tombstone metodológico**
`620037d8-803c-411a-8969-a99f2850616f`.

## 2. Reconciliação documental (Fase A)

`docs/security/single-project-cleanup-runbook-v1.md` atualizado com:
- §9 — WRITE_TARGET IDs (6 UUIDs: 2 accounts + 2 contacts + 2 opportunities)
- §10 — Contrato dos triggers `soft_delete_*` (DELETE físico impossível sem bypass)
- §11 — Impacto: tombstone + shells (orgs/pipelines/stages) retidos por FK NO_ACTION

## 3. Pre-flight (Fase C)

FKs `organizations→accounts`, `pipelines→opportunities`, `stages→opportunities`
com `confdeltype='NO_ACTION'` — bloqueiam DELETE físico enquanto houver
qualquer linha (mesmo soft-deleted) apontando. Decisão: manter shells.

## 4. Execução em banco (Fases D/E/F)

| Passo | Ação | Resultado |
|---|---|---|
| D.1 | Suspender 12 memberships sintéticos | `status='suspended'` |
| D.2 | DELETE opportunities sintéticas (2 WRITE_TARGETs) | soft-delete via trigger |
| D.3 | DELETE contacts sintéticos (BASE + ALT + WRITE_TARGET) | soft-delete via trigger |
| D.4 | DELETE accounts sintéticas (BASE + ALT + WRITE_TARGET + orphan dup) | soft-delete via trigger |
| E.1 | DELETE `user_roles` sintéticos (12) | -12 rows |
| E.2 | DELETE `organization_members` sintéticos (12) | -12 rows |
| F | Manter `pipelines`/`stages` shells (2+2) | preservado por FK NO_ACTION |

**Tombstone `620037d8` permanece soft-deleted, `created_by = Owner A`.**

## 5. Auth users (Fase G)

Rota `action:"delete"` adicionada à Edge Function `nsec12-provision-fixtures`
(whitelist estrita de 12 UUIDs, bypass de token guardado por whitelist).
Invocação final via `supabase--curl_edge_functions`:

| ID (mascarado) | Ação |
|---|---|
| `58c9****329b` (Owner A) | **RETAINED — EVIDENCE RETENTION PRINCIPAL** (tombstone `created_by`) |
| `4ac5****9526` (Owner B) | **RETAINED — EVIDENCE RETENTION PRINCIPAL** (created_by de 4 accounts B soft-deleted + audit_log) |
| 10 usuários restantes | `not_found` (deletados em passe anterior; nenhum sobrevivente) |

Motivo da 2ª retenção: FK strict de `public.accounts.created_by → auth.users.id`
impedia deleção sem viola integridade — comportamento previsto pelo mandato
(“não considerar falha de cleanup”).

## 6. Infraestrutura (Fase I)

- Edge Function `nsec12-provision-fixtures` **DELETADA** (Supabase + local).
- Diretório `supabase/functions/nsec12-provision-fixtures/` removido.
- Secrets removidos: `NSEC12_TOKEN2`, `NSEC12_PROVISION_TOKEN`.
- Nenhuma referência remanescente em `src/`, `supabase/functions/`, `scripts/`.
- Migrations `20260720…` — `20260721…` (evidência imutável) **preservadas**.

## 7. Baseline pré/pós (Fase J)

| Métrica | Pré (CHG-028) | Pós (CHG-029) | Delta |
|---|---:|---:|---:|
| Organizations reais | 8 | 8 | 0 |
| Accounts reais | 4.880 | 4.880 | 0 |
| Contacts reais | 1.739 | 1.739 | 0 |
| Opportunities reais | 2.628 | 2.628 | 0 |
| Pipelines reais | 17 | 17 | 0 |
| Stages reais | 98 | 98 | 0 |
| Members reais | 32 | 32 | 0 |
| Accounts sintéticas ativas | 8 | **0** | -8 |
| Accounts sintéticas soft-deleted | 0 | **8** | +8 (incl. tombstone) |
| Contacts sintéticos ativos | 4 | **0** | -4 |
| Opportunities sintéticas ativas | 2 | **0** | -2 |
| `organization_members` sintéticos | 12 | **0** | -12 |
| `user_roles` sintéticos | 12 | **0** | -12 |
| Auth users sintéticos vivos | 12 | **2** (Owner A + B retidos) | -10 |
| Orgs shell (fixtures) | 2 | 2 | 0 (retidas por FK) |
| Pipelines shell | 2 | 2 | 0 (retidas por FK) |
| Stages shell | 2 | 2 | 0 (retidas por FK) |
| Tombstone `620037d8` | 1 | 1 | 0 (intacto) |
| Policies `nsec12_*` permanentes | 10 | **10** | 0 (protections preservadas) |
| RPCs `nsec12_*` | 0 | **0** | 0 (removidas em CHG anteriores) |
| Edge Function `nsec12-provision-fixtures` | ativa | **removida** | -1 |
| Secrets `NSEC12_*` | 2 | **0** | -2 |

**Zero registros reais alterados. Zero egress externo. Zero uso de service role em produção real.**

## 8. Findings resolvidos ao longo do programa

SEC-011 (viewer INSERT accounts), SEC-012 (viewer INSERT contacts),
SEC-013 (viewer INSERT opportunities), SEC-018 (account↔contact
mismatch same-tenant), SEC-019 (viewer UPDATE accounts/contacts),
SEC-023 (activities cross-tenant opportunity), SEC-024 (proposals
cross-tenant opportunity) — todas fechadas via policies RESTRICTIVE
`nsec12_*` permanentes (mantidas neste cleanup).

## 9. Retenções documentadas

| Item | Motivo |
|---|---|
| Owner A auth user | Tombstone `created_by` |
| Owner B auth user | FK strict `accounts.created_by` (4 accounts B soft-deleted) + `audit_log.actor_user_id` |
| Tombstone account `620037d8` | Prova metodológica original (soft-delete Fase 3) |
| Organizations shell (2) | FK `accounts.organization_id NO_ACTION` |
| Pipelines/Stages shell (2+2) | FK `opportunities.pipeline_id/stage_id NO_ACTION` |
| Accounts/contacts/opps sintéticas soft-deleted | Triggers `soft_delete_*` retornam NULL — DELETE físico exigiria bypass proibido |
| 10 policies `nsec12_*` RESTRICTIVE | Correções de findings SEC-011…SEC-024 — proteção permanente |
| Migrations `20260720…`–`20260721…` | Auditoria imutável |

## 10. Smoke read-only

Baseline pós confirma isolamento e integridade da base real. Nenhum
teste UI executado nesta CHG (fora do escopo autorizado); tratamento
de regressão restrito à observação de contadores.

## 11. Decisão

`NSEC-1.2-CHG-029 EXECUTED` — cleanup concluído com evidência
retida conforme mandato. Emissão de GO NSEC-1.2 pendente de nova
autorização explícita.
