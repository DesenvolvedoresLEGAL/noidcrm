## Objetivo

Eliminar o ruído entre "Subtotal Avulso" (R$ 1.994,00) e "Valor Vigente" (R$ 2.193,40) deixando a matemática explícita dentro do próprio bloco "Itens Avulsos" — tanto no link público quanto no PDF — e adicionando uma linha curta de urgência citando o próximo valor e a data de virada.

## Mudanças

### 1. Link público — `src/pages/ProposalPublicView.tsx`

No `<tfoot>` do bloco "Itens Avulsos" (linhas ~1412–1432), quando `dynamic_pricing_enabled` e snapshot ativo:

- Renomear a linha existente "Subtotal Avulso" para **"Subtotal dos Itens"** (cinza, peso normal). Continua mostrando `oneTimeTotal` (R$ 1.994).
- Adicionar nova linha **"Ajuste por antecedência (+X%)"** em destaque âmbar, com o delta `current_amount − base_amount` e o percentual calculado.
- Adicionar nova linha de fechamento **"Total Vigente Hoje"** em negrito grande, mostrando `snapshot.current_amount` (R$ 2.193,40), casando com header e Condições de Pagamento.
- Logo abaixo do tfoot, micro-texto sutil com gatilho de urgência:
  > "Condição vigente até DD/MM/AAAA HH:mm. A partir de DD/MM, novo valor: R$ X.XXX,XX."
  Usa `current_ends_at`, `next_starts_at` e `next_amount`. Se não houver `next_amount`, exibe só a parte da validade.

Quando `dynamic_pricing` não estiver ativo, o bloco continua exatamente como hoje (sem regressão).

### 2. PDF — `src/lib/proposalPdfGenerator.ts`

No bloco "RESUMO DO INVESTIMENTO" (linhas ~680–766), quando `dynamic_pricing_enabled` + snapshot ativo:

- Manter a linha "Total Avulso" (subtotal dos itens, R$ 1.994).
- Inserir nova linha **"Ajuste por antecedência (+X%)"** em laranja/âmbar, mostrando o delta.
- Substituir o "VALOR TOTAL DA PROPOSTA" para usar `current_amount` (já é o caminho atual via `effectiveOneTimeAmount`, garantir consistência visual).
- Adicionar linha rodapé (8pt, cinza) dentro da caixa: "Condição vigente até …; próximo valor R$ X em DD/MM."

Recalcular `summaryBoxHeight` para acomodar as 1–2 linhas extras.

### 3. Helpers

Criar utilitário compartilhado `getDynamicPricingBreakdown(snapshot, baseOneTimeTotal)` em `src/lib/proposals/dynamicPricing.ts` que retorna:

```ts
{
  base: number;          // subtotal dos itens
  current: number;       // valor vigente
  delta: number;         // current - base
  adjustmentPercent: number; // (delta/base)*100
  endsAt: string | null;
  nextAmount: number | null;
  nextStartsAt: string | null;
  hasAdjustment: boolean; // |delta| > 0.01
}
```

Usado por ProposalPublicView e proposalPdfGenerator para garantir cálculo único.

## Comportamento esperado (cenário Repdiu)

```text
Itens Avulsos
─────────────────────────────────────
Subtotal dos Itens .............. R$ 1.994,00
Ajuste por antecedência (+10%) .. + R$ 199,40
─────────────────────────────────────
Total Vigente Hoje .............. R$ 2.193,40

Condição vigente até 16/05/2026 20:59.
A partir de 16/05/2026, novo valor: R$ 2.392,80.
```

Header e Condições de Pagamento continuam mostrando R$ 2.193,40 — agora coerente com o que aparece logo após os itens.

## Riscos e validação

- **Sem regressão para propostas sem tabela dinâmica**: blocos novos só renderizam quando `dynamic_pricing_enabled && snapshot.current_amount != null && snapshot.status !== 'disabled'`.
- **MRR**: mudanças são escopadas ao bloco one-time; recurring permanece intocado.
- **PDF QA visual**: gerar PDF da PROP-2026-00492 após a mudança, conferir alinhamento, altura da caixa e quebras de página.
- **Histórico**: propostas já aceitas mostram o snapshot persistido (`approved_amount`); o novo rodapé deve respeitar o snapshot histórico já gravado, não o vigente atual.

## Arquivos impactados

- `src/lib/proposals/dynamicPricing.ts` (novo helper)
- `src/pages/ProposalPublicView.tsx` (tfoot do bloco Avulsos)
- `src/lib/proposalPdfGenerator.ts` (caixa "Resumo do Investimento")
