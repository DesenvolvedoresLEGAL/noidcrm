# Kairós Revenue Attribution (KAI.16)

Motor que fecha o ciclo **origem → oportunidade → proposta → venda → receita** do Kairós.

## Tabela
`kairos_revenue_attribution` — uma linha por `opportunity_id`. Criada no `kairos-promote-to-crm`.

## Fonte oficial
Receita ganha sempre vem de `commercial_won_revenue_view` (`commercial_amount`, `valid_revenue_amount`, `won_at`, `is_cancelled_sale`).
**Kairós não cria verdade financeira.** Apenas atribui origem.

## Status
sourced · queued · promoted_to_crm · opportunity_open · proposal_created · proposal_sent · proposal_viewed · won · lost · cancelled

## Sincronização
- Trigger em `proposals` → `fn_kairos_sync_attribution(opp)`.
- Trigger em `opportunities` (status/closed_at/owner/accepted_proposal_id) → idem.
- Edge `kairos-sync-revenue-attribution` (idempotente, aceita `opportunity_id` ou bulk).
- Cron diário 03:30 BRT.

## View
`kairos_revenue_attribution_summary` agrupa por evento, ICP, batch, owner, SDR e departamento do decisor.

## UI
Kairós Hub → aba **💰 Revenue Attribution**:
- KPIs: receita atribuída, receita válida, vendas, ticket médio, conversão.
- Funil: atribuições → propostas → enviadas → visualizadas → ganhas.
- Rankings: evento, ICP, batch, departamento, SDR.
- Filtros: período, status. Exportação CSV.

## Garantias
- Não duplica receita.
- Não altera Forecast/OTE/Vendas Realizadas.
- Linha só nasce na promoção ao CRM.
