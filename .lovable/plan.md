Plano de correção

1. Corrigir a regra errada na reabertura de oportunidade
- Alterar `reopenOpportunity()` para NÃO transformar proposta aceita em `rejected`.
- Quando uma oportunidade for reaberta, as propostas vinculadas que estiverem `accepted` ou `rejected` devem voltar para status aberto, usando `sent` como status técnico porque é o status que mantém o link público acessível.
- Limpar os campos que fazem a tela pública exibir “Proposta Recusada” ou “Proposta Aceita”:
  - `declined_at = null`
  - `declined_reason = null`
  - `accepted_at = null`
  - `signature_status = 'pending'`
- Manter o `public_token`, para o link rápido existente continuar funcionando.

2. Corrigir o caso atual já quebrado
- Criar migração para reparar propostas que foram recusadas automaticamente pela reabertura com motivo começando por `Venda reaberta:`.
- Para essas propostas, voltar `status` para `sent`, limpar `declined_at` e `declined_reason`, e manter o link público.
- Confirmado no banco que a proposta `PROP-2026-00448` está exatamente nesse estado incorreto: oportunidade aberta, proposta `rejected`, `declined_reason = Venda reaberta: Precisamos atualizar o projeto`.

3. Endurecer o serviço de propostas para permitir reabertura controlada
- Hoje `updateProposal()` bloqueia downgrade quando existe `accepted_at` ou `declined_at`, o que é bom para evitar alteração acidental, mas impede correção controlada.
- Adicionar uma função explícita no serviço, por exemplo `reopenProposalForOpportunityUpdate(proposalId)`, que reabre a proposta com limpeza completa dos campos terminais.
- Essa função será usada apenas em fluxo interno/autenticado, não pelo cliente público.

4. Ajustar UI para status “Aberta”
- Atualizar badges/labels de proposta para exibir `sent`/`viewed` como “Aberta” ou “Aberta/Visualizada”, em vez de induzir que a proposta está encerrada.
- Garantir que o editor de proposta não mostre “Recusada” após reabrir a oportunidade.
- Garantir que o link público não mostre o banner vermelho quando a proposta foi reaberta.

5. Remover menções internas ao cliente no link público
- Remover textos/comentários visíveis ou potenciais mensagens ao cliente que mencionem “notificações internas”, “Slack”, “sistema interno”, “NOID CRM” onde aparecerem no contexto público.
- Ajustar o `document.title` da página pública para linguagem neutra de cliente, por exemplo `Proposta Comercial`, sem “NOID CRM”.
- A tela pública deve falar apenas da proposta, cliente, contato, valores e ações de aceite/recusa.

6. Avaliar botão “Reabrir proposta”
- Adicionar uma ação discreta no editor/detalhe da proposta para reabrir proposta terminal (`accepted`/`rejected`) quando houver atualização de projeto.
- Essa ação fará a mesma limpeza segura dos campos terminais e voltará a proposta para “Aberta”.
- Se a proposta estiver ligada a uma oportunidade ganha/perdida, o fluxo deve orientar a reabrir a oportunidade também, para manter consistência.

Arquivos impactados
- `src/services/supabase/opportunities.ts`
- `src/services/supabase/proposals.ts`
- `src/pages/ProposalEditor.tsx`
- `src/pages/ProposalPublicView.tsx`
- `src/components/proposals/ProposalEditorHeader.tsx`
- `src/components/proposals/ProposalContextCards.tsx`
- possivelmente `src/components/proposals/ProposalsList.tsx` e `ProposalViewModal.tsx` para padronizar labels
- nova migração em `supabase/migrations/` para reparar dados já afetados

Resultado esperado
- Reabrir oportunidade nunca mais marca proposta aceita como recusada.
- Proposta reaberta fica “Aberta”, editável e com link público válido.
- Cliente não vê mensagem de recusa indevida no link rápido.
- A proposta atual `PROP-2026-00448` será corrigida no banco.
- Link público não expõe linguagem interna do sistema ao cliente.

Riscos
- Ao limpar `accepted_at`, essa proposta deixa de contar como aceita nos relatórios após a reabertura, o que é coerente com a regra: se a venda foi reaberta para atualizar projeto, a proposta volta a estar aberta.
- Histórico/auditoria deve preservar o fato de que houve aceite anterior e reabertura, por isso a correção deve registrar audit log/migration quando possível.