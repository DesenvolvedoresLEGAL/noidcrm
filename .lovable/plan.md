
Do I know what the issue is? Sim.

Diagnóstico forense (causa raiz confirmada)
1) Backend quebrando lookup público:
- A função `public.get_proposal_by_public_token(p_token text)` está chamando `digest(...)` sem schema qualificado.
- Ela roda com `SECURITY DEFINER SET search_path = public`, então `digest` (que está em `extensions`) não é resolvido.
- Resultado real no banco: `ERROR: function digest(text, unknown) does not exist`.
- Efeito: a RPC falha para qualquer token e o front cai em “Proposta não encontrada”.

2) Front mascarando erro técnico como “não encontrada”:
- `getProposalByToken` dá `continue` em erro da RPC e retorna `null` no final.
- `ProposalPublicView` trata `null` como link inválido/expirado.
- Isso transforma falha de backend em falso negativo de negócio.

3) Carga de dados públicos ainda frágil:
- A tela ainda tem fallback para queries anônimas (`listProposalItems/getPaymentTerms`) que podem ser bloqueadas por RLS.
- Mesmo com proposta encontrada, isso pode causar ausência de itens/pagamento em cenários específicos.

Plano de correção (próxima implementação)
1) Corrigir função pública no backend (prioridade máxima)
- Criar migration para `CREATE OR REPLACE FUNCTION public.get_proposal_by_public_token`.
- Corrigir hash de token com uma das opções seguras:
  - `extensions.digest(...)` (schema qualificado), ou
  - remover hash interno da SQL e receber candidatos já gerados no front.
- Manter `SECURITY DEFINER`, filtros de segurança e exclusão de PII.
- Retornar bundle completo JSONB: `proposal`, `organization`, `opportunity`, `account`, `contact`, `items`, `payment_terms`, `layout` (pages), `contract`, `seller_profile`.

2) Blindar `getProposalByToken` no frontend
- Normalizar retorno da RPC para aceitar objeto/array/wrapper (`data`, `proposal`, etc.).
- Não converter erro técnico em “not found” silenciosamente.
- Mapear estados:
  - `not_found_or_expired` (token inválido/expirado),
  - `backend_error` (RPC falhou),
  - `ok` (bundle carregado).
- Remover dependência de leituras públicas diretas em tabelas protegidas.

3) Ajustar `ProposalPublicView` para consumir só o bundle
- Carregar tudo da resposta única da RPC (cliente, contato, itens, pagamento, layout/PDF, contrato).
- Manter fallback secundário apenas para contexto autenticado interno (não para público anônimo).
- Exibir mensagem correta:
  - “link inválido/expirado” apenas quando confirmado,
  - “erro temporário de carregamento” quando falha técnica.

4) Garantir consistência de contrato/PDF anexo
- Confirmar no bundle os campos usados na UI:
  - `layout.terms_pdf_url`,
  - `layout.pages[].file_url/file_name`,
  - `contract` (último vigente quando houver).
- Ajustar binding da tela para não depender de relações fora do bundle.

5) Validação end-to-end obrigatória após correção
- Testar links válidos em mobile (`/p/:token`) e confirmar render completo:
  - cliente, contato, itens, termos/pagamento, totais, anexos/PDF/contrato.
- Testar token expirado e inválido (mensagem correta).
- Testar status `sent/viewed/accepted/rejected`.
- Confirmar tracking de visualização e ações de aceite/recusa sem regressão.

Arquivos-alvo da próxima correção
- `supabase/migrations/*` (recriação da RPC pública)
- `src/services/supabase/proposals.ts` (`getProposalByToken`, `acceptProposal`, `declineProposal`)
- `src/pages/ProposalPublicView.tsx` (carregamento e estados de erro)

Resultado esperado
- Abertura pública volta a funcionar de forma estável.
- “Proposta não encontrada” só aparece quando realmente inválida/expirada.
- Tela pública exibe todas as informações críticas (cliente, contato, itens, pagamento e anexos) de forma consistente.
