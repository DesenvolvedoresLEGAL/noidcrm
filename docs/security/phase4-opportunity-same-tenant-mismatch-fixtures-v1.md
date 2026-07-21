# Phase 4 — Opportunity Same-Tenant Mismatch Fixtures (NSEC-1.2-CHG-022)

**Data:** 2026-07-21 · **Classificação:** AMARELA controlada · **Decisão final:** `OPPORTUNITY SAME-TENANT MISMATCH FIXTURES PARTIAL`

## 1. Contexto
Após NSEC-1.2-CHG-021 (matriz account/contact tenant HOMOLOGADA), esta CHG provisiona 4 fixtures alternativas permanentes (2 accounts + 2 contacts) para viabilizar futura canary de incompatibilidade `opportunities.account_id ≠ contacts.account_id` dentro do mesmo tenant. Nenhuma opportunity é criada nesta mudança.

## 2. Objetivo
Criar Account A ALT, Account B ALT, Contact A ALT (vinculado à Account A ALT), Contact B ALT (vinculado à Account B ALT), todas isoladas por tenant.

## 3. Limitação
Não executar opportunities. Não testar hipótese de incompatibilidade account↔contact same-tenant. Não alterar policies, triggers ou schema.

## 4. Pre-flight (read-only)
- Org A `e1c4****bca0`, Org B `bea0****7578`, Owner A `58c9****329b`, Owner B `4ac5****9526` — ativos.
- Account A Base `3608****d92b`, Account B Base `b777****f41` — nomes exatos, `deleted_at IS NULL`.
- Contact A Base `55d5****bbf0` → Account A Base; Contact B Base `47ad****8a27` → Account B Base.
- Contato órfão `b53d****fcb3` — nome vazio, Org A, ligado à Account A Base, intocado.
- Pipelines/Stages sintéticos intactos.
- Policies e triggers de INSERT em `accounts`/`contacts`: proteção `nsec12_*_insert_block_viewer` + tenant-aware de `contacts.account_id` ativas.
- Baseline pré: accounts `SECURITY_TEST_%` = 3 (2 base ativas + 1 soft-deleted não relacionada); contacts `SECURITY_TEST_%` = 2 (bases); opportunities sintéticas = 0.
- Ausência de HTTP/pg_net/webhook em triggers relevantes.

## 5. Accounts-base
Preservadas, sem alterações (§ verificação SQL pós).

## 6. Contacts-base
Preservados; vínculos com respectivas Accounts-base mantidos.

## 7. Estado do órfão
`b53d****fcb3` inalterado — nome vazio, Org A, ligado a Account A Base, NON-FIXTURE / CLEANUP REQUIRED (§6 do runbook).

## 8. Payload Account A ALT
`POST /rest/v1/accounts` · JWT Owner A · `{ razao_social:"SECURITY_TEST_ACCOUNT_ORG_A_ALT", nome_fantasia:"SECURITY_TEST_ACCOUNT_ORG_A_ALT", organization_id:<Org A> }`.

## 9. Resultado Account A ALT
**Nota crítica:** o primeiro `curl` retornou HTTP 201 com UUID `73db****7f77`, mas o filtro `jq` local malformou o parse e o operador reexecutou a chamada por engano — criando um segundo registro homônimo `1412****61af`. Guardrail #10 (mais de duas accounts) + #12 (retry duplicidade) acionados. Nenhum DELETE foi executado (não autorizado). O UUID **oficial** adotado como Account A ALT é `1412****61af`; o registro `73db****7f77` fica marcado como **ORPHAN DUP / CLEANUP REQUIRED** e está registrado no runbook (§8bis).

Oficial:
- `id = 1412****61af`, `razao_social = SECURITY_TEST_ACCOUNT_ORG_A_ALT`, `organization_id = <Org A>`, `deleted_at = null`, `created_by = <Owner A>`.
- Owner A vê; Owner B **não** vê (`[]`).

Órfão dup:
- `id = 73db****7f77`, mesmos campos; sem referências downstream (`opps_touching_alts = 0`).

## 10. Payload Account B ALT
`POST /rest/v1/accounts` · JWT Owner B · `{ razao_social:"SECURITY_TEST_ACCOUNT_ORG_B_ALT", nome_fantasia:"SECURITY_TEST_ACCOUNT_ORG_B_ALT", organization_id:<Org B> }`.

