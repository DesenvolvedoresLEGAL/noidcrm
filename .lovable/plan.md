

## Problema

A página de proposta pública (`ProposalPublicView.tsx`) não é totalmente mobile-first. Vários elementos ficam cortados ou apertados em telas pequenas.

## Áreas com problemas de responsividade

### 1. Header (linhas ~941-1005)
- Logo + info da empresa e bloco "PROPOSTA COMERCIAL" ficam lado a lado (`flex items-start justify-between`) sem quebra em mobile
- **Fix**: Empilhar verticalmente em mobile (`flex-col md:flex-row`), centralizar ou alinhar à esquerda

### 2. Status Banner (linhas ~1010-1043)
- Ícone de 56px + texto lado a lado sem quebra
- **Fix**: Reduzir tamanho do ícone em mobile (`w-10 h-10 md:w-14 md:h-14`), ajustar texto (`text-lg md:text-xl`)

### 3. Tabelas de itens (linhas ~1200-1284)
- `overflow-x-auto` já existe, mas padding `px-4` e colunas fixas ficam apertados
- **Fix**: Reduzir padding em mobile (`px-2 md:px-4`), esconder coluna "Preço Un." em mobile e mostrar apenas Total, ou usar cards em mobile

### 4. Condições de Pagamento - Grid de detalhes (linha ~1370)
- `grid grid-cols-2 md:grid-cols-4` pode ficar OK, mas verificar padding
- **Fix**: Reduzir padding do container em mobile (`p-3 md:p-4`)

### 5. CTA Footer "Pronto para avançar?" (linhas ~1674-1692)
- Botões "Aprovar" e "Recusar" lado a lado sem wrap (`flex justify-center gap-4`)
- **Fix**: Empilhar em mobile (`flex-col sm:flex-row`), botões `w-full sm:w-auto`

### 6. Footer Vendedor + Ações (linhas ~1604-1663)
- Já tem `flex-col md:flex-row` ✓, mas botão "Baixar PDF" pode precisar de `w-full md:w-auto`

### 7. Documentos do Contrato - Navegação (linhas ~1505-1530)
- Título + botões de navegação lado a lado podem quebrar
- **Fix**: Empilhar em mobile, botões de navegação centralizados

### 8. Valores grandes (linha ~1156)
- `text-3xl` pode ser grande demais em mobile
- **Fix**: `text-2xl md:text-3xl`

## Resumo de mudanças

| Área | Mudança |
|------|---------|
| Header | `flex-col md:flex-row`, bloco proposta `w-full md:w-auto md:text-right` |
| Status Banner | Ícone e texto menores em mobile |
| Tabelas | Padding reduzido, fonte menor em mobile |
| CTA Buttons | `flex-col sm:flex-row`, botões `w-full sm:w-auto` |
| Docs navegação | Empilhar título e botões em mobile |
| Valores | `text-2xl md:text-3xl` |
| Container geral | Ajustar `py-4 md:py-8` no main |

Todas as mudanças são no arquivo `src/pages/ProposalPublicView.tsx`, usando classes Tailwind responsivas mobile-first.

