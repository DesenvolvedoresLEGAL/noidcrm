

The user is unhappy with the visual design of `/app/notifications`. Looking at the screenshot:
- Header is jammed against the top with no padding
- KPI cards span the full width without container limits
- Filters sidebar text is cut off ("USCAR" instead of "BUSCAR", "ERÍODO" instead of "PERÍODO", "TATUS" instead of "STATUS") — text overflow due to no padding
- Everything glued to viewport edges
- No visual hierarchy matching the Activities page reference (gradient header card with icon, KPI cards with proper spacing, breathing room)

Reference (Activities page): purple gradient header card with icon + title + description on left, primary CTA on right; KPIs in 4 equal cards with icon top-right; everything inside a padded container.

Need to view current files to understand layout.

# Plano — Redesign da Central de Notificações (padrão NOID PRIME)

## Diagnóstico visual

A tela atual quebra 3 padrões do design system:
1. **Sem container padding** — conteúdo grudado nas bordas (`px-0`)
2. **Sidebar de filtros com largura fixa apertada** — labels cortados ("USCAR", "ERÍODO", "TATUS")
3. **Header sem identidade visual** — falta o card gradient com ícone que existe em Atividades, Forecast, etc.

## Padrão de referência (tela de Atividades)

```text
┌──────────────────────────────────────────────────────┐
│ [container max-w-7xl mx-auto px-4 md:px-6 py-6]      │
│                                                      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ 🔔  Central de Notificações       [Exportar][⚙] │ │ ← Hero gradient
│ │     Histórico completo de tudo...                │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                 │
│ │Total │ │Críti.│ │Hoje  │ │Tend. │                 │ ← KPIs 4 cols
│ └──────┘ └──────┘ └──────┘ └──────┘                 │
│                                                      │
│ ┌─────────────┬──────────────────────────────────┐   │
│ │ Filtros     │ Timeline com bulk actions       │   │
│ │ (280px)     │                                  │   │
│ │             │                                  │   │
│ └─────────────┴──────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

## Mudanças

### 1. `src/pages/NotificationsHistory.tsx`
- Wrap em `<div className="container mx-auto px-4 md:px-6 py-6 space-y-6 max-w-[1600px]">`
- Substituir header simples por **hero card gradient** com ícone Bell/Inbox (igual Atividades)
- Layout filtros + timeline em `<Card>` com `border` e `rounded-xl`, gap apropriado
- Mobile: filtros viram Sheet acionado por botão "Filtros" no header

### 2. `src/components/notifications/history/NotificationsHeader.tsx`
- Refazer como **hero card** estilo Atividades:
  - Background `bg-gradient-to-br from-primary/10 via-primary/5 to-transparent`
  - Ícone grande (Inbox) em quadrado primary à esquerda
  - Título + subtítulo no centro
  - Botões "Exportar CSV" + "Configurar" à direita
- KPIs separados em grid `grid-cols-2 md:grid-cols-4 gap-4` com cards sólidos (não dentro do hero)
- Cada KPI card: ícone topo-direita, label uppercase, valor grande, hint pequeno

### 3. `src/components/notifications/history/NotificationsFilters.tsx`
- Largura mínima `w-72` (288px) → labels não cortam
- Reduzir padding interno excessivo
- Manter ScrollArea mas com `pr-4` pra não cortar checkboxes
- Mobile: virar `<Sheet>` lateral

### 4. `src/components/notifications/history/NotificationsTimeline.tsx`
- Adicionar `Card` wrapper com header sticky (bulk actions + contador)
- Espaçamento `divide-y` entre rows
- Hover state mais sutil
- Empty state centralizado e elegante

### 5. Responsividade
- **Mobile (<md)**: filtros em Sheet, KPIs em 2 colunas, timeline full-width
- **Tablet (md-lg)**: KPIs 4 colunas, filtros colapsáveis
- **Desktop (lg+)**: layout 2 colunas com filtros sticky à esquerda (280px) + timeline flexível

## Arquivos a modificar
- `src/pages/NotificationsHistory.tsx` — container, hero, layout 2 colunas responsivo
- `src/components/notifications/history/NotificationsHeader.tsx` — hero gradient + KPIs reformatados
- `src/components/notifications/history/NotificationsFilters.tsx` — largura, padding, mobile sheet
- `src/components/notifications/history/NotificationsTimeline.tsx` — card wrapper, sticky header, divide-y

## Resultado
- ✅ Respiro lateral consistente (container padded)
- ✅ Hero card com identidade visual (igual Atividades/Forecast)
- ✅ KPIs com hierarquia visual clara
- ✅ Filtros com labels legíveis (sem cortes)
- ✅ Mobile-first com Sheet de filtros
- ✅ Aderente ao design system NOID PRIME

