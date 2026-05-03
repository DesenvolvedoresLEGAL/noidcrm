# Hotfix NRHS 1.4.5 — Recriar `get_nrhs_analytics` do zero, mínima e sem joins

## Causa raiz confirmada

Auditei o schema real:

- `opportunities` **não tem** colunas `value`, `amount`, `name`, `org_id`, `owner_id`. As reais são: `organization_id`, `owner_user_id`, `valor_previsto`, `title`, `account_id`, `stage_id`, `pipeline_id`, `status`, `won_at`, `lost_at`, `closed_at`, `deleted_at`, `created_at`, `updated_at` e os pilares NRHS (`nrhs_score`, `nrhs_tier`, `nrhs_status`, `nrhs_blockers`, `nrhs_issues_count`, `nrhs_data_integrity_score`, `nrhs_cadence_score`, `nrhs_stakeholders_score`, `nrhs_win_loss_score`, `nrhs_process_adherence_score`, `nrhs_evidence_score`, `nrhs_last_calculated_at`).
- A função 1.4.4 quebra com `42702 column reference "value" is ambiguous` porque havia CTEs com colunas internas chamadas `value` colidindo no `jsonb_build_object`.

## Mudança (1 migration)

`DROP FUNCTION public.get_nrhs_analytics(uuid, uuid, boolean, uuid)` e recriar do zero, **mantendo a mesma assinatura** que o frontend já chama (`p_org_id`, `p_owner_id`, `p_only_privileged`, `p_caller_user_id`), preservando o contrato JSON consumido por `src/services/crm/nrhs-analytics.ts` (chaves `summary.{total,nrhs_avg,elite_count,healthy_count,risk_count,critical_count,insalubrious_count,value_at_risk,total_value}`, `distribution[].{tier,count,value}`, `pillars`, `deals`, `owners`).

Regras da nova função:

1. **Sem joins.** Apenas `public.opportunities` + checagem de membro em `public.organization_members` (não é join sobre opportunities).
2. **Sem nested select** no PostgREST.
3. **Sem `CREATE TEMP TABLE` / `CREATE TABLE AS**` — só CTEs.
4. **Sem alias `value**` dentro de qualquer CTE. Internamente uso `deal_amount`, `tier_amount`, `total_amount`, `value_at_risk_amount`, `owner_value_at_risk`. A chave JSON `"value"` aparece **somente** dentro de `jsonb_build_object(...)` no payload final, onde não pode ser ambígua.
5. **Sem coluna inexistente.** `valor_previsto` substitui qualquer `o.value`/`o.amount`. Names de account/owner/stage usam placeholders (`'Conta ' || left(account_id::text,8)`, `'Usuário ' || left(owner_user_id::text,8)`, `'Estágio ' || left(stage_id::text,8)`) — enriquecimento real fica para sprint separada.
6. **Tier derivado em SQL** (`tier_bucket` via `CASE`) — não depende de `nrhs_tier` populado.
7. **Filtros mantidos:** `organization_id = p_org_id`, `deleted_at IS NULL`, `status NOT IN (won/lost/disqualified)`, e `owner_user_id` quando privilegiado/owner solicitado.
8. `**SECURITY DEFINER` + `SET search_path = public**` mantidos.
9. **GRANT** apenas para `authenticated`, `REVOKE FROM PUBLIC`.

## Frontend

Nenhuma mudança. O service `nrhs-analytics.ts` já consome exatamente o payload que a nova função produz (mesmas chaves do contrato 1.4.2/1.4.3/1.4.4).

## Auditoria adicional

- `enqueue_nrhs_recalc_for_filters`: já validada (1.4.3), não usa `o.value`. Sem mudança.
- Edge functions NRHS (`calculate-nrhs`, `process-nrhs-queue`) e hook `useNRHSAnalytics`: não tocam `opportunities.value`. Sem mudança.
- Se grep dentro do escopo NRHS encontrar resíduos `o.value`/`opportunities.value`, troco para `valor_previsto` no mesmo passo.

## Critérios de aceite

- POST `/rpc/get_nrhs_analytics` retorna 200 com `jsonb`.
- Console limpo: sem `42702`, `42703`, `0A000`, `PGRST200`.
- Aba Revenue Hygiene sai do estado de erro.
- Cards e tabela carregam (dados reais ou estado vazio legítimo).
- "Valor em Risco" baseado em `valor_previsto` somado para tiers risk/critical/insalubrious.
- Botão "Atualizar NRHS" continua funcionando.
- Lead Score, Opportunity Score, Forecast, OTE, layout: intactos.

## Fora de escopo

Enriquecer nomes (account/owner/stage), refatorar motor NRHS, mudar fórmula, layout, Forecast, OTE.

&nbsp;

Plano aprovado.

Execute o Hotfix NRHS 1.4.5 exatamente nesse escopo.

Travas obrigatórias:

1. Não usar joins com accounts, profiles, pipeline_stages, pipelines ou users.

2. Usar apenas public.opportunities para analytics, com checagem de membership em public.organization_members.

3. Usar apenas colunas reais:

organization_id, owner_user_id, valor_previsto, title, account_id, stage_id, pipeline_id, status, won_at, lost_at, closed_at, deleted_at, created_at, updated_at e campos NRHS reais.

4. Não usar alias interno chamado value em CTE, subquery ou SELECT intermediário.

5. A chave JSON "value" só pode aparecer dentro do jsonb_build_object final.

6. Manter exatamente a assinatura atual consumida pelo frontend:

public.get_nrhs_analytics(uuid, uuid, boolean, uuid)

7. Não criar nova assinatura paralela.

8. Não alterar frontend.

9. Não alterar Lead Score.

10. Não alterar Opportunity Score.

11. Não alterar Opportunity Indicators.

12. Não alterar Forecast, OTE ou layout.

13. Após migration, testar a RPC diretamente no SQL editor com organization_id real e user_id real.

14. A entrega só está concluída se /rpc/get_nrhs_analytics retornar 200 e o console ficar sem 42702, 42703, 0A000 e PGRST200.

Importante:

Se p_only_privileged = true, validar membership em organization_members.

Se o usuário não tiver acesso, retornar payload vazio seguro no contrato JSON esperado, não erro bruto.