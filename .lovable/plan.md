
Do I know what the issue is? Sim.

Diagnóstico forense confirmado (com evidência real)
1) A proposta existe e o token é válido:
- `public.proposals.public_token = 5522f...103db`
- status `sent`, não expirada, não deletada.

2) O erro principal está na RPC pública, não no token:
- `public.get_proposal_by_public_token(...)` quebra em runtime com:
  - `column lp.order_index does not exist` (tabela `proposal_layout_pages` usa `page_number`)
- A mesma função também referencia `proposal_contracts`, mas essa tabela não existe neste banco (existe `contracts`).

3) Quando a RPC quebra, o frontend mascara como “não encontrada”:
- `getProposalByToken` engole erro da RPC (`continue`) e retorna `null`.
- `ProposalPublicView` interpreta `null` como link inválido/expirado.

4) Dados (cliente, itens, pagamento) estão no banco:
- A proposta testada possui itens e termos de pagamento.
- Ou seja, o bloqueio é erro de função + tratamento de erro no front.

Plano de correção (próxima implementação)
1) Recriar a RPC pública com schema real do banco (migration nova)
- Arquivo: `supabase/migrations/<new>.sql`
- Ajustes:
  - manter `SECURITY DEFINER` e `search_path = public, extensions`
  - token raw + SHA-256 com `extensions.digest(...)`
  - `layout.pages` ordenado por `lp.page_number` (não `order_index`)
  - remover referência a `proposal_contracts`
  - preencher `contract` a partir de `contracts` via `opportunity_id` (último ativo) ou `null`
  - continuar removendo PII sensível da proposta
  - retorno JSONB completo: `proposal`, `organization`, `opportunity`, `account`, `contact`, `items`, `payment_terms`, `layout`, `contract`, `seller_profile`
  - garantir `GRANT EXECUTE` para `anon/authenticated`

2) Blindar serviço frontend para não confundir erro técnico com “não encontrada”
- Arquivo: `src/services/supabase/proposals.ts`
- Ajustes:
  - em `getProposalByToken`, se todas tentativas falharem por erro de RPC, lançar erro técnico (não retornar `null`)
  - retornar `null` apenas quando a RPC responder sem proposta (token inválido/expirado)
  - manter normalização robusta do bundle

3) Ajustar a página pública para estados distintos
- Arquivo: `src/pages/ProposalPublicView.tsx`
- Ajustes:
  - separar estado `not_found` de `load_error`
  - mostrar “Proposta não encontrada” só para inválida/expirada
  - mostrar “Erro temporário ao carregar proposta” para falha de backend
  - manter consumo prioritário de `items/payment_terms` do bundle
  - fallback a queries diretas apenas em contexto autenticado (não para cliente anônimo)

4) Validação end-to-end obrigatória (token real informado)
- Testar `/p/5522f...103db` em mobile:
  - abre sem tela de “não encontrada”
  - exibe cliente, contato, itens, pagamento, anexos/layout
- Testar token inválido e expirado (mensagem correta)
- Testar aceite/recusa e tracking sem regressão

Arquivos-alvo
- `supabase/migrations/<new>.sql`
- `src/services/supabase/proposals.ts`
- `src/pages/ProposalPublicView.tsx`

Resultado esperado
- Link rápido volta a abrir normalmente para clientes.
- “Proposta não encontrada” só aparece quando realmente inválida/expirada.
- Visualização pública completa com dados do cliente, itens, pagamento e anexos.
