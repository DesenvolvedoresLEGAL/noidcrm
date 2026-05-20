## Objetivo

Trazer a foto do produto/serviço (campo `image_url`, que já existe em `products` e em `proposal_items`) de forma elegante em todas as superfícies onde o item aparece, e ampliar a largura útil do link público da proposta. Sem mexer em regras de negócio (preço, desconto, totais, RLS).

## Diagnóstico rápido

- A coluna `image_url` já existe em `public.products` e em `public.proposal_items`.
- O service `proposal-items.ts` e o `ProposalItemsManager` já gravam `image_url` ao adicionar item a partir de um produto — ou seja, o dado já está chegando na proposta.
- O que falta hoje é **renderização** em 4 superfícies:
  1. Editor da proposta (aba "Itens" — `ProposalItemsManager.tsx`)
  2. Visualização Rápida (`ProposalPreview.tsx`, usada no `ProposalViewModal`)
  3. Link público (`src/pages/ProposalPublicView.tsx`)
  4. PDF (`supabase/functions/generate-proposal-pdf/index.ts`)

- Largura do link público hoje: `max-w-5xl` (~64rem) no header (linha 1129) e no `<main>` (linha 1192) de `ProposalPublicView.tsx`. Cliente quer mais largo.

## Mudanças propostas (somente UI/render)

### 1. Editor — `ProposalItemsManager.tsx`
- Adicionar uma miniatura 40×40 (rounded-md, border, `object-cover`) à esquerda do nome do item em cada linha.
- Placeholder discreto (ícone `ImageIcon` em fundo `muted`) quando `image_url` for nulo.
- Não adicionar nenhum botão de upload aqui — a foto continua sendo gerida no cadastro de produto/serviço.

### 2. Visualização Rápida — `ProposalPreview.tsx`
- Mesma miniatura 48×48 dentro da célula "Item" da tabela de itens (avulsos e recorrentes), antes do nome e descrição.
- Layout flex: thumb + bloco de texto (nome em bold + descrição HTML existente).

### 3. Link público — `src/pages/ProposalPublicView.tsx`
- **Largura**: trocar `max-w-5xl` por `max-w-7xl` no header (linha 1129) e no `<main>` (linha 1192). Mantém `mx-auto` e padding responsivo — apenas dá mais respiro horizontal em telas grandes (>1280px), sem afetar mobile.
- **Miniaturas**: na coluna "Item" das tabelas de Itens Avulsos (~linha 1407) e Itens Recorrentes (~linha 1547), envolver `name` + `description` num `flex gap-3` com thumb 56×56 à esquerda (arredondada, com borda sutil, `object-cover`). Em mobile (`<sm`) reduzir para 40×40 para não comer espaço.
- Quando `image_url` for nulo: não renderiza thumb (mantém layout limpo, sem placeholder no público — visual mais elegante para o cliente final).

### 4. PDF — `supabase/functions/generate-proposal-pdf/index.ts`
- No `<td>` do nome do item (linha 533), inserir antes do `item-name` um bloco `<img>` quando `item.image_url` existir:
  - 56×56px, `object-fit: cover`, `border-radius: 6px`, `border: 1px solid #e5e7eb`, `float: left; margin-right: 12px;` (ou `display: flex` no `<td>` — usar flex para consistência com o resto do HTML do PDF).
- Ajustar a largura da coluna "Item" de `45%` para `48%` para acomodar a thumb sem espremer o texto. As demais (`8/15/12/20`) somam 55%; reduzimos "Total" de 20% → 17% para fechar 100%.
- Importante: o renderizador de PDF precisa conseguir buscar a imagem por URL pública. Como o `image_url` dos produtos já é uma URL pública servida pelo storage, funciona direto. Não precisa de signed URL.

## Onde NÃO mexer

- Schema do banco (colunas já existem).
- Lógica de preços, descontos, totais, valor líquido, sincronização com ERP, RLS — nada disso muda.
- Upload de imagem de produto: fora de escopo (o usuário disse "eu adicionei fotos nos produtos" → fluxo de upload já funciona).
- `MiniRichTextEditor` e demais editores rich-text — fora de escopo.

## Riscos

- Largura `max-w-7xl` em telas ultra-wide pode parecer "esticada" demais para texto corrido (intro/termos). Mitigação: aplicar `max-w-7xl` no container externo, mas manter os blocos de prose (intro, termos, notas) com `max-w-4xl mx-auto` internamente para preservar legibilidade. Tabelas, cards de pagamento e itens aproveitam toda a largura.
- Imagens muito grandes no PDF podem inflar o tamanho do arquivo. Como já são as mesmas URLs servidas no app, e o PDF é gerado por renderer HTML→PDF, o impacto é marginal (56×56 renderizado).
- Thumbnails quebradas (URL 404): adicionar `onerror="this.style.display='none'"` no `<img>` do PDF e fallback silencioso no React (já tratado pelo `image_url` nulo + `<img>` padrão do browser esconde alt).

## Arquivos a alterar

1. `src/components/proposals/ProposalItemsManager.tsx` — thumb na linha do item
2. `src/components/proposals/ProposalPreview.tsx` — thumb nas tabelas de itens
3. `src/pages/ProposalPublicView.tsx` — `max-w-7xl` + thumbs nas tabelas de itens (avulsos e recorrentes); manter prose interno em `max-w-4xl`
4. `supabase/functions/generate-proposal-pdf/index.ts` — `<img>` no `<td>` do item + ajuste de largura de coluna

## Próximos passos

Aprovado o plano, implemento os 4 ajustes em uma única rodada, sem tocar em business logic. Validação visual: abrir a mesma proposta `PROP-2026-00639` no editor, no Visualização Rápida, no link público e gerar o PDF para conferir as miniaturas e a nova largura.
