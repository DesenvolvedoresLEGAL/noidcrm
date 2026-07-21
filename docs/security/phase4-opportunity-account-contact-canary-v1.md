# Phase 4 — Opportunities Account/Contact Canary v1

**Change ID:** NSEC-1.2-CHG-019
**Classe:** Amarela controlada (canary com rollback interno)
**Data (UTC):** 2026-07-21
**Escopo:** `public.opportunities` — INSERT — campos `account_id` e `contact_id`.

## 1. Contexto

Superfícies já homologadas:
- `public.accounts` — INSERT básico (viewer bloqueado, cross-org bloqueado).
- `public.contacts` — INSERT básico e `contacts.account_id` (viewer bloqueado, cross-org bloqueado).
- `public.opportunities` — INSERT básico (32/32), `pipeline_id` e `stage_id` tenant-aware (SEC-013/014/015 RESOLVED, matriz 32/32 aprovada).

`opportunities.account_id` e `opportunities.contact_id` ainda **não** haviam sido validados dinamicamente contra RLS/CHECK/FK atuais.

## 2. Limitação deliberada

Cada organização sintética possui **apenas** uma account oficial e um contato oficial vinculado a ela. Portanto:
- Incompatibilidade `opportunity.account_id ≠ contact.account_id` **dentro do mesmo tenant** não foi testada.
- Não foi criada fixture adicional para este cenário; o órfão da CHG-017 **não** foi utilizado.
- Cenário será tratado em CHG separada após pre-flight próprio.

## 3. Pre-flight (read-only)

- Policies em `public.opportunities`: 8 no total — 6 permissivas + `nsec12_opportunities_insert_block_viewer` + `nsec12_opportunities_insert_tenant_relations_guard` (ambas RESTRICTIVE, `polpermissive=false`, `polcmd='a'`).
- Inspeção estática dos `WITH CHECK` de INSERT: **nenhuma** policy atual referencia `accounts.organization_id`, `contacts.organization_id` ou `contacts.account_id`. `nsec12_opportunities_insert_tenant_relations_guard` cobre apenas pipeline/stage.
- Tipos confirmados: `organization_id uuid`, `pipeline_id text`, `stage_id text`, `account_id uuid`, `contact_id uuid`. `account_id` e `contact_id` permanecem nullable.
- Fixtures ativas (mascaradas):
  - Org A `e1c4881f-…-bca0`, Org B `bea090a6-…-7578`.
  - Account A `36085a30-…-d92b` (Org A), Account B `b777baac-…-9f41` (Org B).
  - Contact A `55d589fb-…-bbf0` (Org A, account A), Contact B `47ad14f0-…-8a27` (Org B, account B).
  - Pipeline A/B e Stage A/B com `organization_id` correto.
  - 12 usuários sintéticos ativos.
- Órfão `b53de59c-…-d92b` continua com `nome=''` e `primeiro_nome=''`, não utilizado.
- Baseline pré: `opportunities` totais = **2622**; sintéticas com título `SECURITY_TEST_OPPORTUNITY_REL_CANARY_%` = **0**.

## 4. RPC temporária

`public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text) RETURNS text`

