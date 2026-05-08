# Sprint INV 0.1 — Fundação do módulo Inventário

## Escopo
Apenas fundação: rota, item de menu, permissão e página base premium. Zero banco, zero CRUD, zero edge function.

## Arquivos a criar

### 1. `src/pages/operations/Inventory.tsx`
Página base do módulo, usando `PageContainer` + `PageHeader` (variant `teal` ou `indigo`) já existentes.

Estrutura:
- **Header**: ícone `Boxes`, título "Inventário", subtítulo "Controle operacional de equipamentos, chips, kits, reservas e disponibilidade.", badge "Módulo em implantação".
- **Grid 4 cards conceituais** (`Card` + `CardHeader/Content`), cada um com ícone, título, descrição e badge "Em breve":
  1. Equipamentos — `Package`
  2. Chips e Conectividade — `Wifi`
  3. Kits Operacionais — `Boxes`
  4. Reservas e Disponibilidade — `CalendarCheck`
- **Bloco "Como o Inventário vai funcionar"**: card com texto descritivo + lista numerada (8 fluxos futuros).
- **Bloco "Regra oficial de demanda por ocupação"**: card destacado com tabela de 4 linhas (faixas de ocupação x fator) + observação.
- **Estado vazio elegante**: usa `EmptyState` (ícone `Boxes`) com título "Inventário pronto para implantação", descrição da sprint e botão `disabled` "Configuração em breve".

Tudo usando tokens semânticos (`text-muted-foreground`, `bg-card`, `border-border`, etc.), responsivo (`grid-cols-1 md:grid-cols-2 lg:grid-cols-4`), sem cores hardcoded.

## Arquivos a editar

### 2. `src/App.tsx`
Adicionar lazy import e rota `/app/operations/inventory` dentro de `<ProtectedRoute>` + `<LazyRoute>`, no mesmo padrão de `/app/contracts`.

### 3. `src/components/AppSidebar.tsx`
- Importar ícone `Boxes`.
- Adicionar nova seção `'operacoes'` ao `SECTION_LABELS` com label `'Operações'`.
- Adicionar item ao `ALL_MENU_ITEMS`:
  ```ts
  { path: '/app/operations/inventory', label: 'Inventário', icon: Boxes, section: 'operacoes' }
  ```
- Adicionar `const operacoesItems = getItemsForSection('operacoes');` e renderizar a seção entre Gestão e Inteligência (ou após Gestão, conforme hierarquia operacional).

### 4. `src/hooks/usePermissions.ts`
Adicionar `'/app/operations/inventory'` apenas em:
- `VISIBLE_MENU_ITEMS.operations`

Owner/admin já recebem `'*'` (acesso automático). Sales, cs, manager, finance, viewer **não** recebem o item — comercial fica fora por padrão.

### 5. Bloqueio por URL direta
A rota `/app/operations/inventory` será envolta em um guard inline na página: ler `usePermissions()` e renderizar `<AccessDenied requiredLevel="partial" />` se o usuário não for owner/admin/operations. Isso reaproveita componentes existentes sem criar sistema paralelo.

```tsx
const { isOwner, isAdmin, role } = usePermissions();
if (!isOwner && !isAdmin && role !== 'operations') {
  return <AccessDenied title="Acesso restrito" description="Módulo Inventário disponível apenas para perfis operacionais." />;
}
```

## Critérios de aceite (resumo)
- Item "Inventário" aparece em "Operações" para owner/admin/operations.
- Sales/SDR/comercial/finance não veem o item nem acessam pela URL.
- Página renderiza header, 4 cards, bloco explicativo, tabela de demanda, estado vazio.
- Responsivo, dark-mode compatível, sem cores hardcoded.
- Nenhuma migração SQL, nenhuma tabela nova, nenhuma edge function.

## Riscos
- Baixo. Apenas adições; nada existente é alterado em comportamento.
- Confirmar que `role` está exposto por `usePermissions` (caso contrário, usar `roles.includes('operations')` via `useUserRole`).

## Próximos passos (Sprint INV 0.2)
Tabelas `inventory_items`, `inventory_categories`, `inventory_locations`; CRUD de equipamentos; cadastro de chips.
