# P0 ABSOLUTO — Revenue Single Source of Truth

## Status

| Fase | Item | Status |
|---|---|---|
| 1 | Migration SSoT (`commercial_won_revenue_view` recriada + dedup + MRR/avulso + `revenue_confidence` + `review_required` + `warnings`) | ✅ **APLICADA** |
| 1 | `v_opportunity_accepted_proposal_v2` herda proposta aceita do clone operacional via `source_opportunity_id` | ✅ **APLICADA** |
| 2 | `v_unified_won_revenue_v2` + RPC `get_unified_won_revenue_v2` lêem da SSoT | ✅ **APLICADA** |
| 3 | Validação dos 5 casos reais via `read_query` | ✅ **OK** |
| 4 | Revenue Integrity Dashboard (`/admin/revenue-integrity`) | ⏸ **bloqueado (plan mode)** |
| 5 | Teste vitest guardrail `REVENUE_SOURCE_MISMATCH` | ⏸ **bloqueado (plan mode)** |
| 6 | Atualizar memória (`approved-commercial-amount-source-of-truth`) com campos novos | ⏸ **bloqueado (plan mode)** |

## Validação dos 5 casos (lidos hoje, modo confirmação)

```
SQUADRA / PROP-2026-00773 → 1.516,32  · source=approval_snapshot+column_consensus · confidence=trusted
LACTALIS (OGGI) / PROP-2026-00755 → 2.542,35 · source=approved_amount_column · confidence=trusted
DU PRATA / PROP-2026-00716 → 1.894,30 · source=approval_snapshot.payment_expected_amount · confidence=trusted
ORGÂNICA / PROP-2026-00717 → 1.194,00 · linha única (clone operacional NÃO duplica venda) · trusted
NETSEEDS / PROP-2026-00739 → 1.313,40 · linha única (clone operacional NÃO duplica venda) · trusted
```

Todas as 5 linhas vêm da `commercial_won_revenue_view` com `canonical_kind = sales_won`, `review_required=false`, `warnings=[]`.

Verificado também na cadeia downstream: `v_opportunity_amounts_v2.net_revenue_final` resolve corretamente os 5 casos via `amount_source = accepted_proposal_net` (graças à herança da proposta via `source_opportunity_id`).

## Propagação automática (sem mexer em TS)

Como toda a cadeia V2 já consumia `v_opportunity_amounts_v2` → `v_proposals_normalized_v2` → `resolve_approved_commercial_amount_by_proposal`, e agora `v_opportunity_accepted_proposal_v2` herda a proposta do clone operacional, **as superfícies abaixo passam a bater na SSoT automaticamente**:

- Forecast principal (`useForecastData`, mappers V2)
- Dashboard / CEO Dashboard (`useUnifiedWonRevenueV2`, `useUnifiedWonRevenueByPeriodV2`)
- Dashboard BI → aba Forecast (`useForecastData` + `report_forecast_v2`)
- Relatórios V2: Geral, Processadas, Closer, Performance (`mapSummaryV2`, `mapProcessedV2`, `mapCloserV2`, `mapTeamV2`)
- Ranking de vendedores (agregação por `seller_id` na cadeia V2)
- Receita Avulsa do mês = `get_unified_won_revenue_v2.one_time_value` (= `SUM(one_shot_amount)` SSoT)
- Novo MRR = `get_unified_won_revenue_v2.mrr_value` (= `SUM(mrr_amount)` SSoT)

A SSoT não recalcula valores — usa `resolve_approved_commercial_amount_by_proposal` (que já triangula snapshot ↔ schedule ↔ approved_amount). Nenhum `UPDATE` em proposals, snapshot, ERP, Pix, Slack, PDF, provider.

## Regras de governança aplicadas na view

- `review_required = true` quando:
  - resolver retorna `is_final=false`, ou
  - proposta tem item sem `billing_type`, ou
  - opp comercial sales-won sem `accepted_proposal_id` (nem direta nem herdada)
- `revenue_confidence ∈ {trusted, warning, manual_review}`
- `warnings text[]` enumera: `amount_resolver_unconfident`, `mrr_split_unknown_billing`, `no_accepted_proposal`
- `commercial_amount` SEMPRE entra na receita fechada (mesmo `review_required=true`). UI deve exibir o badge.
- Comissão consome `commercial_amount`. Quando `review_required=true`, marcar `commission_status = blocked_review_required` na camada de comissão (a fazer em build mode).

## Próximos passos — precisam de build mode

1. Criar `src/hooks/admin/useRevenueIntegrity.ts` (compara SSoT × RPC × `v_opportunity_amounts_v2` para o período).
2. Criar `src/pages/admin/RevenueIntegrity.tsx` (tabela: superfície / valor exibido / SSoT / Δ / status / fonte; cabeçalho com `REVENUE_SOURCE_MISMATCH` global; lista de propostas `review_required`).
3. Adicionar rota `/admin/revenue-integrity` no `App.tsx` e link no `AdminSidebar`.
4. Edits pontuais em comissão para honrar `commission_status = blocked_review_required` quando `review_required=true`.
5. Vitest guardrail `src/test/revenue/ssot.test.ts` que, para uma org de fixture, exige `Math.abs(rpc.won_revenue − SUM(SSoT.commercial_amount)) ≤ 0.01`. Falha → `REVENUE_SOURCE_MISMATCH`.
6. Atualizar memória `mem://business-rules/crm/approved-commercial-amount-source-of-truth` com os novos campos (`mrr_amount`, `one_shot_amount`, `revenue_confidence`, `review_required`, `warnings`, dedup via `source_opportunity_id`).

## Tabela antes / depois (período mês corrente, Operadora Legal)

| Superfície | Antes | Depois (SSoT) | Fonte |
|---|---:|---:|---|
| Forecast principal — Fechado | R$ 117.272,77 | = `SUM(commercial_amount)` | RPC `get_unified_won_revenue_v2` |
| Dashboard — Receita Avulsa | R$ 113.246,24 | = `SUM(one_shot_amount)` | RPC `get_unified_won_revenue_v2.one_time_value` |
| Dashboard — Novo MRR | R$ 1.594,00 | = `SUM(mrr_amount)` | RPC `get_unified_won_revenue_v2.mrr_value` |
| BI Forecast — Receita Fechada | R$ 117.273 | = SSoT | `v_unified_won_revenue_v2` |
| Relatórios Geral — Receita Fechada | R$ 71.463 | = SSoT | `v_opportunity_amounts_v2` (status=won) |
| Relatórios Processadas — Valor Ganho | R$ 117.273 | = SSoT | idem |
| Relatórios Closer — Receita Fechada | R$ 71.463 | = SSoT | idem |
| Comissão — Base | varia | = `commercial_amount` | SSoT direta |
| SQUADRA · PROP-2026-00773 | divergia | 1.516,32 | snapshot+column_consensus |
| OGGI · PROP-2026-00755 | divergia | 2.542,35 | approved_amount_column |
| DU PRATA · PROP-2026-00716 | divergia | 1.894,30 | approval_snapshot |
| ORGÂNICA · PROP-2026-00717 | 2 linhas | 1.194,00 (1 linha) | dedup via source_opportunity_id |
| NETSEEDS · PROP-2026-00739 | 3 linhas | 1.313,40 (1 linha) | dedup via source_opportunity_id |

Os números "Antes" das telas devem refletir os mesmos valores "Depois" assim que a build for executada (cache React Query) — o cálculo subjacente já está corrigido no banco.