## 11. Resultado Account B ALT
- `id = 9558****da5e`, `organization_id = <Org B>`, `deleted_at = null`, `created_by = <Owner B>`.
- Owner B vê; Owner A **não** vê (`[]`).

## 12. Payload Contact A ALT
`POST /rest/v1/contacts` · JWT Owner A · `{ nome, primeiro_nome, ultimo_nome:null, organization_id:<Org A>, account_id:<Account A ALT oficial> }` com nomes `SECURITY_TEST_CONTACT_ORG_A_ALT`.

## 13. Resultado Contact A ALT
- `id = b1ab****d089`; `nome = primeiro_nome = SECURITY_TEST_CONTACT_ORG_A_ALT`; `ultimo_nome = null`; `organization_id = <Org A>`; `account_id = 1412****61af`; `deleted_at = null`.
- Owner A vê; Owner B **não** vê (`[]`).

## 14. Payload Contact B ALT
`POST /rest/v1/contacts` · JWT Owner B · payload equivalente para Org B / Account B ALT.

## 15. Resultado Contact B ALT
- `id = edfd****e0e3`; nomes exatos; `ultimo_nome = null`; `organization_id = <Org B>`; `account_id = 9558****da5e`; `deleted_at = null`.
- Owner B vê; Owner A **não** vê (`[]`).

## 16. Integridade contact → account
- `ctc_a_alt_link` (`b1ab****d089`.account_id = `1412****61af` ∧ Org A) → **true**.
- `ctc_b_alt_link` (`edfd****e0e3`.account_id = `9558****da5e` ∧ Org B) → **true**.

## 17. Cenários corretos disponíveis
- Account A Base + Contact A Base.
- Account A ALT (`1412****61af`) + Contact A ALT (`b1ab****d089`).
- Account B Base + Contact B Base.
- Account B ALT (`9558****da5e`) + Contact B ALT (`edfd****e0e3`).

## 18. Cenários incompatíveis same-tenant disponíveis
- Account A Base + Contact A ALT.
- Account A ALT + Contact A Base.
- Account B Base + Contact B ALT.
- Account B ALT + Contact B Base.

Todos os componentes de cada par incompatível pertencem à mesma organization_id. **Não executados** nesta CHG.

## 19. Visibilidade cross-org
Todas as consultas por ID retornaram `[]` para o owner do tenant oposto. Nenhuma organização real referenciou as fixtures.

## 20. Efeitos derivados
`opps_touching_alts = 0`. Nenhuma opportunity, activity ou proposal criada. Filas de score/lifecycle não inspecionadas em detalhe (nenhuma escrita adicional autorizada); nenhuma notificação disparada a usuário real. Sem HTTP/pg_net/Slack/e-mail/webhook.

## 21. Baseline pré/pós
| Métrica | Pré | Pós |
|---|---|---|
| accounts `SECURITY_TEST_ACCOUNT_ORG_%` ativas | 2 | **5** (2 base + 2 ALT oficiais + 1 ORPHAN DUP) |
| contacts `SECURITY_TEST_CONTACT_ORG_%` | 2 | 4 (2 base + 2 ALT) |
| contato órfão vazio | 1 | 1 (inalterado) |
| opportunities sintéticas | 0 | 0 |

## 22. Smoke read-only
Não executado UI nesta chamada; validação de isolamento feita exclusivamente via PostgREST com JWTs sintéticos e psql read-only. Sem erros de RLS observados.

## 23. Cleanup runbook
`docs/security/single-project-cleanup-runbook-v1.md` atualizado com UUIDs completos das 4 fixtures ALT oficiais + registro do orphan dup `73db****7f77`.

## 24. Dados reais intocados
Nenhum registro real alterado. Zero egress externo. Zero uso de service role.

## 25. Decisão final
`OPPORTUNITY SAME-TENANT MISMATCH FIXTURES PARTIAL`

Justificativa: as 4 fixtures oficiais (2 accounts + 2 contacts) estão criadas, isoladas por tenant e íntegras — todos os cenários futuros exigidos estão disponíveis. Contudo, o guardrail #10/#12 foi acionado pela criação incidental do orphan `73db****7f77` (retry por parse local errado), o que impede a decisão `READY`. Nenhum cleanup é executado nesta CHG (não autorizado); o orphan está registrado para remoção pós-sprint.
