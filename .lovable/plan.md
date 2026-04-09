
Objetivo: tornar o valor líquido final a única referência visual para proposta e deal em todo o CRM. Regra: se houver desconto, todo campo de “valor total” deve exibir valor com desconto; apenas campos explicitamente mensais/MRR continuam mostrando valor mensal.

Diagnóstico confirmado no código:
1. A persistência principal já foi parcialmente corrigida:
- `src/services/supabase/proposal-items.ts` calcula desconto de condição de pagamento.
- `src/services/supabase/proposals.ts` já grava `proposals.total_amount`, `proposals.value` e sincroniza `opportunities.valor_previsto`.

2. Ainda existem dois problemas estruturais:
- Há telas que ainda leem campos legados ou potencialmente desatualizados, como `proposal.value`.
- O fluxo de salvamento em `src/pages/ProposalEditor.tsx` está na ordem errada: salva itens, recalcula totais e sincroniza o deal antes de salvar `proposal_payment_terms`. Isso faz o desconto não entrar no valor persistido na primeira gravação/edição.

3. Pontos visuais já identificados com risco de mostrar valor bruto:
- `src/components/proposals/ProposalViewModal.tsx` usa `proposal.value`.
- `src/pages/ProposalPublicView.tsx` usa `proposal.value || proposal.total_amount` em gravações de `final_value`.
- `src/components/opportunity/sidebar/SidebarDataSection.tsx` e `src/components/OpportunityModal.tsx` exibem `opportunity.valor_previsto`, então dependem da sincronização correta.
- Outras listas já usam `proposal.total_amount`, mas precisam entrar na revisão final para garantir padrão único.

Plano de ajuste urgente:
1. Definir a fonte única de verdade
- Proposta: `proposals.total_amount` como valor líquido final exibido.
- Deal/oportunidade: `opportunities.valor_previsto` como espelho do valor líquido final da proposta aceita.
- MRR: continuar vindo de `proposal_payment_terms.monthly_value` apenas em campos explicitamente mensais.

2. Corrigir a ordem de persistência
- Em `src/pages/ProposalEditor.tsx`, mudar a sequência para:
  1) salvar itens
  2) salvar condições de pagamento
  3) `updateProposalTotals`
  4) `syncOpportunityValue`
- Aplicar a mesma regra em qualquer fluxo alternativo de edição de proposta, incluindo `src/components/proposals/ProposalEditorModal.tsx` se estiver ativo no produto.
- Se necessário, criar um helper único de recálculo para evitar divergência entre telas e fluxos.

3. Padronizar todas as telas para valor líquido
- Substituir leituras de `proposal.value` por `proposal.total_amount` nos componentes de proposta.
- Remover fallback prioritário para `proposal.value` onde ele puder reintroduzir valor bruto.
- Revisar os principais pontos de exibição:
  - `src/components/proposals/ProposalViewModal.tsx`
  - `src/pages/ProposalPublicView.tsx`
  - `src/components/opportunity/sidebar/SidebarDataSection.tsx`
  - `src/components/OpportunityModal.tsx`
  - `src/pages/Proposals.tsx`
  - `src/components/proposals/ProposalsList.tsx`
  - `src/components/opportunity/OpportunityProposalsTab.tsx`
  - `src/components/opportunity/OpportunityAnalyticsTab.tsx`
- Regra visual:
  - “Valor Total”, “Valor da Proposta”, “Valor do Deal”, “Valor Avulso” em deals 100% avulsos: sempre líquido.
  - “MRR” continua mensal e separado.

4. Corrigir gravações derivadas e histórico
- Em `src/pages/ProposalPublicView.tsx`, gravar `final_value` com o valor líquido canônico, não com `proposal.value`.
- Revisar qualquer metadata/timeline/notificação interna que ainda salve ou exiba `proposal_value` legado.

5. Fazer reconciliação dos dados já afetados
- Executar uma correção em lote para propostas com desconto:
  - recalcular `subtotal`, `discount_amount`, `total_amount`, `value`
  - ressincronizar `opportunities.valor_previsto` e `commission_value`
- Opcional, mas recomendado: ajustar metadados recentes de eventos/histórico que tenham salvo o valor bruto.

6. Validação final obrigatória
- Testar 3 cenários:
  1) proposta avulsa com desconto
  2) proposta mista (avulso + MRR) com desconto só no avulso
  3) proposta sem desconto
- Conferir consistência entre:
  - página pública da proposta
  - modal/lista de propostas
  - sidebar “Dados do Deal”
  - dashboard
  - forecast/relatórios
  - histórico do deal
- Critério de aceite: o mesmo valor líquido final deve aparecer em todas as telas que representem total de proposta/deal.

Resultado esperado:
- Nenhuma página exibirá valor bruto quando houver desconto.
- O valor fechado ficará consistente entre proposta, deal, dashboard, forecast, relatórios e histórico.
- O desconto deixará de ser apenas “visual” e passará a governar persistência, sincronização e exibição ponta a ponta.
