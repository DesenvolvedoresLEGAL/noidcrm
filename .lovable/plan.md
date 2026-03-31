

# Simplificar Modal de Recusa do Cliente (Link Publico)

## Problema
O modal atual tem opções demais, linguagem interna, fatores redundantes e campo de fornecedor desacoplado do motivo. O cliente precisa de algo simples e rápido.

## Alterações

### 1. `src/pages/ProposalPublicView.tsx`

**Fallback reasons** — substituir as 9 opções por 6 simples:
- Preço fora do orçamento
- Já fechei com outro fornecedor
- Não vou mais realizar o evento
- Não preciso mais da solução
- Falta de tempo / urgência
- Outro motivo

**Campo "Qual fornecedor?"** — aparece condicionalmente quando o motivo selecionado contém "fornecedor" (seja do fallback ou vindo da API). Remove o checkbox "Escolhi outro fornecedor" e substitui por detecção automática baseada no label do motivo selecionado.

**Remover seção "O que influenciou sua decisão?"** — eliminar os checkboxes de fatores (Preço, Timing, Produto, Atendimento). Os factors serão derivados automaticamente da `category` do motivo pelo backend.

**Campo de texto** — trocar label de "O que poderia ter sido diferente?" para "Pode nos contar rapidamente o motivo?" e placeholder para "Seu feedback nos ajuda a melhorar...".

**handleDecline** — remover envio de `pricesFactor`, `timingFactor`, `featureFactor`, `relationshipFactor`. Manter `competitor` e `customerFeedback`. O competitor agora vem do campo condicional ao motivo, sem checkbox separado.

**Cleanup states** — remover `hasCompetitor` e `declineFactors`. Manter `competitorName` controlado pela seleção do motivo.

### Arquivos: 1
- `src/pages/ProposalPublicView.tsx`

