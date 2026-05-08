## Plano — PRICE AUTO ENGINE FIX

### Arquivos impactados
- `supabase/migrations/*_price_auto_engine_fix.sql` — correções de RPCs/funções e automação no banco.
- `src/services/proposals/proposalDynamicPricing.ts` — helper frontend para elegibilidade/geração automática.
- `src/services/supabase/proposal-templates.ts` — aplicar `dynamic_pricing_mode` e disparar geração quando template elegível já tiver validade.
- `src/services/supabase/proposals.ts` — salvar campos comerciais do template e disparar geração após criação/edição quando elegível.
- `src/pages/ProposalEditor.tsx` e `src/components/proposals/ProposalEditorModal.tsx` — seleção de template, validade, save e refetch do motor automático.
- `src/components/proposals/ProposalDynamicPricingPanel.tsx` — UI automática/read-only correta e estado “não aplicável”.
- `src/components/proposals/ProposalPaymentTerms.tsx` — cronograma e resumo usando valor vigente quando tabela dinâmica ativa.
- `src/pages/ProposalPublicView.tsx` e `src/components/proposals/PublicProposalDynamicPricingBanner.tsx` — link público com valor vigente, próxima virada e CTA correto.
- `src/lib/proposalPdfBuilder.ts` e `src/lib/proposalPdfGenerator.ts` — PDF com seção “Condição Comercial por Antecedência” e parcelas pelo valor vigente.
- `src/services/proposals/proposalPaymentsService.ts` / RPC de payment intent — cobrança sempre pelo valor vigente automático.

### 1. Banco: unificar elegibilidade e nomenclatura
- Criar `public.can_auto_generate_dynamic_pricing(p_proposal_id uuid)` com `SECURITY DEFINER` e `search_path = public`.
- Regra de `true`:
  - `dynamic_pricing_applicability = 'automatic'`
  - `dynamic_pricing_mode = 'automatic_by_valid_until'`
  - `valid_until`/`expires_at` preenchido
  - `revenue_type IN ('one_time_event','one_time_non_event')`
- Regra de `false`:
  - `applicability = none`, `mode = none`
  - recorrente/assinatura/assinatura com fidelidade.
- Manter o armazenamento interno de `proposal_dynamic_pricing_rules.pricing_mode = 'event_antecedence'`, mas aceitar `automatic_by_valid_until` como modo de template/proposta.

### 2. Banco: corrigir `generate_event_antecedence_pricing_for_proposal`
- Usar `proposal.valid_until`/`expires_at` como data principal da condição comercial.
- Não exigir `event_start_date` da oportunidade.
- Validar organização/tenant e elegibilidade.
- Retornar `status = not_applicable` sem erro quando não aplicável.
- Retornar erro controlado quando o template exige validade e a validade está ausente.
- Calcular `base_amount` pelo valor base real da proposta (`total_amount`, `value` ou fallback), sem usar `dynamic_pricing_current_amount`.
- Criar/atualizar a regra com:
  - `enabled = true`
  - `pricing_mode = 'event_antecedence'`
  - `auto_generated = true`
  - `event_start_date = valid_until`
  - `status = active`
  - `base_amount = base_amount`
- Remover/recriar apenas tiers `auto_generated` e gerar as 6 faixas oficiais.
- Chamar `calculate_proposal_dynamic_price`.
- Atualizar `proposals.dynamic_pricing_enabled`, `dynamic_pricing_current_amount`, `dynamic_pricing_status`, `dynamic_pricing_snapshot`, `dynamic_pricing_last_calculated_at`.
- Registrar evento financeiro/auditável de geração/regeneração.

### 3. Banco: automação pós-save e payment intent
- Criar trigger seguro pós-save em `proposals` para regenerar quando mudarem:
  - template/regras comerciais
  - validade
  - total/base amount
  - campos de precificação dinâmica
- Evitar loop: trigger só chama geração quando elegível e quando os campos de origem mudam.
- Atualizar `create_proposal_payment_intent` para:
  - se elegível e sem `dynamic_pricing_current_amount`, gerar a tabela antes.
  - usar `dynamic_pricing_current_amount`/snapshot vigente como `expected_amount`.
  - nunca cair para valor base quando tabela automática estiver ativa.

