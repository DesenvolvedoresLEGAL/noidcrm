
## Plano de Correção: Consistência de Valores — IMPLEMENTADO ✅

### Correções aplicadas:

1. **Ordem de persistência corrigida** em `ProposalEditor.tsx`: items → payment terms → updateProposalTotals → syncOpportunityValue

2. **Todas as UIs agora priorizam `total_amount`** (valor líquido com desconto):
   - `ProposalViewModal.tsx`
   - `ProposalPublicView.tsx` (final_value)
   - `OpportunityProposalsTab.tsx` (KPIs e cards)
   - `ProposalsList.tsx` (já usava total_amount)

3. **Edge functions corrigidas** para priorizar `total_amount` sobre `value`:
   - `generate-acceptance-proof` (histórico, win/loss, contrato, comprovante)
   - `handle-proposal-decline` (win/loss, audit log, notificações)

4. **Dados reconciliados**:
   - PROP-2026-00282: desconto 10% aplicado (R$1.800 → R$1.620)
   - Oportunidade vinculada: valor_previsto e commission_value atualizados

### Fonte de verdade definida:
- **Proposta**: `proposals.total_amount` = valor líquido final
- **Oportunidade**: `opportunities.valor_previsto` = espelho do total_amount
- **MRR**: `proposal_payment_terms.monthly_value` (separado)
