# Phase 4 — Opportunity Account/Contact Same-Tenant Compatibility Canary v1

**Change ID:** NSEC-1.2-CHG-023
**Classe:** Amarela controlada
**Data (UTC):** 2026-07-21
**Decisão final:** `OPPORTUNITIES ACCOUNT/CONTACT SAME-TENANT CANARY FAILED`

## 1. Contexto

CHG-022 encerrou como `OPPORTUNITY SAME-TENANT MISMATCH FIXTURES PARTIAL`
exclusivamente por conta de uma account duplicada órfã na Org A (retry
operacional). As quatro fixtures oficiais (Account/Contact Base + ALT em
cada tenant) permaneceram íntegras e utilizáveis, permitindo executar a
canary de compatibilidade `account↔contact` **dentro do mesmo tenant**.

## 2. Fixtures oficiais utilizadas

| Tenant | Account Base | Account Alt oficial | Contact Base | Contact Alt oficial |
|---|---|---|---|---|
| Org A (`e1c4881f…bca0`) | `36085a30…d92b` | `14127c66…61af` | `55d589fb…bbf0` (→ Account A Base) | `b1ab7611…d089` (→ Account A Alt) |
| Org B (`bea090a6…7578`) | `b777baac…9f41` | `95585017…da5e` | `47ad14f0…8a27` (→ Account B Base) | `edfd34a3…e0e3` (→ Account B Alt) |

## 3. Registros não-oficiais rejeitados pela RPC

- **Account órfã duplicada Org A** `73dbf1e3…d37f77` — rejeitada por regra literal (`REJECTED_ORPHAN_ACCOUNT`).
- **Contact órfão Org A** `b53de59c…50fcb3` (nome vazio) — rejeitado por regra literal (`REJECTED_ORPHAN_CONTACT`).
Ambos permanecem intocados após a canary.

## 4. Policies relevantes (pré e pós idênticas)

| Policy | Tipo | Cmd |
|---|---|---|
| `nsec12_opportunities_insert_block_viewer` | RESTRICTIVE | INSERT |
| `nsec12_opportunities_insert_tenant_relations_guard` | RESTRICTIVE | INSERT |
| `nsec12_opportunities_insert_account_contact_tenant_guard` | RESTRICTIVE | INSERT |
| `Org members can insert opportunities` | PERMISSIVE | INSERT |
| `Org members insert opportunities` | PERMISSIVE | INSERT |
| `Users can insert org opportunities` | PERMISSIVE | INSERT |
| `Org members update opportunities` | PERMISSIVE | UPDATE |
| `Admins and managers can delete org opportunities` | PERMISSIVE | DELETE |
| `opportunities_select_by_visibility` | PERMISSIVE | SELECT |

Total = 9 policies. **Nenhuma alteração aplicada nesta CHG.**

## 5. Pre-flight

- Fixtures 4/4 accounts e 4/4 contacts íntegras, `deleted_at IS NULL`, com nomes exatos, organização correta e vínculos `contact.account_id` conforme especificação.
- Contact A/B Base → Account A/B Base; Contact A/B Alt → Account A/B Alt.
- Account órfã duplicada continua na Org A sem opportunity/contact vinculado.
- Contact órfão continua com `nome=''` e inalterado.
- Nenhuma RPC prévia iniciada por `nsec12_probe_insert_opportunity_*`.
- Tipos confirmados: `organization_id/account_id/contact_id` = uuid; `pipeline_id/stage_id` = text.
- Baseline pré-canary: 2 627 opportunities totais, 2 224 ativas, 0 sintéticas, 0 títulos `SECURITY_TEST_OPPORTUNITY_MATCH_CANARY_%`.

## 6. RPC temporária

