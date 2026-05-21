## P0: Fonte única de valor aprovado em oportunidades ganhas

### Objetivo
Garantir que toda a stack (Dados do Deal, Aba Propostas, Forecast, Relatórios, Comissão, Dashboards) leia o valor aprovado **da proposta vencedora** (`proposals.approved_amount`) quando `opportunity.accepted_proposal_id` existir. Caso SQUADRA deve convergir para R$ 1.516,32.

---

### 1. Helper central (TS)
Criar `src/lib/proposals/resolveApprovedCommercialAmount.ts`:
```ts
resolveApprovedCommercialAmount(opportunity, proposal) → {
  approved_commercial_amount: number,
  source: 'approved_amount' | 'approved_payment_schedule' | 'approval_snapshot'
        | 'pricing_ledger' | 'opportunity_value_legacy' | 'zero',
  warnings: string[],
  is_final_approved_value: boolean,
}
```
Ordem exata do brief (approved_amount → schedule → snapshot líquido → ledger → opp.value).

### 2. Helper SQL espelho
Função `public.resolve_approved_commercial_amount(opp_id uuid)` retornando `(amount numeric, source text, is_final boolean)` — usada por view/RPC/forecast.

### 3. View canônica
`public.commercial_won_revenue_view` com os campos do brief (approved_amount + amount_source + legacy_opportunity_value + delta). Filtra `status = 'won'` ou pipelines operacionais com `accepted_proposal_id` not null, exclui soft-deleted.

### 4. UI — Dados do Deal
Em `OpportunityDealCard` (ou componente equivalente do card "Dados do Deal"): se `accepted_proposal_id` existir, exibir `approved_commercial_amount` como valor principal e adicionar linha secundária "Valor original: R$ X" quando divergir.

### 5. UI — Aba Propostas operacional
Em `OpportunityProposalsTab.tsx` modo "inherited", trocar o "Valor aprovado" exibido pelo retorno de `resolveApprovedCommercialAmount`. Não buscar mais `total_amount`/`net_total` para a herdada.

### 6. Forecast / Relatórios / Comissão / Dashboards
- Migrar hooks/services que calculam receita ganha para usar `commercial_won_revenue_view.approved_amount`:
  - `useUnifiedWonRevenueV2` → trocar fonte interna da view `v_unified_won_revenue_v2`/RPC para herdar de `commercial_won_revenue_view`.
  - `mapForecastV2` / edge `report_forecast_v2`: closed_revenue passa a vir de approved_amount.
  - Relatórios V2 (`mapSummaryV2`, `mapStagesV2`, `mapTeamV2`, `mapAccumulatedV2`, etc.) lerem do mesmo source via `v_opportunity_amounts_v2` ajustada para preferir `approved_amount` quando existir.
  - Serviço de comissão (`src/services/...`) usar a view.

Em vez de duplicar lógica, **ajustar a view `v_opportunity_amounts_v2`** (que já é fonte canônica) para priorizar `proposals.approved_amount` quando `opportunity.accepted_proposal_id` existir. Isso propaga para todos os relatórios V2 sem mudar 30 hooks.

### 7. Backfill RPCs (admin-only, sem auto-apply)
- `dry_run_sync_won_opportunity_values_from_approved_proposals(p_organization_id, p_start, p_end)` → tabela com opp_id, proposal_id, cliente, valor_atual, valor_aprovado, delta, vendedor, pipeline, won_at.
- `sync_won_opportunity_value_from_approved_proposal(p_opportunity_id uuid)` → valida, faz `UPDATE opportunities SET value = approved_amount`, registra before/after em `system_events`. NÃO toca proposta, snapshot, PDF, ERP, Pix.

### 8. Validações obrigatórias
- SQUADRA opp operacional → 1.516,32 em Deal Card, Aba Propostas, view.
- OGGI → 2.542,35.
- DU PRATA → 1.894,30 (se for approved_amount).
- Typecheck + build.

---

### Arquivos a criar/editar

**Criar:**
- `src/lib/proposals/resolveApprovedCommercialAmount.ts`
- Migration: helper SQL + view + 2 RPCs backfill + ajuste em `v_opportunity_amounts_v2`

**Editar:**
- `src/components/opportunity/OpportunityProposalsTab.tsx` (valor inherited)
- Componente do card "Dados do Deal" (a identificar via grep)
- `src/hooks/useUnifiedWonRevenueV2.ts` (apenas se a view subjacente precisar de fix)
- Nenhuma mudança em código de Pix/ERP/Slack/PDF

### Riscos
- Mudar `v_opportunity_amounts_v2` impacta todos relatórios. Mitigação: a regra nova é **aditiva** — só altera quando `accepted_proposal_id` + `approved_amount` existem. Status pré-aprovação fica idêntico.
- Backfill é manual; nenhum dado é alterado sem ação do usuário.
- Não há mudança em proposals.approved_amount, snapshot, PDF, ERP.

### Próximos passos após aprovação
1. Criar helper TS.
2. Migration: SQL helper + view + ajuste `v_opportunity_amounts_v2` + 2 RPCs.
3. Editar Aba Propostas (inherited mode) e Deal Card.
4. Validar SQUADRA via `supabase--read_query`.
