# NSEC-1.2-CHG-013 — Canary Mínima de INSERT em public.opportunities

**Sprint:** NOID-SECURITY 1.2 · Fase 4
**Change ID:** NSEC-1.2-CHG-013
**Classificação:** AMARELA controlada
**Data:** 2026-07-21 UTC
**Escopo:** INSERT canary em `public.opportunities` via RPC temporária com rollback interno, 12 probes, JWTs sintéticos reais.

---

## 1. Pre-flight final (Fase A)

Fixtures reconfirmadas antes de criar a RPC:

| Item | UUID | Estado |
|---|---|---|
| Org A `NOID_SECURITY_ORG_A` | `e1c4881f-0cd4-45fb-bc50-48314ce7bca0` | active/trial |
| Org B `NOID_SECURITY_ORG_B` | `bea090a6-4c6c-45b1-92e0-83678c687578` | active/trial |
| Pipeline A `SECURITY_TEST_PIPELINE_ORG_A` | `d1f1c882-6769-49d6-a9ca-9de75aeb30f5` | is_primary=false, pipeline_type=sales |
| Pipeline B `SECURITY_TEST_PIPELINE_ORG_B` | `0526054f-d41d-485c-b669-6f6235b6f992` | is_primary=false, pipeline_type=sales |
| Stage A `SECURITY_TEST_STAGE_ORG_A_INITIAL` | `18208f58-29b3-4e34-99bb-613751659bc7` | not won/lost/qualified |
| Stage B `SECURITY_TEST_STAGE_ORG_B_INITIAL` | `7efae798-823e-4521-a9bc-959ba1551e48` | not won/lost/qualified |
| 12 usuários sintéticos (6 por org) | UUIDs consolidados em `single-project-cleanup-runbook-v1.md` | active |

Confirmações adicionais:

- Nenhuma fixture soft-deletada.
- 6 policies em `public.opportunities` sem mudança desde CHG-011.
- 16 triggers sem alteração; nenhum novo adicionado.
- `status='new'` não alcança `net.http_post` / pg_net / e-mail / Slack / webhook / Edge Function / integração externa.
- `trg_segment_benchmark_refresh` continua condicionado exclusivamente a status won/lost.

Baseline registrado (ver seção 5).

---

## 2. RPC temporária (Fase B)

`public.nsec12_probe_insert_opportunity(p_organization_id text, p_pipeline_id text, p_stage_id text, p_title text) RETURNS text`

- `SECURITY INVOKER` (nunca DEFINER) — `prosecdef=false` confirmado em `pg_proc`.
- `SET search_path = public`.
- `REVOKE ALL FROM PUBLIC` / `GRANT EXECUTE TO authenticated`.
- Sem SQL dinâmico; sem DDL; sem UPDATE/DELETE; sem HTTP/pg_net.
- Não recebe `account_id`, `contact_id` ou `status` como parâmetro.
- Guards: caller ∈ 12 UUIDs sintéticos; org ∈ {A,B}; pipeline (se não NULL) ∈ {A,B}; stage (se não NULL) ∈ {A,B}; título prefixado `SECURITY_TEST_OPPORTUNITY_CANARY_`; role JWT `authenticated`.
- Payload interno fixo: `status='new'`, `automation_enabled=false`, `account_id=NULL`, `contact_id=NULL`, `source_opportunity_id=NULL`, `accepted_proposal_id=NULL`, `loss_reason_id=NULL`, `client_loss_reason_id=NULL`, `qualified_at=NULL`, `deleted_at=NULL`.
- `owner_user_id := auth.uid()` — default seguro necessário para evitar `not_null_violation` no gatilho `notify_opportunity_changes → create_system_notification → notifications.user_id NOT NULL`. Não representa relaxamento de guard; apenas destinatário da notificação disparada.
- Rollback interno: INSERT em sub-bloco PL/pgSQL seguido de `RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE='P0001'`. Toda a transação (opportunity + triggers + filas + histories) é revertida via `EXCEPTION WHEN sqlstate 'P0001'`. Códigos retornados: `ALLOWED_ROLLED_BACK`, `BLOCKED_RLS`, `BLOCKED_CHECK`, `BLOCKED_CONSTRAINT`, `REJECTED_*`, `UNEXPECTED_ERROR`.

**Rollback DDL da RPC (executar após aprovação de correções ou reprobes):**

```sql
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity(text, text, text, text);
```

A RPC permanece instalada porque SEC-013/SEC-014/SEC-015 ficaram OPEN e demandarão reprobes.

---

