# NOID Security — Phase 4 SELECT Report v1

**Sprint:** NOID-SECURITY 1.2
**Fase:** 4 — Testes multi-tenant reais (superfície SELECT)
**Data:** 2026-07-20
**Escopo executado:** apenas SELECT. INSERT/UPDATE/DELETE/RPCs/Views/Edge Functions/Importação/Notificações **não iniciadas** (aguardando aprovação).

## 1. Ambiente

- Projeto único Lovable Cloud (ref `urihdqturaebhiefwjnw`)
- Fixtures sintéticas: 2 orgs (`NOID_SECURITY_ORG_A/B`) × 6 papéis = 12 usuários `@example.com`
- Impersonation: tokens `access_token` emitidos por `nsec12-provision-fixtures` action `issueToken` (guarded, prefixo `sec-test-*` obrigatório)
- Superfície testada: PostgREST `/rest/v1/*` como role `authenticated`, JWT do usuário sintético

## 2. Cobertura executada

### 2.1 Probe negativo — cross-org (deve retornar 0)

Para cada um dos 12 usuários, tenta ler a **outra** org sintética:

| Alvo | Filtro |
| --- | --- |
| `organizations` | `id=eq.<outra_org>` |
| `organization_members` | `organization_id=eq.<outra_org>` |
| `profiles` | `organization_id=eq.<outra_org>` |
| `opportunities` | `organization_id=eq.<outra_org>` |
| `contacts` | `organization_id=eq.<outra_org>` |
| `accounts` | `organization_id=eq.<outra_org>` |
| `proposals` | `organization_id=eq.<outra_org>` |
| `activities` | `organization_id=eq.<outra_org>` |
| view `commercial_won_revenue_view` | `organization_id=eq.<outra_org>` |
| view `unified_timeline` | `organization_id=eq.<outra_org>` |
| view `v_unified_won_revenue_v2` | `organization_id=eq.<outra_org>` |
| view `commission_eligibility_view` | `organization_id=eq.<outra_org>` |

Total: 12 usuários × 12 alvos = **144 probes negativos**.

### 2.2 Probe positivo — mesma org (deve retornar ≥1)

Para cada usuário, ler a **própria** org e listar seus 6 memberships.
Total: 12 usuários × 2 alvos = **24 probes positivos**.

## 3. Resultados

### 3.1 Totais

| Métrica | Valor |
| --- | --- |
| Total de probes | 168 |
| Aprovados (RLS aplicada corretamente) | 168 |
| Reprovados / vazamentos | **0** |
| Escalada de privilégio detectada | **0** |
| Impacto em dados reais LEGAL | **0** — nenhuma escrita executada e nenhuma leitura de tenant real |

### 3.2 Vazamentos cross-org

**Nenhum.** Para cada um dos 144 probes negativos:
- HTTP 200 com `[]` (RLS filtrou), ou HTTP 400 com erro de coluna inexistente antes da avaliação (12 casos em `organizations`, reexecutados corrigidos com `select=id,name` → 0 vazamentos).

### 3.3 Por papel (probes negativos, 24 por papel: 12 alvos × 2 usuários)

| Papel | Probes | Vazamentos |
| --- | --- | --- |
| owner | 24 | 0 |
| admin | 24 | 0 |
| manager | 24 | 0 |
| sales | 24 | 0 |
| viewer | 24 | 0 |
| cs | 24 | 0 |

### 3.4 Por operação

| Operação | Executada nesta parada | Aprovados | Reprovados |
| --- | --- | --- | --- |
| SELECT | sim | 168 | 0 |
| INSERT | não | — | — |
| UPDATE | não | — | — |
| DELETE | não | — | — |
| RPC | não | — | — |
| Views | (coberto dentro de SELECT via 4 views críticas) | 48 | 0 |
| Edge Functions | não | — | — |
| Importação | não | — | — |
| Notificações | não | — | — |

### 3.5 Sanity positivo (própria org)

Todos os 12 usuários leram exatamente 1 linha em `organizations` (a própria) e 6 linhas em `organization_members` (todos os colegas). Confirma que RLS **não** está bloqueando demais — o modelo `has_role`/`can_view_all` funciona para role `member` com `org_role` real (manager/sales/viewer/cs).

## 4. Validação da regra 9 (org_role vs role legado)

Todos os 8 usuários com `role='member'` no `organization_members` (manager, sales, viewer, cs em cada org) tiveram acesso **igual** ao esperado para seu `org_role` real:

- viewer vê sua org e memberships (papel de leitura básica);
- sales/manager/cs idem;
- owner/admin (com `role` legado igual ao `org_role`) idem.

Nenhum sinal de que a policy esteja usando o campo `role` legado como fonte de autorização crítica **para SELECT**. RLS de INSERT/UPDATE/DELETE ainda não foi testada — pode existir divergência lá; a validação continuará nas próximas superfícies.

## 5. Confirmação de não-impacto em dados reais

- Nenhuma escrita foi executada em nenhuma tabela.
- Todos os SELECTs cross-org foram feitos contra as duas orgs sintéticas (`e1c4881f…` e `bea090a6…`); nenhum SELECT alvejou UUID de org real (LEGAL/HUMANOID).
- Baseline pré-fase: 8 orgs reais + 2 sintéticas; 32 memberships reais + 12 sintéticos.
- Baseline pós-fase idêntico (nenhum INSERT/UPDATE/DELETE emitido).

## 6. Achados

**Nenhum finding classificado como vazamento ou elevação de privilégio.**

Observações operacionais menores (não bloqueantes):

- O harness inicial usou `select=organization_id` no probe da tabela `organizations`, gerando HTTP 400 em 12 chamadas antes do reexame. Não é vazamento — o backend rejeitou a projeção. Reprobe com `select=id,name` retornou 0 linhas em todos os 12 casos.

## 7. Estado final

- Fase 4 SELECT: **CONCLUÍDA — 168/168 PASS, 0 vazamentos, 0 escaladas.**
- Fases 4b-4i (INSERT/UPDATE/DELETE/RPCs/Views ativas/Edge Functions/Importação/Notificações): **NÃO INICIADAS**, aguardando nova aprovação explícita.
- Storage hardening (Fase 5+): **NÃO INICIADA**, aguardando nova aprovação.
- Fixtures sintéticas: ativas, prontas para reutilização; cleanup runbook publicado.
- Produção: intocada — zero migrations, zero policy changes, zero writes.
