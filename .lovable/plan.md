

# Plano: Corrigir UX Mobile — Criação de Oportunidade e Editor de Proposta

## Problemas identificados (screenshots)

1. **CreateOpportunityModal**: Labels sobrepostos no mobile — "Empresa/Contato", "Funil/Vendedor", "Origem/Data" aparecem na mesma linha. O `col-span-2` no título precisa ser `col-span-1 md:col-span-2`. Espaçamento entre campos insuficiente.

2. **AccountCombobox**: `PopoverContent` tem `w-[400px]` fixo — mais largo que a tela do iPhone. Botão "Criar Nova Empresa" fica escondido (precisa rolar toda a lista). Mesmo problema no **ContactCombobox**.

3. **ProposalEditorHeader** (página de edição de proposta, IMG_7882/7883): Botões "Gerar PDF", "Visualização Rápida" e "Salvar" em linha horizontal sem responsividade — ficam cortados no mobile. O título e número da proposta também se sobrepõem.

## Alterações

### 1. AccountCombobox — `src/components/opportunity/AccountCombobox.tsx`
- `PopoverContent` de `w-[400px]` para `w-[calc(100vw-2rem)] sm:w-[400px]`
- Mover "Criar Nova Empresa" para o **topo** da lista (antes dos resultados), não embaixo — assim o botão fica sempre visível sem rolar

### 2. ContactCombobox — `src/components/opportunity/ContactCombobox.tsx`
- Mesma correção: `PopoverContent` responsivo
- Mover "Criar Novo Contato" para o topo

### 3. CreateOpportunityModal — `src/components/CreateOpportunityModal.tsx`
- `col-span-2` → `md:col-span-2` nos campos que precisam ocupar largura total
- Aumentar gap entre campos
- Garantir que cada campo ocupe 100% no mobile

### 4. ProposalEditorHeader — `src/components/proposals/ProposalEditorHeader.tsx`
- Layout mobile: empilhar header verticalmente
- Botões de ação: no mobile, usar apenas ícones (sem texto) ou empilhar em linha com scroll
- Título e número da proposta: empilhar verticalmente no mobile
- Botões ficam em uma segunda linha no mobile com `flex-wrap`

### Arquivos modificados
1. `src/components/opportunity/AccountCombobox.tsx`
2. `src/components/opportunity/ContactCombobox.tsx`
3. `src/components/CreateOpportunityModal.tsx`
4. `src/components/proposals/ProposalEditorHeader.tsx`

