Plano de correção: transformar o template em orquestrador financeiro da proposta

Arquivos impactados previstos
- `src/pages/ProposalEditor.tsx`
- `src/components/proposals/ProposalPaymentTerms.tsx`
- `src/components/proposals/ProposalDynamicPricingPanel.tsx`
- `src/components/proposals/ProposalVisualizarTab.tsx`
- `src/components/proposals/ProposalPreview.tsx`
- `src/pages/ProposalPublicView.tsx`
- `src/lib/proposalPdfBuilder.ts`
- `src/lib/proposalPdfGenerator.ts`
- `src/services/supabase/proposal-templates.ts`
- `src/services/supabase/proposals.ts`
- `src/services/supabase/proposal-payment-terms.ts`
- `src/services/proposals/proposalDynamicPricing.ts`
- nova migration de banco para orquestração financeira

Diagnóstico principal
- O template selecionado no modal é aplicado apenas no estado visual do editor novo; ao salvar, `createProposal()` não persiste `template_name`, `revenue_type`, `dynamic_pricing_applicability`, `dynamic_pricing_mode`, `payment_mode` nem os defaults comerciais.
- `applyTemplate()` hoje atualiza regras da proposta, mas não cria/upserta a condição financeira padrão.
- A tabela dinâmica depende de geração posterior; não existe um orquestrador único chamado depois de template + validade + itens + totais.
- `ProposalPaymentTerms`, preview, link público e PDF ainda calculam pelo total/base e pelo campo manual de início, não por “valor vigente hoje / cobrança / pagamento”.
- A lista de propostas invalida a lista, mas não invalida consistentemente os detalhes de itens/condições, então o card fica stale até F5.

Implementação proposta

1. Criar um orquestrador financeiro único no backend
- Adicionar função `orchestrate_proposal_financials(proposal_id, reason)`.
- Responsabilidades:
  - Ler a proposta e regras comerciais já copiadas do template.
  - Para templates Evento/ALUGUE Evento:
    - garantir `revenue_type = one_time_event`
    - garantir `dynamic_pricing_applicability = automatic`
    - garantir `dynamic_pricing_mode = automatic_by_valid_until`
    - garantir `payment_mode = one_time`
    - gerar/upsert da condição financeira padrão: Pix, à vista, 1 parcela, sem desconto, vencimento automático hoje.
    - recalcular totais pelos itens.
    - gerar/regenerar as 6 faixas oficiais quando existir validade e total > 0.
    - atualizar `dynamic_pricing_current_amount`, snapshot e `payment_expected_amount` com o valor vigente.
  - Para templates recorrentes/assinatura/serviço:
    - manter tabela dinâmica como não aplicável.
    - não exibir nem criar painel manual de tabela dinâmica.
- A função será segura, com `SECURITY DEFINER` e `search_path = public`.

2. Corrigir aplicação do template ao criar proposta
- No fluxo `Criar proposta -> escolher template -> editor novo`, carregar o template completo no estado do editor.
- Ao salvar uma proposta nova:
  - criar a proposta;
  - aplicar o template persistindo todas as regras comerciais;
  - salvar itens;
  - recalcular totais;
  - chamar o orquestrador;
  - recarregar/invalidate de proposta, itens, payment terms, dynamic pricing e lista.
- Para proposta existente, ao alterar validade ou itens e salvar:
  - salvar dados;
  - salvar itens;
  - recalcular totais;
  - chamar o orquestrador;
  - atualizar estado local sem depender de F5.

3. Condições financeiras automáticas no editor
- Criar helper reutilizável para montar condição padrão do template:
  - Evento: `payment_type = one_time`, `payment_method = pix`, `installments = 1`, `entry_percent = 0`, `first_installment_date = hoje`.
- Ajustar `ProposalPaymentTerms` para receber modo orquestrado.
- Para Evento automático:
  - exibir card “Pix à vista automático”.
  - ocultar campos manuais de início/data quando eles não mandam na regra.
  - cronograma usar `dynamic_pricing_current_amount` / snapshot vigente, não o total base.
  - vencimento apresentado como hoje enquanto não houver cobrança emitida.
