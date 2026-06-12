---
name: Kairós Revenue Attribution (KAI.16)
description: Atribuição GTM origem → receita via kairos_revenue_attribution + commercial_won_revenue_view. Cria registro no promote-to-crm, sync por trigger/edge/cron, nunca duplica receita.
type: architectural-decision
---

# Kairós Revenue Attribution (KAI.16)

**Tabela:** `kairos_revenue_attribution` (uma linha por `opportunity_id`).
**Status enum:** `kairos_attribution_status` (sourced → queued → promoted_to_crm → opportunity_open → proposal_created → proposal_sent → proposal_viewed → won/lost/cancelled).

## Fonte de receita
Sempre `commercial_won_revenue_view` (`commercial_amount`, `valid_revenue_amount`, `won_at`, `is_cancelled_sale`). Kairós **NUNCA** cria nova verdade financeira — apenas atribui origem.

## Ciclo de vida
1. **Promoção** (`kairos-promote-to-crm`): faz UPSERT em `kairos_revenue_attribution` com event/batch/prospect/queue/icp/owner/sdr/apollo. Status inicial `promoted_to_crm`.
2. **Triggers**:
   - `trg_kairos_attr_proposal` em `proposals` (INSERT/UPDATE de sent_at/viewed_at/accepted_at/approved_amount).
   - `trg_kairos_attr_opportunity` em `opportunities` (UPDATE de status/closed_at/accepted_proposal_id/owner_user_id).
   - Ambos chamam `fn_kairos_sync_attribution(opportunity_id)`.
3. **Reconciliação**: edge `kairos-sync-revenue-attribution` (idempotente). Aceita `opportunity_id` específico ou bulk.
4. **Cron**: `kairos-sync-revenue-attribution-daily` às 03:30 BRT (06:30 UTC), processa até 2000 itens.

## View agregada
`kairos_revenue_attribution_summary` agrupa por evento, ICP, batch, owner, sdr e departamento do decisor.

## Regras invioláveis
- Não duplica receita.
- Não altera OTE, Forecast, Vendas Realizadas.
- Receita ganha sempre via `valid_revenue_amount` da view oficial (líquida de cancelamentos).
- Linha só nasce na promoção ao CRM (não para items descartados/em fila).
