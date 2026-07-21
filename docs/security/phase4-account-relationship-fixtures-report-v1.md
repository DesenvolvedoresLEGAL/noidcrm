# Phase 4 — Account Relationship Fixtures Report v1

**Change ID:** NSEC-1.2-CHG-008
**Classe:** Amarela controlada
**Data (UTC):** 2026-07-21

## 1. Pre-flight (read-only)

- `NOID_SECURITY_ORG_A` id: `e1c4881f-…-bca0` (mascarado)
- `NOID_SECURITY_ORG_B` id: `bea090a6-…-7578` (mascarado)
- Owner sintético A: `58c9eb37-…-329b` — membership `active`, `org_role='owner'`, org A ✅
- Owner sintético B: `4ac56488-…-9526` — membership `active`, `org_role='owner'`, org B ✅
- Policies INSERT em `public.accounts`:
  - PERMISSIVE `Org members can insert accounts` ✅
  - PERMISSIVE `Users insert accounts in own org` ✅
  - RESTRICTIVE `nsec12_accounts_insert_block_viewer` ✅ (ativa e inalterada)
- Triggers ativos (12) inspecionados — todos locais (audit, soft-delete, normalização de segmento, recálculo de score, snapshots, workflow). **Nenhum executa HTTP / pg_net / e-mail / Slack / webhook / Edge Function / integração externa.**
- Campos mínimos: `razao_social`, `organization_id`; demais nullable/default.

## 2. Baseline pré

| Métrica | Valor |
|---|---|
| Accounts reais ativas | 4.781 |
| Sintéticas ativas | 0 |
| Sintéticas tombstone | 1 |

## 3. Payloads sintéticos

```jsonc
// Account A
{ "organization_id": "<ORG_A>", "razao_social": "SECURITY_TEST_ACCOUNT_ORG_A_BASE",
  "nome_fantasia": "SECURITY_TEST_ACCOUNT_ORG_A_BASE" }
// Account B
{ "organization_id": "<ORG_B>", "razao_social": "SECURITY_TEST_ACCOUNT_ORG_B_BASE",
  "nome_fantasia": "SECURITY_TEST_ACCOUNT_ORG_B_BASE" }
```

`created_by` preenchido automaticamente pelo trigger `accounts_set_created_by`. Sem status comercial, sem CNPJ/telefone/e-mail/endereço/domínio/cliente/proprietário reais.

## 4. Método

- Endpoint: `POST /rest/v1/accounts` (PostgREST).
- Headers: `apikey: <publishable anon>`, `Authorization: Bearer <JWT real do owner sintético>`.
- **Service role NÃO utilizado** em nenhum momento no header de INSERT ou SELECT de validação.
- Ordem: criar A → validar A → criar B → validar B → matriz cross-org.

## 5. Resultado

### Account A
- HTTP: 201 Created
- UUID (mascarado): `36085a30-…-d92b`
- `organization_id`: Org A ✅
- `created_by`: Owner A ✅
- `deleted_at`: NULL ✅
- `razao_social`: `SECURITY_TEST_ACCOUNT_ORG_A_BASE` ✅

### Account B
- HTTP: 201 Created
- UUID (mascarado): `b777baac-…-9f41`
- `organization_id`: Org B ✅
- `created_by`: Owner B ✅
- `deleted_at`: NULL ✅
- `razao_social`: `SECURITY_TEST_ACCOUNT_ORG_B_BASE` ✅

## 6. Matriz de visibilidade SELECT (JWT real)

| Persona | Vê A | Vê B | Esperado |
|---|---|---|---|
| Owner A | ✅ | ⛔ [] | PASS |
| Owner B | ⛔ [] | ✅ | PASS |
| Viewer A | ✅ | ⛔ [] | PASS |
| Viewer B | ⛔ [] | ✅ | PASS |

**Zero vazamento cross-org.**

## 7. Efeitos derivados (locais)

| Tabela | Linhas ligadas às fixtures |
|---|---|
| `lead_score_recalc_queue` | 2 (uma por fixture — comportamento normal do produto) |
| `entity_snapshots` | 0 |
| `deletion_alerts` | 0 |
| `nrhs_recalc_queue` | 0 |

Todos os efeitos são transacionais internos, sem egress externo. Mantidos conforme mandato (sem cleanup nesta mudança).

## 8. Baseline pós

| Métrica | Valor | Delta |
|---|---|---|
| Accounts reais ativas | 4.781 | 0 |
| Sintéticas ativas | 2 | +2 |
| Sintéticas tombstone | 1 | 0 |

**Dados reais intocados.**

## 9. Smoke read-only

- Owner sintético A e B leem apenas suas próprias fixtures. Nenhum novo erro RLS observado. Estrutura de `public.accounts` inalterada.

## 10. Decisão final

**ACCOUNT RELATIONSHIP FIXTURES READY**

Fixtures permanecem ativas para as próximas etapas (contacts.account_id, opportunities.account_id, activities.account_id). Nenhum teste de relacionamento foi iniciado nesta mudança.
