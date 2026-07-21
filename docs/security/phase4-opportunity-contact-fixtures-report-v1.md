# Phase 4 — Opportunity Contact Fixtures Report v1

**Change ID:** NSEC-1.2-CHG-017
**Classe:** Amarela controlada
**Data (UTC):** 2026-07-21
**Decisão final:** **OPPORTUNITY CONTACT FIXTURES BLOCKED**

## 1. Contexto

Mandato NSEC-1.2-CHG-017: provisionar exatamente 2 contatos sintéticos
permanentes (`SECURITY_TEST_CONTACT_ORG_A_BASE` e
`SECURITY_TEST_CONTACT_ORG_B_BASE`) vinculados às accounts-base sintéticas,
sem opportunities, sem cleanup, sem alteração de schema.

## 2. Escopo executado

- Pre-flight read-only completo.
- Uma tentativa de INSERT de Contact A via PostgREST com JWT real do owner
  sintético A.
- Interrupção imediata após detectar não-conformidade no nome.
- Registro do row remanescente no cleanup runbook.
- Nenhuma tentativa de Contact B (guardrail: "Contact A falhar e Contact B
  criado mesmo assim" = STOP).
- Nenhum UPDATE/DELETE, nenhuma migration, nenhuma RPC.

## 3. Pre-flight (read-only)

### 3.1 Fixtures-base confirmadas

- `NOID_SECURITY_ORG_A`: `e1c4881f-…-bca0` ✅
- `NOID_SECURITY_ORG_B`: `bea090a6-…-7578` ✅
- Account A (`SECURITY_TEST_ACCOUNT_ORG_A_BASE`): `36085a30-…-d92b` — Org A,
  `created_by=` owner A, `deleted_at IS NULL` ✅
- Account B (`SECURITY_TEST_ACCOUNT_ORG_B_BASE`): `b777baac-…-9f41` — Org B,
  `created_by=` owner B, `deleted_at IS NULL` ✅
- Owner sintético A (`58c9eb37-…-329b`) e Owner sintético B
  (`4ac56488-…-9526`): membership ativo, `org_role='owner'` ✅

### 3.2 Policies em `public.contacts`

| Nome | cmd | permissive |
|---|---|---|
| `Users view contacts in own org` | SELECT | PERMISSIVE |
| `Users insert contacts in own org` | INSERT | PERMISSIVE (tenant-aware, valida account_id) |
| `Users can update org contacts` | UPDATE | PERMISSIVE |
| `Users update contacts in own org` | UPDATE | PERMISSIVE |
| `Admins delete contacts` | DELETE | PERMISSIVE |
| `nsec12_contacts_insert_block_viewer` | INSERT | RESTRICTIVE |

Todas inalteradas em relação à CHG-010.

### 3.3 Triggers em `public.contacts`

8 triggers ativos, todos locais (soft-delete, rate-limit, deletion alert,
lead-score recalc queue, NRHS recalc queue, opportunity score recalc queue,
e o trigger de composição de `nome`):

- `trg_contact_nome` (BEFORE INSERT OR UPDATE): executa
  `NEW.nome := trim(NEW.primeiro_nome || ' ' || coalesce(NEW.ultimo_nome, ''))`.

**Nenhum trigger executa `pg_net`, HTTP, webhook, e-mail, Slack, Edge
Function ou integração externa.**

### 3.4 Colunas relevantes

| Coluna | Nullable | Default |
|---|---|---|
| `organization_id` | NO | — |
| `nome` | NO | — (sobrescrita pelo trigger) |
| `account_id` | YES | — |
| `deleted_at` | YES | — |

`public.contacts` **não tem coluna `created_by`** — logo, autoria só pode ser
inferida por auditoria externa. Coerente com CHG-005/CHG-010.

### 3.5 Baseline pré

| Métrica | Valor |
|---|---|
| Contatos reais ativos | 1.687 |
| Contatos reais totais | 1.736 |
| Contatos sintéticos ativos | 0 |
| Contatos sintéticos tombstone | 0 |
| Accounts sintéticas ativas | 2 |
| Contatos com nome `SECURITY_TEST_CONTACT_ORG_*_BASE` | 0 |

## 4. Tentativa Contact A

- Emissor: PostgREST `POST /rest/v1/contacts`.
- `apikey`: publishable anon.
- `Authorization`: JWT real emitido para `sec-test-a-owner@example.com` via
  edge function `nsec12-provision-fixtures` (`action=issueToken`).
- Payload enviado:

```json
{
  "nome": "SECURITY_TEST_CONTACT_ORG_A_BASE",
  "organization_id": "<ORG_A>",
  "account_id": "<ACC_A>"
}
```

- HTTP: **201 Created**.
- Row retornado (mascarado):
  - `id`: `b53de59c-…-fcb3`
  - `organization_id`: Org A ✅
  - `account_id`: Account A ✅
  - `deleted_at`: NULL ✅
  - `nome`: **`""` (vazio)** ❌
  - `primeiro_nome`: `""`
  - `ultimo_nome`: `""`

### 4.1 Causa

O trigger `trg_contact_nome` sobrescreve `NEW.nome` a partir de
`primeiro_nome` e `ultimo_nome`, ignorando o valor `nome` enviado pelo
cliente. O contrato real de escrita de contato pelo produto exige
`primeiro_nome` (o frontend usa split first/last e o trigger recompõe
`nome`). Ver memória `contatos-divisao-nome-padrao`.

### 4.2 Decisão

Guardrail de interrupção da mandato foi acionado: **"algum contato com
nome, tenant ou owner divergente do especificado"** → STOP imediato, sem
correção automática, sem tentativa de Contact B.

## 5. Contact B

**Não criado.** Guardrail "Contact A falhar e Contact B for criado mesmo
assim" = STOP.

## 6. Baseline pós

| Métrica | Valor | Delta |
|---|---|---|
| Contatos reais ativos | 1.687 | 0 |
| Contatos reais totais | 1.736 | 0 |
| Contatos sintéticos ativos com nome oficial | 0 | 0 |
| Contatos sintéticos com nome vazio criados nesta CHG | 1 | +1 (órfão, registrado) |
| Accounts sintéticas ativas | 2 | 0 |
| Opportunities sintéticas | 0 | 0 |
| Activities sintéticas | 0 | 0 |
| Dados reais alterados | 0 | 0 |
| Egress externo | 0 | 0 |

## 7. Efeitos derivados do row órfão

O INSERT bem-sucedido disparou os triggers locais esperados
(`enqueue_lead_score_recalc`, `enqueue_nrhs_recalc`,
`enqueue_opportunity_score_recalc`). Todos são filas transacionais internas,
sem egress. Os enfileiramentos afetam somente o próprio contato órfão e
não tocam dados reais.

## 8. Integridade contact → account

- Row órfão `b53de59c-…-fcb3`: `organization_id=Org A`,
  `account_id=Account A` → íntegro em nível de tenant, apenas com nome
  divergente.

## 9. Visibilidade cross-org

Não avaliado formalmente por matriz por ausência das fixtures A/B com nomes
oficiais. Nenhum dado apareceu para tenants reais durante a tentativa.

## 10. Dados reais intocados

Confirmado: 0 mutações em accounts reais, contatos reais, organizações
reais, usuários reais, opportunities, activities, propostas, storage.

## 11. Smoke read-only

Não executado: a mudança foi interrompida antes da criação da segunda
fixture. Guardrails do mandato foram respeitados.

## 12. Cleanup runbook

Atualizado em `docs/security/single-project-cleanup-runbook-v1.md` com
registro do row órfão `b53de59c-…-fcb3` (`SECURITY_TEST_CONTACT_ORG_A_ORPHAN`
por origem/uso, embora nome persistido seja vazio) para remoção controlada
em janela dedicada, após o encerramento da sprint. Nenhum cleanup executado.

## 13. Remediation proposto (para próxima CHG)

CHG-018 (proposta, aguardando autorização humana):

1. Manter row órfão como está até janela de cleanup.
2. Novo payload para Contact A e Contact B utilizando
   `primeiro_nome` = `SECURITY_TEST_CONTACT_ORG_A_BASE` /
   `SECURITY_TEST_CONTACT_ORG_B_BASE` e `ultimo_nome=null`. O trigger
   `trg_contact_nome` produzirá `nome` idêntico ao esperado.
3. Reexecutar Fases E, F, G, H, J, K do mandato original.
4. Registrar UUIDs completos das duas fixtures no runbook.
5. Cleanup do órfão adiado para runbook final da sprint.

## 14. Decisão final

**OPPORTUNITY CONTACT FIXTURES BLOCKED.**

Motivo: contrato de escrita de `public.contacts` exige `primeiro_nome`
para satisfazer o trigger `trg_contact_nome`. O payload autorizado no
mandato (`nome` direto) não é atendível sem alteração de schema/trigger,
o que é explicitamente proibido nesta CHG.

Ficam preservados:
- SEC-013, SEC-014, SEC-015 = **RESOLVED** (sem regressão).
- Todas as fixtures anteriores (orgs, users, accounts, pipelines, stages).
- Zero dado real alterado.
- Zero egress externo.

Aguardando autorização humana explícita para CHG-018 (remediação com
`primeiro_nome`).
