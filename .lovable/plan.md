
Objetivo: corrigir definitivamente o falso “Proposta não encontrada” no link público `/p/:token`.

Diagnóstico confirmado
- O fluxo público (`ProposalPublicView`) chama `getProposalByToken`.
- Hoje essa função consulta direto `proposals` com `.from('proposals')...maybeSingle()`.
- Após o hardening de segurança, não existe mais policy de SELECT para anônimo em `proposals` (só autenticado via `proposals_select_by_visibility`), então a busca pública cai em `null/erro` e a UI mostra “Proposta não encontrada” para links válidos.
- Além disso, o carregamento atual mistura erro de proposta com erro secundário (itens/condições), o que pode mascarar diagnóstico.

Plano de correção (implementação)
1) Tornar a busca pública independente de RLS da tabela base
- Arquivo: `src/services/supabase/proposals.ts`
- Refatorar `getProposalByToken(token)` para usar RPC `get_proposal_by_public_token` (security definer) como fonte principal.
- Tentar candidatos de token (raw + SHA-256) para compatibilidade com links antigos/novos.
- Normalizar payload antes da validação (suportar array/objeto/nesting) e só considerar “não encontrada” quando não houver `id`.

2) Blindar parsing de resposta para evitar falso negativo
- Arquivo: `src/services/supabase/proposals.ts`
- Aplicar normalização robusta no retorno (ex.: `data[0]`, `data?.proposal`, `data?.data?.proposal`, etc.) antes do guard.
- Guard final: se `!proposal?.id`, retorna `null` (não explode com erro genérico de parsing).

3) Separar “proposta não encontrada” de falhas secundárias
- Arquivo: `src/pages/ProposalPublicView.tsx`
- Em `loadProposal()`:
  - Primeiro resolve proposta.
  - Se `null`, exibe card de não encontrada.
  - Itens e payment terms passam para `Promise.allSettled` (ou try/catch individual), mantendo proposta carregada mesmo se um bloco auxiliar falhar.
- Toast de erro passa a ser específico:
  - “Proposta não encontrada” somente quando token inválido/expirado.
  - “Falha ao carregar detalhes” para erro secundário.

4) (Opcional recomendado para estabilidade) consolidar payload público em 1 chamada
- Backend migration: criar RPC `get_public_proposal_bundle(p_token)` (security definer) retornando proposta + relações públicas + itens/condições públicas já filtradas.
- Front usa esse bundle e elimina múltiplas queries frágeis.
- Mantém exclusão de campos sensíveis (custos internos e PII de aceite).

5) Validação end-to-end após ajuste
- Testar links públicos válidos recentes (status `sent`, `accepted`, `rejected` dentro da janela válida).
- Testar token inválido e expirado.
- Testar URL curta e hash longa.
- Confirmar que página carrega proposta em vez do card de erro.
- Confirmar que tracking de visualização continua funcionando.

Detalhes técnicos (resumo)
- Arquivos principais:
  - `src/services/supabase/proposals.ts` (core fix de lookup/normalização)
  - `src/pages/ProposalPublicView.tsx` (tratamento correto de erro e carregamento parcial)
  - (se aplicar opcional) nova migration SQL para RPC bundle.
- Segurança preservada:
  - acesso público via função dedicada no backend (não reabrir SELECT anônimo na tabela `proposals`);
  - sem reexpor colunas sensíveis.