`public.nsec12_probe_insert_opportunity_account_contact_match(uuid,text,text,uuid,uuid,text)`
- `LANGUAGE plpgsql`, `SECURITY INVOKER`, `SET search_path = public`.
- `REVOKE ALL FROM PUBLIC` + `GRANT EXECUTE TO authenticated`.
- Whitelist estrita (callers, orgs, pipelines, stages, accounts, contacts, prefixo obrigatório do título).
- Rejeição explícita dos dois órfãos.
- INSERT dentro de sub-bloco PL/pgSQL seguido de `RAISE EXCEPTION 'NSEC12_ROLLBACK'` — nenhuma linha jamais persiste.
- Códigos permitidos apenas os listados no mandato; nenhum UUID, JWT, SQL ou linha retornado.

**Guards não verificam a regra-alvo:** nenhum SELECT em contacts, nenhuma comparação `contact.account_id` vs `p_account_id`. Os quatro cenários incompatíveis alcançam o INSERT real.

Rollback DDL:
```sql
DROP FUNCTION IF EXISTS public.nsec12_probe_insert_opportunity_account_contact_match(uuid,text,text,uuid,uuid,text);
```

## 7. Transporte

Todos os 14 probes disparados via edge function `nsec12-canary-023`, que:
1. Usa service role **apenas** para mintar tokens password-grant dos 4 usuários sintéticos permitidos (whitelist hardcoded).
2. Chama `POST {SUPABASE_URL}/rest/v1/rpc/nsec12_probe_insert_opportunity_account_contact_match` com `Authorization: Bearer <JWT sintético>` e `apikey: <publishable anon>`.
3. Nunca inclui service role no header de Authorization das chamadas de probe.
4. Não escreve dados reais, não invoca outras RPCs.

## 8. Resultado dos 14 probes

| # | Persona | Org | Account | Contact | Esperado | Obtido |
|---|---|---|---|---|---|---|
| P1 | Owner A | A | A Base | A Base | ALLOWED_ROLLED_BACK | **ALLOWED_ROLLED_BACK** ✅ |
| P2 | Owner A | A | A Alt | A Alt | ALLOWED_ROLLED_BACK | **ALLOWED_ROLLED_BACK** ✅ |
| P3 | Owner B | B | B Base | B Base | ALLOWED_ROLLED_BACK | **ALLOWED_ROLLED_BACK** ✅ |
| P4 | Owner B | B | B Alt | B Alt | ALLOWED_ROLLED_BACK | **ALLOWED_ROLLED_BACK** ✅ |
| P5 | Owner A | A | **A Base** | **A Alt** | BLOCKED_* | **ALLOWED_ROLLED_BACK** ⚠️ |
| P6 | Owner A | A | **A Alt** | **A Base** | BLOCKED_* | **ALLOWED_ROLLED_BACK** ⚠️ |
| P7 | Owner B | B | **B Base** | **B Alt** | BLOCKED_* | **ALLOWED_ROLLED_BACK** ⚠️ |
| P8 | Owner B | B | **B Alt** | **B Base** | BLOCKED_* | **ALLOWED_ROLLED_BACK** ⚠️ |
| P9 | Viewer A | A | A Base | A Base | BLOCKED_RLS | **BLOCKED_RLS** ✅ |
| P10 | Viewer B | B | B Base | B Base | BLOCKED_RLS | **BLOCKED_RLS** ✅ |
| P11 | Owner A | A | **B Base** (cross) | A Base | BLOCKED_* | **BLOCKED_RLS** ✅ |
| P12 | Owner B | B | **A Base** (cross) | B Base | BLOCKED_* | **BLOCKED_RLS** ✅ |
| P13 | Owner A | A | A Base | **B Base** (cross) | BLOCKED_* | **BLOCKED_RLS** ✅ |
| P14 | Owner B | B | B Base | **A Base** (cross) | BLOCKED_* | **BLOCKED_RLS** ✅ |

## 9. Análise dimensional

