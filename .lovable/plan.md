
Plano urgente de correção total da inconsistência de valores

Diagnóstico confirmado
- O problema não está só na exibição: vários registros continuam gravados com valor bruto no banco.
- Exemplo real do print: `PROP-2026-00511 / GLORYSTAR NA FEIMEC`
  - `proposal_payment_terms.discount_percent = 10`
  - subtotal avulso = `R$ 3.994,00`
  - valor correto = `R$ 3.594,60`
  - hoje no banco ainda está:
    - `proposals.total_amount = 3994`
    - `proposals.value = 3994`
    - `opportunities.valor_previsto = 3994`
- Isso explica por que proposta, sidebar, card do pipeline e total da etapa continuam errados.

Causa raiz
1. Há propostas antigas/afetadas ainda não reconciliadas no banco.
2. O `ProposalEditorModal.tsx` ainda está incompleto: ele salva cabeçalho da proposta, mas não persiste corretamente itens + condições de pagamento + recálculo + sync do deal.
3. A UI do pipeline/sidebar usa `opportunity.valor_previsto`; então, se esse campo estiver errado no banco, tudo continua errado.
4. Ainda existem pontos de UI e histórico usando campos legados/fallbacks que podem reintroduzir valor bruto.

Ajuste a implementar agora
1. Reconciliação em lote no banco
- Recalcular todas as propostas com `proposal_payment_terms.discount_percent > 0`
- Atualizar para cada proposta:
  - `subtotal`
  - `discount_amount`
  - `total_amount`
  - `value`
- Ressincronizar oportunidade vinculada:
  - `valor_previsto`
  - `commission_value`
- Prioridade: incluir imediatamente as propostas já identificadas erradas:
  - `PROP-2026-00511`
  - `PROP-2026-00510`
  - `PROP-2026-00508`
  - `PROP-2026-00506`
  - `PROP-2026-00445`
  - `PROP-2026-00279`
  - `CS-PROP-2026-00282`

2. Blindar a persistência
- Revisar `src/pages/ProposalEditor.tsx` para garantir recálculo/sync sempre, inclusive quando:
  - houver desconto
  - não houver itens novos
  - houver alteração só nas condições de pagamento
- Corrigir `src/components/proposals/ProposalEditorModal.tsx` para seguir o mesmo fluxo correto:
  - salvar proposta
  - salvar itens
  - salvar payment terms
  - `updateProposalTotals`
  - `syncOpportunityValue`
- Se o modal estiver obsoleto, desativar seu uso até ficar consistente.

3. Padronizar fonte de verdade visual
- Proposta: sempre exibir `proposals.total_amount`
- Deal/Card/Pipeline: sempre exibir `opportunities.valor_previsto`
- MRR: apenas campos mensais continuam usando `monthly_value`
- Remover fallback prioritário para `proposal.value` em telas de proposta e histórico.

4. Corrigir telas afetadas pelo print
- `src/components/opportunity/sidebar/SidebarDataSection.tsx`
  - manter leitura do deal, mas após correção do banco/sync mostrar o valor líquido correto
  - opcionalmente bloquear edição manual de `valor_previsto` quando houver proposta vinculada, para evitar nova divergência
- `src/components/OpportunityCard.tsx`
  - card do pipeline deve refletir o valor líquido do deal
- `src/components/KanbanColumn.tsx`
  - total da etapa ficará correto automaticamente após corrigir `valor_previsto`
- `src/components/opportunity/OpportunityProposalsTab.tsx`
  - garantir uso estrito de `proposal.total_amount`
- `src/components/proposals/ProposalViewModal.tsx`
  - remover fallback bruto
- `src/pages/ProposalPublicView.tsx`
  - garantir uso do valor líquido em `final_value` e exibição

5. Corrigir histórico e metadados
- Revisar eventos/timeline que usam `meta.proposal_value`
- Novos eventos devem gravar sempre valor líquido
- Se houver eventos recentes críticos com valor bruto, ajustar em lote os principais registros afetados

Validação obrigatória
- Testar no caso GLORYSTAR:
  - proposta mostra `R$ 3.594,60`
  - sidebar “Valor Avulso” mostra `R$ 3.594,60`
  - card no pipeline mostra `R$ 3.594,60`
  - total da etapa/pipeline reflete esse valor líquido
- Testar também:
  - proposta avulsa com desconto
  - proposta mista com desconto só no avulso
  - proposta sem desconto
- Conferir consistência entre:
  - página da proposta
  - aba Propostas do deal
  - sidebar Dados do Deal
  - card do pipeline
  - total da etapa
  - dashboard/forecast/relatórios

Resultado esperado
- O valor líquido final passa a ser a única referência em todo o CRM.
- Quando houver desconto, nenhuma tela exibirá valor bruto.
- GLORYSTAR e os demais casos já afetados ficarão corrigidos no banco e refletidos em todas as páginas.