- `SECURITY INVOKER`, `SET search_path = public`, sem SQL dinâmico, sem DDL, sem HTTP, sem `pg_net`, sem chamada de Edge Function.
- `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE TO authenticated`.
- Payload interno fixo: `status='new'`, `automation_enabled=false`, `owner_user_id=auth.uid()`, demais campos por default seguro.
- Whitelist rígida: 12 UUIDs de usuários sintéticos, 2 orgs, 2 pipelines, 2 stages, 2 accounts sintéticas, 2 contacts oficiais. `p_contact_id = <órfão>` → `REJECTED_ORPHAN_CONTACT`. Título obrigatório com prefixo `SECURITY_TEST_OPPORTUNITY_REL_CANARY_`.
- Guards **não** consultam `accounts.organization_id` nem `contacts.organization_id`/`account_id` (cross-tenant precisa alcançar o INSERT real).
- Rollback interno: sub-bloco `BEGIN … EXCEPTION`; após o INSERT, `RAISE EXCEPTION 'NSEC12_ROLLBACK'` — a subtransação reverte a linha e todos os efeitos derivados (triggers de audit/notifications/queues rodam na mesma subtransação).
- Códigos permitidos retornados: `ALLOWED_ROLLED_BACK`, `BLOCKED_RLS` (`42501`), `BLOCKED_CHECK` (`23514`), `BLOCKED_CONSTRAINT` (`23503/23505/23502/23P01`), `REJECTED_*`, `UNEXPECTED_ERROR`. Nenhum UUID, JWT, secret, linha ou mensagem crua é retornada.
- Rollback DDL documentado: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text);`

## 5. Transporte

- JWTs reais emitidos via Edge Function `nsec12-provision-fixtures` (`action=issueToken`) — restrita a `sec-test-*@example.com`. Personas usadas: Owner A, Owner B, Viewer A, Viewer B.
- Chamada `POST /rest/v1/rpc/nsec12_probe_insert_opportunity_with_relations` com `apikey: <publishable anon>` + `Authorization: Bearer <JWT real>`.
- **Service role NÃO utilizado** em Authorization em nenhum probe.

## 6. Resultado dos 16 probes

| # | Persona | Org | Pipe | Stage | Account | Contact | Esperado | Observado | Veredicto |
|---|---|---|---|---|---|---|---|---|---|
| P1  | Owner A  | A | A | A | A | A | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P2  | Owner B  | B | B | B | B | B | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P3  | Viewer A | A | A | A | A | A | BLOCKED_RLS         | `BLOCKED_RLS`         | ✅ |
| P4  | Viewer B | B | B | B | B | B | BLOCKED_RLS         | `BLOCKED_RLS`         | ✅ |
| P5  | Owner A  | B | A | A | A | A | BLOCKED_RLS         | `BLOCKED_RLS`         | ✅ |
| P6  | Owner B  | A | B | B | B | B | BLOCKED_RLS         | `BLOCKED_RLS`         | ✅ |
| P7  | Owner A  | A | A | A | A | ∅ | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P8  | Owner B  | B | B | B | B | ∅ | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P9  | Owner A  | A | A | A | ∅ | A | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P10 | Owner B  | B | B | B | ∅ | B | ALLOWED_ROLLED_BACK | `ALLOWED_ROLLED_BACK` | ✅ |
| P11 | Owner A  | A | A | A | **B** | ∅ | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |
| P12 | Owner B  | B | B | B | **A** | ∅ | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |
| P13 | Owner A  | A | A | A | ∅ | **B** | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |
| P14 | Owner B  | B | B | B | ∅ | **A** | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |
| P15 | Owner A  | A | A | A | **B** | **B** | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |
| P16 | Owner B  | B | B | B | **A** | **A** | BLOCKED_*           | `ALLOWED_ROLLED_BACK` | ❌ |

### Interpretação por bloco

- **Relação completa same-org (P1/P2):** aprovada — camadas atuais permitem escrita com account e contact do próprio tenant.
- **Viewer regression (P3/P4):** `nsec12_opportunities_insert_block_viewer` continua ativa e bloqueando; SEC-013 permanece RESOLVED.
- **Organization cross-org (P5/P6):** policies permissivas de INSERT continuam validando `organization_id` do payload contra `organization_members`. Bloqueio íntegro.
- **Account same-org isolada (P7/P8):** aprovado; `account_id` opcional e `contact_id NULL` são aceitos.
- **Contact same-org isolado (P9/P10):** aprovado; `contact_id` opcional e `account_id NULL` são aceitos.
- **Account cross-tenant isolada (P11/P12):** **falha** — nenhuma camada valida `accounts.organization_id = opportunities.organization_id`. → **SEC-016**.
- **Contact cross-tenant isolado (P13/P14):** **falha** — nenhuma camada valida `contacts.organization_id = opportunities.organization_id`. → **SEC-017**.
- **Account + Contact do outro tenant (P15/P16):** aceitos conjuntamente; evidência associada tanto a SEC-016 quanto a SEC-017 (sem novo finding).

## 7. Baseline pós

| Métrica | Pré | Pós | Delta |
|---|---|---|---|
| `opportunities` totais | 2622 | 2622 | 0 |
| Títulos `SECURITY_TEST_OPPORTUNITY_REL_CANARY_%` | 0 | 0 | 0 |
| Accounts sintéticas ativas (A/B) | 2 | 2 | 0 |
| Contatos oficiais sintéticos (A/B) | 2 | 2 | 0 |
| Contato órfão | 1 (nome vazio) | 1 (nome vazio) | 0 |
| Pipelines/Stages sintéticos | 2/2 | 2/2 | 0 |

**Zero persistência**, **zero efeito derivado sintético** (rollback interno cobriu triggers de audit/notification/queues), **zero dados reais alterados**, **zero egress externo**.

## 8. Smoke read-only

- Não foi induzida alteração em telas de produção pela canary. Nenhuma linha real tocada. Selectors de account/contact e pipelines reais continuam íntegros por consequência da ausência de persistência.

## 9. Estado da RPC

`public.nsec12_probe_insert_opportunity_with_relations` **permanece instalada** — necessária para reprobes após correção de SEC-016/SEC-017. Nenhum grant adicional, nenhum novo UUID em whitelist. Rollback DDL documentado acima.

## 10. Findings

- **SEC-016** (HIGH, OPEN): `account_id` em opportunities aceita account cross-tenant.
- **SEC-017** (HIGH, OPEN): `contact_id` em opportunities aceita contact cross-tenant.
- SEC-013, SEC-014, SEC-015 permanecem **RESOLVED** (P3/P4/P5/P6 confirmaram).

## 11. Decisão final

**OPPORTUNITIES ACCOUNT/CONTACT CANARY FAILED**

- Metodologia funcionou (16/16 probes com rollback íntegro e baseline preservado).
- `account_id` e `contact_id` cross-tenant são aceitos em INSERT — dois vetores de contaminação multi-tenant confirmados.
- Correção **não executada** nesta mudança (fora de escopo AMARELO).
- Aguardando autorização humana explícita para próxima CHG (proposta: policy RESTRICTIVE tenant-aware para `account_id` e `contact_id`, análoga à `nsec12_opportunities_insert_tenant_relations_guard`).

---

## NSEC-1.2-CHG-020 — Integridade tenant de account_id e contact_id

**Data (UTC):** 2026-07-21
**Classificação:** AMARELA — aditiva, reversível por único DROP POLICY.
**Superfície:** RLS INSERT em `public.opportunities`.

### Pre-flight
- 8 policies em `opportunities` (6 permissivas + `nsec12_opportunities_insert_block_viewer` + `nsec12_opportunities_insert_tenant_relations_guard`). Nenhuma valida `accounts.organization_id` ou `contacts.organization_id` versus `opportunities.organization_id`.
- RPC `public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text)` presente, `prosecdef=false`, `search_path=public`, whitelist intacta.
- Fixtures ativas: Org A/B, Account A/B, Contact A/B oficiais, Pipeline A/B, Stage A/B. Órfão `b53de59c-…-fcb3` intocado.
- Tipos confirmados uuid em todos os campos relacionais; `account_id` e `contact_id` permanecem nullable.
- Baseline pré: `opportunities.total=2623`, sintéticas `SECURITY_TEST_OPPORTUNITY_REL_CANARY_%`=0.

### Migration aplicada
```sql
CREATE POLICY nsec12_opportunities_insert_account_contact_tenant_guard
ON public.opportunities AS RESTRICTIVE FOR INSERT TO authenticated
WITH CHECK (
  (account_id IS NULL OR EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = opportunities.account_id
      AND a.organization_id = opportunities.organization_id))
  AND
  (contact_id IS NULL OR EXISTS (
    SELECT 1 FROM public.contacts c
    WHERE c.id = opportunities.contact_id
      AND c.organization_id = opportunities.organization_id))
);
```

- `polpermissive=false`, `polcmd=a`, `polroles={authenticated}`, sem USING, sem função auxiliar, sem trigger.
- Não valida compatibilidade `account_id`↔`contact_id` dentro do mesmo tenant (fora do escopo).
- Total pós-migration: **9 policies** em `opportunities`. Demais policies intactas.

### Rollback
```sql
DROP POLICY IF EXISTS nsec12_opportunities_insert_account_contact_tenant_guard ON public.opportunities;
```

### Reprobes — 16/16 conforme esperado

| Probe | Cenário | Esperado | Observado |
| --- | --- | --- | --- |
| P1  | Owner A · relação completa same-org A | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P2  | Owner B · relação completa same-org B | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P3  | Viewer A                              | BLOCKED             | BLOCKED_RLS |
| P4  | Viewer B                              | BLOCKED             | BLOCKED_RLS |
| P5  | Owner A · organization_id=Org B       | BLOCKED             | BLOCKED_RLS |
| P6  | Owner B · organization_id=Org A       | BLOCKED             | BLOCKED_RLS |
| P7  | Owner A · Account A · contact NULL    | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P8  | Owner B · Account B · contact NULL    | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P9  | Owner A · account NULL · Contact A    | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P10 | Owner B · account NULL · Contact B    | ALLOWED_ROLLED_BACK | ALLOWED_ROLLED_BACK |
| P11 | Owner A · Account B cross-tenant      | BLOCKED             | BLOCKED_RLS |
| P12 | Owner B · Account A cross-tenant      | BLOCKED             | BLOCKED_RLS |
| P13 | Owner A · Contact B cross-tenant      | BLOCKED             | BLOCKED_RLS |
| P14 | Owner B · Contact A cross-tenant      | BLOCKED             | BLOCKED_RLS |
| P15 | Owner A · Account B + Contact B       | BLOCKED             | BLOCKED_RLS |
| P16 | Owner B · Account A + Contact A       | BLOCKED             | BLOCKED_RLS |

Todos os probes retornaram HTTP 200 com JWT real dos usuários sintéticos + publishable key; nenhuma service role no `Authorization`.

### Baseline pós
- `opportunities.total = 2623` (idêntico).
- Sintéticas `SECURITY_TEST_OPPORTUNITY_REL_CANARY_%` = 0.
- Accounts A/B com `organization_id` correto; Contacts A/B oficiais com `organization_id` e `account_id` intactos; órfão inalterado.
- Zero efeito derivado sintético persistido; zero dado real alterado; zero egress externo.

### Smoke read-only
- Preview autenticado carregando telas de oportunidades, empresas, contatos, forecast e Revenue Command sem novos erros de RLS.

### Estado da RPC
- `nsec12_probe_insert_opportunity_with_relations` **mantida** instalada (SECURITY INVOKER, sem alteração). Matriz completa relacional e compatibilidade same-tenant ficam para mudança separada.

### Findings
- **SEC-016 — RESOLVED.** Corrigido por `nsec12_opportunities_insert_account_contact_tenant_guard`. Evidências: P11, P12, P15, P16 → BLOCKED_RLS. Risco residual: UPDATE e compatibilidade account↔contact same-tenant não homologados.
- **SEC-017 — RESOLVED.** Corrigido pela mesma policy. Evidências: P13, P14, P15, P16 → BLOCKED_RLS. Mesmo risco residual.
- SEC-013 / SEC-014 / SEC-015: permanecem RESOLVED; sem regressão detectada nos reprobes.

### Compatibilidade same-tenant
Não implementada nesta mudança. A policy valida exclusivamente `organization_id` das entidades relacionadas.

### Decisão
**NSEC-1.2-CHG-020 VALIDATED.**

## NSEC-1.2-CHG-021 — Matriz completa por papel + cleanup da RPC (HOMOLOGADA)

Executados 36 probes com JWT real de cada persona (owner/admin/manager/sales/viewer/cs × Org A/Org B), publishable key em `apikey`, zero service role.

- **Bloco 1 (same-org, 12):** 10 `ALLOWED_ROLLED_BACK` (owner/admin/manager/sales/cs de ambas orgs) + 2 `BLOCKED_RLS` (viewers). ✅
- **Bloco 2 (account cross-tenant, 12):** 12/12 `BLOCKED_RLS`. ✅ → SEC-016 revalidado por papel.
- **Bloco 3 (contact cross-tenant, 12):** 12/12 `BLOCKED_RLS`. ✅ → SEC-017 revalidado por papel.

**Baseline pré/pós:** `opportunities.total = 2624 / 2624`; zero linhas com `SECURITY_TEST_OPPORTUNITY_REL_CANARY_MATRIX_CHG021%`; 9 policies intactas; fixtures intactas; órfão inalterado.

**Cleanup da RPC:** migration aplicada — `REVOKE ALL ... FROM PUBLIC, authenticated, anon, service_role;` seguido de `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity_with_relations(uuid,text,text,uuid,uuid,text);`. `pg_proc` retorna 0. Sem referências de produto em `src/` ou `supabase/functions/`.

**Risco residual não coberto:** compatibilidade account↔contact same-tenant (sem fixture), UPDATE, DELETE.

**Relatório completo:** `docs/security/phase4-opportunity-account-contact-matrix-v1.md`.

**Decisão:** `OPPORTUNITIES ACCOUNT/CONTACT TENANT MATRIX HOMOLOGADA`.
