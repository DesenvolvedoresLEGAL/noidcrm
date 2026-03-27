
Problema identificado: o link público está chegando na rota certa, o token existe no banco, a proposta está `sent` e dentro da validade, mas a tela pública ainda cai em “Proposta não encontrada” porque o `getProposalByToken()` faz um `select` aninhado grande demais para acesso anônimo. Na prática, o cliente externo depende de RLS pública em várias relações; hoje `opportunities/accounts/contacts/items/payment_terms` têm acesso público, mas `organizations`, `proposal_layouts` e `proposal_layout_pages` não. Como a query pública tenta carregar tudo de uma vez, o fetch externo quebra/retorna vazio, enquanto dentro do CRM funciona por contexto autenticado.

Plano de correção imediata

1. Blindar a busca pública da proposta
- Ajustar `src/services/supabase/proposals.ts` para que `getProposalByToken()`:
  - continue aceitando token bruto + hash
  - aplique filtros explícitos de segurança (`deleted_at IS NULL`, status público permitido, não expirada)
  - faça uma busca base da proposta sem depender de relações privadas no primeiro fetch

2. Separar o carregamento público em etapas seguras
- Depois de encontrar a proposta base, carregar relações públicas em queries separadas e tolerantes a falha:
  - oportunidade
  - conta
  - contato
  - itens
  - condições de pagamento
- Se organização/layout não puderem ser lidos, a página continua abrindo com fallback visual em vez de derrubar tudo

3. Corrigir o RLS do que realmente precisa ser público
- Criar uma migration para liberar leitura anônima apenas dos dados mínimos necessários de:
  - `organizations`
  - `proposal_layouts`
  - `proposal_layout_pages`
- Essas policies serão vinculadas apenas a propostas com `public_token` válido e dentro da regra de expiração
- Não vou abrir `profiles` publicamente; isso exporia dados pessoais desnecessários

4. Remover a dependência pública de `profiles`
- Ajustar o fluxo para não buscar `seller_profile` na visualização pública
- Se houver dados do vendedor na tela, usar somente o que já estiver disponível de forma segura ou esconder esse bloco quando não houver acesso

5. Tornar a tela resiliente
- Em `src/pages/ProposalPublicView.tsx`, manter a página renderizando mesmo com dados parciais
- Só exibir “Proposta não encontrada” quando a proposta base realmente não existir ou estiver fora das regras públicas
- Preservar os fallbacks já usados para account/contact

6. Alinhar compartilhamento e visualização
- Aplicar a mesma regra de token/validade no fluxo público relacionado (`og-proposal-meta`) para não haver diferença entre abrir no navegador e abrir por link compartilhado

Arquivos impactados
- `src/services/supabase/proposals.ts`
- `src/pages/ProposalPublicView.tsx`
- `supabase/functions/og-proposal-meta/index.ts`
- nova migration em `supabase/migrations/...`

Resultado esperado após a correção
- Clientes externos conseguem abrir propostas `sent/viewed` com validade ok
- A página não quebra por falta de permissão em relações secundárias
- Propostas inválidas/expiradas continuam bloqueadas
- O CRM interno continua funcionando igual

Detalhes técnicos
- Causa principal: RLS + nested select público excessivo, não rota
- Evidências verificadas:
  - a rota `/p/:token` existe
  - o token informado existe no banco
  - a proposta está válida até `22/05/2026`
  - o erro acontece tanto no domínio publicado quanto no domínio customizado
  - o problema aparece só no acesso externo/anônimo
