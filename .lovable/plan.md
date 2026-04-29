## Reorganização de Menus: Kairós unificado + Playbooks só Estratégia

### Objetivo
- Mover **Optimization** e **Experiments** para dentro da página **Kairós** como abas internas.
- Adicionar a aba **Performance** (a mesma de Playbooks) dentro do Kairós.
- Remover as abas **Execução** e **Performance** da página Playbooks (Playbooks fica só com Estratégia).
- Remover **Optimization** e **Experiments** do menu lateral (Inteligência), deixando apenas **Kairós** como entry point.

### Estrutura final do Kairós (tabs internas)
```text
Kairós
├── 🧭 Sourcing       → LeadSourcingEngine (conteúdo atual do Kairós)
├── ⚡ Optimization   → conteúdo de OptimizationHub (sem Layout/PageHeader)
├── 🧪 Experiments   → conteúdo de ExperimentsHub (sem Layout/PageHeader)
└── 📊 Performance   → PlaybookPerformance (movido de Playbooks)
```

### Estrutura final de Playbooks
```text
Playbooks
└── 🎯 Estratégia    → lista/cards de playbooks (sem Tabs)
```

### Sidebar (Inteligência)
Remover:
- `/app/intelligence/optimization`
- `/app/intelligence/experiments`

Manter `Kairós` (`/app/intelligence/kairos`) como ponto único.

### Detalhes técnicos

1. **`src/pages/intelligence/KairosHub.tsx`**
   - Adicionar `Tabs` com 4 abas (Sourcing / Optimization / Experiments / Performance).
   - Importar componentes diretamente (sem reusar páginas inteiras para evitar duplo `<Layout>`):
     - Sourcing: `LeadSourcingEngine`
     - Optimization: `ImpactSummaryCard`, `RecommendationsPanel`, `InsightsFeed`, `AutoModeToggle`, `ActionsHistoryTable` (mesmo grid layout do `OptimizationHub`)
     - Experiments: `ExperimentImpactSummary`, `ExperimentsFeed`, `GuardrailsCard` (mesmo grid layout do `ExperimentsHub`)
     - Performance: `PlaybookPerformance`
   - Estado `activeTab` controlado, com suporte a `?tab=optimization|experiments|performance|sourcing` via `useSearchParams` para deep-link (e para backward compat das rotas removidas).

2. **`src/pages/intelligence/PlaybooksHub.tsx`**
   - Remover o componente `Tabs` envolvente. Renderizar diretamente o conteúdo da aba "Estratégia" (stats + filtros + cards).
   - Remover imports de `LeadSourcingEngine` e `PlaybookPerformance` neste arquivo.
   - Remover `useState` do `activeTab`.

3. **`src/components/AppSidebar.tsx`**
   - Remover as duas linhas de `ALL_MENU_ITEMS`:
     - `/app/intelligence/optimization` (Optimization)
     - `/app/intelligence/experiments` (Experiments)

4. **`src/App.tsx` (compat de rotas)**
   - Manter as rotas `/app/intelligence/optimization` e `/app/intelligence/experiments` redirecionando para `/app/intelligence/kairos?tab=optimization` e `?tab=experiments` via `<Navigate replace />`. Isso evita 404 em links antigos / bookmarks.

5. **AdminSidebar / outras referências**
   - `rg` confirma que as únicas referências de menu lateral são em `AppSidebar.tsx`. Não há entrada equivalente no `AdminSidebar`.

### Riscos
- Baixo. Mudança puramente de UI/navegação. Nenhuma alteração em RLS, edge functions ou banco.
- Deep links externos para Optimization/Experiments seguem funcionando via redirect.
- Performance card de Playbooks continua disponível, apenas em outro local (Kairós → Performance).

### Próximos passos após aprovação
1. Editar `KairosHub.tsx` com as 4 tabs.
2. Simplificar `PlaybooksHub.tsx` removendo Tabs.
3. Remover itens do `AppSidebar.tsx`.
4. Adicionar redirects em `App.tsx`.
