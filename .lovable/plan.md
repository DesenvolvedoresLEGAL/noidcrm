

# Plano: Mobile-First para Oportunidades e Propostas

## Contexto
O usuário precisa usar o CRM pelo celular para criar oportunidades e propostas em campo. Atualmente os componentes usam layouts fixos (grids 2 colunas, modais largos, tabelas sem responsividade) que quebram no mobile.

## Componentes a alterar

### 1. PipelineToolbar (toolbar de oportunidades)
- Linha 46: `flex items-center gap-2 px-4 py-2` com tudo inline — no mobile empilhar
- Esconder filtros avançados (Higiene, Vendedor) em um menu colapsável no mobile
- Busca ocupa largura total no mobile
- Selects de pipeline e botão "+" ficam em linha compacta
- Botão criar: mostrar só o ícone `+` no mobile (já faz parcialmente com `hidden sm:inline`)

### 2. KanbanBoard (board de oportunidades)
- Já usa scroll horizontal — isso funciona no mobile
- Ajustar largura mínima das colunas para mobile (atualmente sem min-w explícito)
- Garantir que o scroll funcione bem com touch

### 3. CreateOpportunityModal (criar oportunidade)
- Linha 243: `max-w-2xl` — mudar para `max-w-2xl w-full` e no mobile usar fullscreen
- Linha 249: `grid grid-cols-2 gap-4` — mudar para `grid grid-cols-1 md:grid-cols-2 gap-4`
- Garantir que todos os campos fiquem empilhados no mobile
- DialogFooter: botões em coluna no mobile

### 4. EditOpportunityModal (editar oportunidade)
- Mesma abordagem do Create: `grid-cols-1 md:grid-cols-2`
- Linha 167: `max-w-2xl` → fullscreen no mobile
- Linha 174: `grid grid-cols-2` → `grid grid-cols-1 md:grid-cols-2`

### 5. ProposalEditorModal (criar/editar proposta)
- Linha 327: `max-w-7xl` — extremamente largo, inutilizável no mobile
- Mudar para fullscreen no mobile (`w-full h-full md:max-w-7xl md:max-h-[90vh]`)
- TabsList: tornar scrollável horizontalmente no mobile (5 tabs é muito)
- Linha 370: `grid grid-cols-1 md:grid-cols-2` — já está OK
- Botões de ação (linha 529): empilhar verticalmente no mobile, usar ícones sem texto
- RichTextEditor: garantir que funcione bem em tela pequena

### 6. ProposalsList (lista de propostas na oportunidade)
- Métricas (linha 121): `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`
- Tabela de propostas: converter para cards no mobile (esconder colunas menos importantes)

### 7. Página Proposals (listagem geral)
- Mesma abordagem: tabela → cards no mobile

## Detalhes técnicos

### Padrão de Dialog fullscreen no mobile
Criar uma classe/variante para dialogs mobile-first:
```
className="w-full h-[100dvh] max-w-full md:max-w-2xl md:h-auto md:max-h-[90vh] rounded-none md:rounded-lg"
```

### Padrão de tabela → cards no mobile
Em telas < md, renderizar cada row como um card empilhado em vez de uma linha de tabela. Usar `useIsMobile()` já existente no projeto.

### Arquivos que serão modificados
1. `src/components/pipeline/PipelineToolbar.tsx` — toolbar responsiva
2. `src/components/CreateOpportunityModal.tsx` — form fullscreen mobile
3. `src/components/opportunity/EditOpportunityModal.tsx` — form fullscreen mobile
4. `src/components/proposals/ProposalEditorModal.tsx` — editor fullscreen mobile + tabs scrolláveis
5. `src/components/proposals/ProposalsList.tsx` — cards no mobile
6. `src/pages/Proposals.tsx` — cards no mobile
7. `src/components/proposals/ProposalItemsManager.tsx` — tabela de itens responsiva