- **Pares corretos same-tenant (P1–P4):** aceitos e revertidos.
- **Pares incompatíveis same-tenant (P5–P8):** aceitos e revertidos — nenhuma regra de banco verifica que `contacts.account_id` coincide com `opportunities.account_id`.
- **Viewer regression (P9–P10):** SEC-013 mantido — `nsec12_opportunities_insert_block_viewer` bloqueia.
- **Account cross-tenant (P11–P12):** SEC-016 mantido — `nsec12_opportunities_insert_account_contact_tenant_guard` bloqueia.
- **Contact cross-tenant (P13–P14):** SEC-017 mantido — `nsec12_opportunities_insert_account_contact_tenant_guard` bloqueia.

## 10. Baseline pós-canary

| Métrica | Pré | Pós | Δ |
|---|---|---|---|
| opportunities totais | 2 627 | 2 627 | 0 |
| opportunities ativas | 2 224 | 2 224 | 0 |
| opportunities sintéticas (`SECURITY_TEST_%`) | 0 | 0 | 0 |
| canary titles (`SECURITY_TEST_OPPORTUNITY_MATCH_CANARY_%`) | 0 | 0 | 0 |
| Account A Base | ATIVA | ATIVA | 0 |
| Account A Alt oficial | ATIVA | ATIVA | 0 |
| Account B Base | ATIVA | ATIVA | 0 |
| Account B Alt oficial | ATIVA | ATIVA | 0 |
| Account órfã duplicada (Org A) | ATIVA | ATIVA | 0 (não usada) |
| Contact A Base | ATIVO | ATIVO | 0 |
| Contact A Alt oficial | ATIVO | ATIVO | 0 |
| Contact B Base | ATIVO | ATIVO | 0 |
| Contact B Alt oficial | ATIVO | ATIVO | 0 |
| Contact órfão | nome vazio, inalterado | nome vazio, inalterado | 0 |
| Pipelines A/B, Stages A/B | íntegros | íntegros | 0 |
| Policies opportunities | 9 | 9 | 0 |

**Zero persistência. Zero efeito derivado. Zero dado real alterado. Zero egress externo.**

## 11. Smoke read-only

- Tela de oportunidades, empresas, contatos, forecast e Revenue Command carregam sem erro novo.
- Selectors de account/contact carregam normalmente.
- Fixtures oficiais permanecem isoladas por tenant.
- Órfãos continuam sem dependência.
- Nenhum erro novo de RLS observado.

## 12. Estado da RPC e da edge function auxiliar

- RPC `nsec12_probe_insert_opportunity_account_contact_match` **mantida instalada** (mandato: preservar quando P5–P8 são permitidos, para reprobes pós-correção).
- Edge function auxiliar `nsec12-canary-023` mantida junto — será removida em conjunto com a RPC no cleanup final da sprint.

## 13. Findings

- **SEC-013 (viewer INSERT):** permanece `RESOLVED` — P9/P10 bloqueados.
- **SEC-016 (account cross-tenant):** permanece `RESOLVED` — P11/P12 bloqueados.
- **SEC-017 (contact cross-tenant):** permanece `RESOLVED` — P13/P14 bloqueados.
- **SEC-018 (NOVO):** criado, `MEDIUM`, `OPEN`. Combinação account/contact incompatível same-tenant aceita (P5–P8).

## 14. Dados reais intocados

Nenhuma organização, pipeline, stage, account, contact, opportunity, activity, proposal, storage, notification ou usuário real foi acessado, criado, alterado ou removido nesta mudança. Todo o transporte usou fixtures sintéticas identificáveis por prefixo `SECURITY_TEST_*` e usuários `sec-test-*@example.com`.

## 15. Decisão final

**`OPPORTUNITIES ACCOUNT/CONTACT SAME-TENANT CANARY FAILED`**

Motivo exclusivo: P5–P8 retornaram `ALLOWED_ROLLED_BACK`, evidenciando ausência de regra que force `contacts.account_id = opportunities.account_id` no INSERT. Todos os demais eixos (viewer, account cross-tenant, contact cross-tenant, integridade das fixtures, zero persistência, zero egress) atenderam ao critério.

Correção **não executada** conforme escopo. Nenhuma matriz completa, nenhum UPDATE/DELETE, nenhum cleanup executado.
