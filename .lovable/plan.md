
Objetivo: fazer uma correção definitiva no acesso público das propostas do pipeline VENDAS da organização LEGAL, com foco em eliminar falsos “Proposta não encontrada” e padronizar a regra de validade.

Diagnóstico forense confirmado
1. O link enviado agora (`27a2db...`) não está quebrado por rota nem por token: a proposta existe no banco, está em `sent`, tem layout, itens e condições de pagamento.
2. O motivo real de ela não abrir hoje é que essa proposta já está expirada no backend:
   - `expires_at = 2026-03-27 12:00:00+00`
   - no momento da auditoria, o backend já estava em `2026-03-27 18:10:20+00`
3. Há um segundo problema estrutural: a base está inconsistente entre `rejected` e `declined`.
   - O frontend e várias policies usam `rejected`
   - parte das policies novas de acesso público usa `declined`
   - isso causa divergência de comportamento para propostas recusadas e também em relações públicas
4. A regra atual de validade está sensível a fuso/horário: propostas com expiração “no dia” ficam inválidas ao meio-dia UTC, o que para o usuário parece “expirou cedo demais”.
5. No pipeline VENDAS da organização LEGAL, o cenário está grande e heterogêneo:
   - 171 propostas no total
   - 116 com status público
   - 57 `sent` já expiradas
   - 15 `sent` vigentes
   - 18 deletadas
   - várias drafts sem token

O que precisa ser implementado
1. Unificar a regra pública de status
- Padronizar todo o fluxo público para um único conjunto de status:
  - `sent`
  - `viewed`
  - `accepted`
  - `rejected`
- Remover `declined` das policies e consultas públicas onde ele foi introduzido por engano.
- Revisar:
  - `src/services/supabase/proposals.ts`
  - policies de `organizations`
  - policies de `proposal_layouts`
  - policies de `proposal_layout_pages`
  - qualquer fluxo público relacionado

2. Corrigir a regra de validade para não expirar “no meio do dia”
- Ajustar a validação pública para considerar o fim do dia de validade, não apenas o timestamp salvo às 12:00 UTC.
- Aplicar a mesma regra em:
  - `getProposalByToken()`
  - políticas públicas da tabela `proposals`
  - políticas públicas das tabelas relacionadas
  - `og-proposal-meta`
- Resultado esperado: se a proposta vence em 27/03, ela permanece abrível até o final do dia definido pela regra de negócio.

3. Blindar o fluxo público com regra única de acesso
- Consolidar uma regra pública coerente:
  - `public_token IS NOT NULL`
  - `deleted_at IS NULL`
  - status público permitido
  - validade ainda ok
- Reaplicar essa mesma lógica em todas as tabelas dependentes do acesso público para evitar divergência entre proposta base e relações.

4. Corrigir em lote as propostas de VENDAS da organização LEGAL
- Fazer uma auditoria de dados com foco em:
  - propostas `sent/viewed/accepted/rejected` sem `public_token`
  - propostas públicas com `expires_at` inconsistente ou já vencidas indevidamente
  - propostas deletadas que não devem estar acessíveis
- Atualizar somente os registros que devem ficar públicos e válidos.
- Não reabrir drafts nem propostas excluídas.

5. Validar a tela pública contra dados parciais
- Garantir que a página continue abrindo quando organização/layout vierem ausentes.
- “Proposta não encontrada” deve aparecer apenas quando:
  - token inexistente
  - proposta excluída
  - proposta fora da política pública
  - proposta realmente expirada pela nova regra

Escopo prático da correção
- Código:
  - `src/services/supabase/proposals.ts`
  - `supabase/functions/og-proposal-meta/index.ts`
  - possivelmente `src/pages/ProposalPublicView.tsx` apenas para mensagem/estado final
- Banco:
  - nova migration para corrigir policies públicas
  - operação de dados para normalizar propostas do pipeline VENDAS da organização LEGAL

Resultado esperado após implementar
- O cliente consegue abrir todas as propostas de VENDAS/LEGAL que realmente devem estar públicas e válidas
- O link `27a2db...` deixa de falhar por regra ambígua; ele só continuará bloqueado se a decisão for manter sua expiração atual
- Não haverá mais divergência entre proposta base e relações públicas
- O comportamento ficará consistente entre navegador, CRM interno e preview social

Detalhes técnicos
```text
Causa principal encontrada:
- não é mais só token/RLS
- há combinação de:
  1) expiração efetiva já vencida
  2) regra de validade mal calibrada para timezone
  3) mismatch entre status 'rejected' e 'declined'
```

Decisão recomendada
- Implementar a correção estrutural
- E, junto, normalizar em lote as propostas públicas de VENDAS/LEGAL para deixá-las prontas para abertura sem erro pelos clientes