## 3. Transporte

- JWTs emitidos via edge function `nsec12-provision-fixtures` (`action=issueToken`) — mesma metodologia CHG-005/CHG-010.
- Header `Authorization: Bearer <JWT sintético>` em cada request.
- Header `apikey: <publishable key>` (não service role).
- **Zero uso de service role no Authorization** verificado ao longo dos 12 probes.

---

## 4. Resultados dos 12 probes (Fase C)

| # | Probe | Ator | Payload (Org / Pipeline / Stage) | Esperado | Resultado | Status |
|---|---|---|---|---|---|---|
| P1  | same-org A                      | Owner A  | A / A / A       | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` | ✅ |
| P2  | same-org B                      | Owner B  | B / B / B       | `ALLOWED_ROLLED_BACK` | `ALLOWED_ROLLED_BACK` | ✅ |
| P3  | organization cross A→B          | Owner A  | B / A / A       | `BLOCKED_RLS`         | `BLOCKED_RLS`         | ✅ |
| P4  | organization cross B→A          | Owner B  | A / B / B       | `BLOCKED_RLS`         | `BLOCKED_RLS`         | ✅ |
| P5  | viewer A same-org               | Viewer A | A / A / A       | `BLOCKED_RLS`         | `ALLOWED_ROLLED_BACK` | ❌ SEC-013 |
| P6  | viewer B same-org               | Viewer B | B / B / B       | `BLOCKED_RLS`         | `ALLOWED_ROLLED_BACK` | ❌ SEC-013 |
| P7  | pipeline cross-tenant isolado A | Owner A  | A / B / NULL    | BLOCKED_*             | `ALLOWED_ROLLED_BACK` | ❌ SEC-014 |
| P8  | pipeline cross-tenant isolado B | Owner B  | B / A / NULL    | BLOCKED_*             | `ALLOWED_ROLLED_BACK` | ❌ SEC-014 |
| P9  | stage cross-tenant isolada A    | Owner A  | A / NULL / B    | BLOCKED_*             | `ALLOWED_ROLLED_BACK` | ❌ SEC-015 |
| P10 | stage cross-tenant isolada B    | Owner B  | B / NULL / A    | BLOCKED_*             | `ALLOWED_ROLLED_BACK` | ❌ SEC-015 |
| P11 | pipeline+stage incompatíveis A  | Owner A  | A / A / B       | BLOCKED_*             | `BLOCKED_CHECK`       | ✅ |
| P12 | pipeline+stage incompatíveis B  | Owner B  | B / B / A       | BLOCKED_*             | `BLOCKED_CHECK`       | ✅ |

Todas as requisições retornaram HTTP 200; nenhuma retornou UUID, JWT, secret, row completa, SQL ou mensagem não sanitizada.

Dimensões avaliadas:

- Same-org (P1/P2): **OK** — INSERT válido permitido para owners e desfeito.
- Organization cross-org (P3/P4): **OK** — RLS `WITH CHECK` bloqueou.
- Viewer (P5/P6): **FALHA lógica** — role escalation em INSERT, análoga a SEC-011/SEC-012.
- Pipeline cross-tenant (P7/P8): **FALHA lógica** — `pipeline_id` não é validado contra `organization_id` do payload.
- Stage cross-tenant (P9/P10): **FALHA lógica** — mesma ausência de validação para `stage_id`.
- Pipeline/Stage compatibility (P11/P12): **OK** — combinação incompatível dentro do mesmo tenant é rejeitada (`BLOCKED_CHECK`), provavelmente pelo trigger `sync_prob_on_stage_change` / consistência stage→pipeline.

---

## 5. Baseline pré/pós

| Métrica | Pré | Pós | Δ | Observação |
|---|---:|---:|---:|---|
| opportunities totais                     | 2.616  | 2.616  | 0   | ✅ zero persistência |
| opportunities ativas (`deleted_at IS NULL`) | 2.213  | 2.213  | 0   | ✅ |
| opportunities sintéticas nas orgs A/B    | 0      | 0      | 0   | ✅ |
| títulos `SECURITY_TEST_OPPORTUNITY_CANARY_%` | —  | 0      | 0   | ✅ |
| system_events                            | 19.488 | 19.488 | 0   | ✅ |
| audit_log                                | 34.612 | 34.612 | 0   | ✅ |
| entity_snapshots                         | 46.163 | 46.163 | 0   | ✅ |
| revenue_events                           | 33.684 | 33.684 | 0   | ✅ |
| opportunity_stage_history                | 3.859  | 3.859  | 0   | ✅ |
| notifications                            | 22.424 | 22.424 | 0   | ✅ |
| interactions                             | 7.462  | 7.462  | 0   | ✅ |
| workflow_executions                      | 1.627  | 1.627  | 0   | ✅ |
| opportunity_score_recalc_queue           | 223.371| 223.402| +31 | ⚠️ atividade de produção concorrente; ver nota |
| nrhs_recalc_queue                        | 227.089| 227.120| +31 | ⚠️ idem |

**Nota sobre as filas:** o rollback interno impede persistência de qualquer opportunity da canary; os incrementos de +31 correspondem à janela de ~90 s de execução em que operações reais da produção geraram enfileiramentos de recálculo. Nenhum dos 62 novos registros faz referência às fixtures sintéticas nem aos títulos `SECURITY_TEST_OPPORTUNITY_CANARY_%`.

Fixtures inalteradas:
- Pipelines A/B com nomes originais.
- Stages A/B com nomes originais.
- Nenhuma opportunity criada em Org A/Org B.

---

## 6. Smoke read-only

- `pipelines` e `stages` reais continuam listáveis com counts idênticos.
- Consulta a `opportunities` reais retorna baseline preservado (2.213 ativas).
- Nenhum erro novo de RLS em `pg_stat_statements` referente aos endpoints da canary.
- Fixtures sintéticas invisíveis para organizações reais (mesmas policies de CHG-012).
- Nenhuma oportunidade real editada ou criada.

---

## 7. Findings

| Finding | Status | Origem |
|---|---|---|
| **SEC-013** – Viewer com INSERT em `public.opportunities` | **CONFIRMADO / OPEN** | P5, P6 |
| **SEC-014** – `pipeline_id` sem validação tenant-aware | **NOVO / OPEN** | P7, P8 |
| **SEC-015** – `stage_id` sem validação tenant-aware | **NOVO / OPEN** | P9, P10 |

Correção não executada nesta mudança (conforme mandato). Detalhes de classificação e fix recomendado registrados em `docs/security/security-findings-v1.csv`.

Notas sobre correções futuras (não aplicadas):

- SEC-013 → policy RESTRICTIVE análoga a `nsec12_accounts_insert_block_viewer` / `nsec12_contacts_insert_block_viewer`.
- SEC-014 → policy RESTRICTIVE ou trigger BEFORE INSERT/UPDATE comparando `pipelines.organization_id` ao `opportunities.organization_id`.
- SEC-015 → policy RESTRICTIVE ou trigger análogo para `stages.organization_id`.
- P11/P12 mostram que a incompatibilidade pipeline↔stage dentro do mesmo tenant já é barrada; a validação cross-tenant precisa ser adicionada explicitamente.

---

## 8. Estado da RPC

- `nsec12_probe_insert_opportunity(text, text, text, text)` **PERMANECE INSTALADA** — remoção condicionada à correção e reprobes de SEC-013/SEC-014/SEC-015.
- Rollback DDL: `DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity(text, text, text, text);`

---

## 9. Dados reais

- Zero opportunities reais criadas, editadas ou removidas.
- Zero pipelines reais alterados.
- Zero stages reais alteradas.
- Zero accounts / contacts / proposals tocados.
- Zero egress externo disparado.
- Zero uso de service_role no Authorization.

---

## 10. Decisão final

**`OPPORTUNITIES INSERT CANARY FAILED`**

Justificativa: a metodologia funcionou (rollback íntegro, zero persistência, zero dado real alterado, guards intactos), mas três falhas lógicas de segurança foram descobertas (SEC-013, SEC-014, SEC-015). Same-org owner + organization cross-org + incompat pipeline/stage estão OK. Viewer, pipeline cross-tenant e stage cross-tenant estão ABERTOS.

Matriz completa de papéis, `account_id`, `contact_id`, UPDATE e DELETE **não** foram executados — reservados para próximas mudanças autorizadas.

---

## 11. Próximos passos sugeridos (não executados)

1. Autorizar CHG-014 para aplicar policy RESTRICTIVE contra viewer INSERT (SEC-013) e reprobar P5/P6.
2. Autorizar CHG-015 para introduzir validação tenant-aware de `pipeline_id` e `stage_id` (SEC-014/SEC-015) via trigger BEFORE INSERT/UPDATE ou policy RESTRICTIVE — reprobar P7–P10.
3. Após reprobes verdes, autorizar remoção da RPC canary.
4. Só então avançar para matriz completa de papéis, `account_id`/`contact_id`, UPDATE e DELETE.