### 4. Template e save da proposta
- Corrigir `applyTemplate` para copiar também `dynamic_pricing_mode`, `show_dynamic_pricing_on_public_link`, `show_dynamic_pricing_on_pdf`, `allow_pix_payment`, `allow_complementary_charge` e validade comercial.
- No editor, ao selecionar `ALUGUE Evento`, atualizar o estado/form com as regras comerciais do template.
- Após salvar proposta e totais/itens, chamar geração automática quando elegível e invalidar/refazer queries da proposta, snapshot e tabela.
- Ao alterar validade, garantir que o save regenere obrigatoriamente; opcionalmente exibir “Recalcular tabela”.

### 5. Painel de tabela dinâmica
- Receber `proposal`/regras comerciais ou carregar dados suficientes para decidir pelo template, não apenas pela existência de uma regra manual.
- Se `dynamic_pricing_applicability = none`:
  - mostrar “Tabela dinâmica não aplicável para este template.”
  - subtexto de recorrente/assinatura.
  - esconder ativar/adicionar condição/editor manual.
- Se `dynamic_pricing_applicability = automatic`:
  - mostrar badges “Ativa” e “Automática por validade”.
  - se não houver tiers, mostrar “Gerando tabela automática...” e disparar geração.
  - esconder “Modo manual”, “Ativar” e “Adicionar condição” para vendedor.
  - renderizar cards: valor base, valor vigente hoje, faixa vigente, próxima virada, validade, dias até validade.
  - renderizar tabela read-only das 6 faixas.
  - ações: “Recalcular tabela”, “Aplicar valor vigente”, “Ver configurações”.
- Se `dynamic_pricing_mode = manual`, manter editor manual apenas para admin/owner.

### 6. Condições financeiras, link público e PDF
- `ProposalPaymentTerms` passa a aceitar snapshot dinâmico ativo e calcular parcelas pelo valor vigente.
- Adicionar bloco “Condição Comercial Vigente” antes do cronograma com valor vigente, faixa, ajuste, validade e próxima virada.
- Link público:
  - usar `dynamic_pricing_current_amount` no card/header quando ativo.
  - mostrar “Valor vigente hoje”.
  - mostrar condição vigente e tabela de antecedência antes das condições financeiras.
  - botão de aceite: “Aprovar proposta com valor vigente”.
  - botão de Pix: “Pagar valor vigente”.
- PDF:
  - incluir seção “Condição Comercial por Antecedência” quando `show_dynamic_pricing_on_pdf = true` e tabela ativa.
  - texto obrigatório com “validade da proposta”.
  - tabela: Antecedência, Período, Ajuste, Valor, Status.
  - parcelas pelo valor vigente.

### 7. Validação do caso informado
- Confirmar pela lógica da tabela:
  - Validade: `01/06/2026`
  - Base: `R$ 1.994,00`
  - Referência: `08/05/2026`
  - 24 dias até validade
  - faixa vigente `21 a 29 dias`, ajuste `0%`, valor `R$ 1.994,00`
  - próxima virada em `12/05/2026`, valor `R$ 2.193,40`
  - 6 faixas geradas.

### Riscos
- O trigger pós-save precisa evitar recursão ao atualizar os próprios campos `dynamic_pricing_*`.
- Se `total_amount` ainda não tiver sido recalculado no momento da geração, o frontend deve chamar geração depois de `updateProposalTotals`.
- O campo real de validade no banco parece ser `expires_at`; vou mapear como referência principal para a regra, mantendo compatibilidade com `valid_until` se existir.

### Resultado esperado
- `ALUGUE Evento` gera e aplica a tabela automática sem clique em “Ativar”.
- Templates recorrentes/assinatura não exibem painel manual.
- Pagamento, link público, PDF e payment intent usam o valor vigente.
- Typecheck e build ficam preservados pelo fluxo já validado pelo harness.