- Para recorrente/assinatura curta:
  - não mostrar painel manual de tabela dinâmica.

4. Tabela dinâmica: gerar ao salvar, abrir e recalcular
- No editor, ao abrir proposta elegível com validade e itens, chamar o orquestrador caso não haja snapshot/faixas ou caso total/validade tenha mudado.
- Em `ProposalDynamicPricingPanel`, manter vendedor em modo automático/read-only.
- “Recalcular tabela” chamará o mesmo orquestrador, não apenas a geração isolada.
- Ao adicionar/alterar/remover itens e salvar, o orquestrador atualizará base, faixas, valor vigente e próxima virada.

5. Preview, link público e PDF com condição dinâmica
- `ProposalPreview` e `ProposalVisualizarTab` carregarão snapshot dinâmico e mostrarão “Condição comercial vigente” mesmo sem payment term manual.
- O cronograma da prévia usará:
  - referência = hoje enquanto não houver cobrança;
  - referência = data de emissão quando houver payment intent;
  - referência = data efetiva quando houver pagamento recebido.
- `ProposalPublicView` fará lazy orchestration se a proposta pública elegível abrir sem snapshot válido.
- PDF passará a receber snapshot dinâmico em `buildProposalPDFData()`.
- `proposalPdfGenerator` renderizará seção “Condição Comercial por Antecedência” e calculará pagamento à vista pelo valor vigente.

6. Aprovação com confirmação do contratado
- No modal público de aceite, adicionar bloco de confirmação antes da assinatura com:
  - itens contratados;
  - valor vigente contratado;
  - forma de pagamento Pix;
  - condição à vista;
  - vencimento/referência da condição;
  - validade da proposta;
  - aviso de cobrança complementar se pagar após virada.
- Ao aprovar proposta dinâmica:
  - criar/garantir payment intent pelo valor vigente;
  - aceitar usando o snapshot atual;
  - manter o botão como “Aprovar proposta com valor vigente”.

7. Lista de propostas sem F5
- Ao gerar link rápido, PDF, salvar proposta, marcar status ou voltar do editor:
  - invalidar `proposalKeys.lists()`;
  - invalidar `['proposals', opportunityId]`/lista específica;
  - invalidar `proposal-details` da oportunidade;
  - invalidar dynamic pricing e payment intent da proposta.
- Ajustar card para mostrar valor vigente quando houver `dynamic_pricing_current_amount`, mantendo fallback no total normal.

Critérios de aceite
- Template Evento/ALUGUE Evento selecionado + validade + itens gera proposta financeira pronta automaticamente.
- Não exige data manual de pagamento para aparecer tabela/condição.
- Condição padrão: Pix à vista, data de referência hoje até existir cobrança.
- 6 faixas oficiais aparecem automaticamente.
- Valor vigente e próxima virada aparecem no editor, preview, link público e PDF.
- Cronograma usa valor vigente, não total base.
- Payment intent usa valor vigente.
- Aprovação mostra confirmação clara de tudo contratado.
- Templates recorrente/assinatura curta não exibem painel manual de tabela dinâmica.
- Lista de propostas atualiza sem F5.
- Typecheck e build passam.

Riscos e cuidados
- Não sobrescrever manualmente condições antigas fora de templates automáticos.
- Evitar loop de trigger/orquestração ao atualizar snapshot e totais.
- Preservar regras PRICE 1.1 e campos já existentes.
- Manter isolamento por organização e RLS intactos.
- Usar valor líquido/total correto e excluir soft-deleted conforme regras do projeto.

Próximos passos
- Implementar a migration do orquestrador.
- Conectar o fluxo novo/existente do editor ao orquestrador.
- Ajustar pagamento, preview, link público, PDF e aprovação.
- Validar manualmente o cenário ALUGUE Evento e recorrente/assinatura curta.