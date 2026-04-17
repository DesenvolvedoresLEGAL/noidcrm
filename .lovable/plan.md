

# Plano — Página de Histórico Completo de Notificações (`/app/notifications`)

## Diagnóstico

A rota `/app/notifications` é referenciada no rodapé do PRIME Inbox (Sheet lateral), mas **não existe** em `src/App.tsx` → resulta em 404. O Sheet é ótimo para ações rápidas, mas falha em três cenários críticos:

1. **Auditoria histórica** — buscar uma notificação de semanas atrás
2. **Análise de comportamento** — entender padrões (quais tipos chegam mais, quando)
3. **Bulk operations em escala** — limpar centenas de itens, exportar, filtrar por período

## Visão de Produto (referência: Linear Inbox, Front, Gmail "All Mail", Slack Activity)

Uma **Central de Notificações full-page** com **3 zonas verticais**:

```text
┌────────────────────────────────────────────────────────────────┐
│ HEADER · Métricas + ações globais                              │
│ [📥 Total: 1.247] [🔴 Críticas: 3] [📅 Hoje: 42] [📈 7d: +18%] │
│                              [Exportar CSV] [⚙ Configurar]    │
├──────────────────┬─────────────────────────────────────────────┤
│ FILTROS (sidebar)│ LISTA (timeline agrupada por dia)           │
│                  │                                             │
│ 🔍 Buscar...     │ ▾ HOJE · 12 itens                          │
│                  │   🔴 09:42  Proposta vencida · PROP-527     │
│ Período          │   🟠 09:15  Cliente respondeu · Empresa X   │
│ ○ Hoje           │   ⚪ 08:30  Atividade concluída             │
│ ○ 7 dias  ●      │                                             │
│ ○ 30 dias        │ ▾ ONTEM · 28 itens                          │
│ ○ Personalizado  │   🟠 18:22  Proposta visualizada            │
│                  │   ...                                       │
│ Status           │                                             │
│ ☑ Não lidas      │ ▾ ESTA SEMANA · 156 itens                  │
│ ☑ Lidas          │                                             │
│ ☐ Dispensadas    │                                             │
│ ☐ Adiadas        │                                             │
│                  │                                             │
│ Categoria        │                                             │
│ ☑ Prioridade     │                                             │
│ ☑ Atividades     │                                             │
│ ☑ Propostas      │                                             │
│ ☑ Conversas      │                                             │
│ ☑ Novidades      │                                             │
│                  │                                             │
│ Prioridade       │                                             │
│ ☑ Crítico        │                                             │
│ ☑ Alta           │                                             │
│ ☑ Média          │                                             │
│ ☑ Baixa          │                                             │
│                  │                                             │
│ Origem           │                                             │
│ ☑ Sistema (v2)   │                                             │
│ ☑ Legado         │                                             │
│ ☑ Novidades      │                                             │
│                  │                                             │
│ [Limpar filtros] │                                             │
└──────────────────┴─────────────────────────────────────────────┘
```

## Recursos PRIME

### 1. Header com Métricas Reais
4 KPI cards no topo:
- **Total** acumulado (todas as fontes, sem dispensadas)
- **Críticas pendentes** (animação pulse se > 0)
- **Recebidas hoje**
- **Tendência 7 dias** (% vs semana anterior)

### 2. Filtros laterais (sidebar 240px)
- **Busca global** por título/mensagem (debounced)
- **Período**: Hoje, 7d, 30d, 90d, Personalizado (date range picker)
- **Status**: não lidas, lidas, dispensadas, adiadas
- **Categoria**: Prioridade, Atividades, Propostas, Conversas, Novidades
- **Prioridade**: Crítico, Alta, Média, Baixa
- **Origem**: Sistema (v2), Legado, Novidades
- Persistência via URL params (compartilhável)
- Botão "Limpar filtros"

### 3. Timeline agrupada por dia
- Agrupamento inteligente: **Hoje, Ontem, Esta semana, Mais antigo (por mês)**
- Cada grupo collapsible com contador
- Cada linha: ícone categoria + prioridade colorida + título + mensagem + tempo relativo
- **Bulk select** com checkbox por linha + checkbox master
- Ações em massa: Marcar lidas, Dispensar, Exportar selecionadas

### 4. Painel de detalhes (slide-over à direita ao clicar)
Mostra:
- Título + mensagem completa
- Metadata JSON renderizado (entity_type, entity_id, etc.)
- Timeline da notificação: criada → entregue → lida → dispensada
- Logs de entrega (in-app, email, push) via `notification_delivery_logs`
- Ações: Abrir destino, Marcar lida, Adiar, Dispensar

### 5. Empty state inteligente
Se nenhum filtro retorna nada → "Nenhuma notificação corresponde aos filtros" com botão "Limpar filtros".  
Se zero notificações totais → "Tudo limpo! 🎉" com link para configurar preferências.

### 6. Performance
- Paginação infinita (load more a cada 50 itens)
- Virtualização se > 200 itens visíveis
- Realtime: novas notificações aparecem no topo do grupo "Hoje" sem reload
- Cache 30s no React Query

### 7. Exportação
Botão "Exportar CSV" no header → gera CSV com filtros aplicados (id, tipo, título, prioridade, criado_em, lida_em, dispensada_em).

## Arquivos

**Criar:**
- `src/pages/NotificationsHistory.tsx` — página principal (layout 2 colunas)
- `src/components/notifications/history/NotificationsHeader.tsx` — KPIs + ações
- `src/components/notifications/history/NotificationsFilters.tsx` — sidebar filtros
- `src/components/notifications/history/NotificationsTimeline.tsx` — lista agrupada
- `src/components/notifications/history/NotificationGroupHeader.tsx` — cabeçalho do dia
- `src/components/notifications/history/NotificationRow.tsx` — linha selecionável
- `src/components/notifications/history/NotificationDetailPanel.tsx` — slide-over
- `src/hooks/useNotificationsHistory.ts` — fetch unificado (v2 + v1 + news) com filtros, paginação e busca

**Modificar:**
- `src/App.tsx` — adicionar `<Route path="/app/notifications" element={<NotificationsHistory />} />` (lazy loaded, dentro do layout protegido principal)

**Reutilizar:**
- Lógica de merge/categorize do `useUnifiedInbox.ts`
- Mutations `markRead`, `dismiss`, `snooze` do hook existente (extrair pra função compartilhada se necessário)

## Detalhes Técnicos

- **Layout**: flex horizontal, sidebar fixa 240px desktop, drawer mobile
- **Mobile**: filtros viram sheet (botão "Filtros" no header), timeline ocupa 100%
- **URL state**: `?period=7d&status=unread&category=proposals` (sincronizado com filtros)
- **Atalhos**: `j/k` próximo/anterior, `e` arquivar, `r` marcar lida, `/` focar busca
- **Acessibilidade**: navegação por teclado completa, ARIA labels, skip-link

## Resultado

- ✅ Rota `/app/notifications` deixa de dar 404
- ✅ Histórico de tudo (v2 + v1 + release notes) num só lugar
- ✅ Filtros poderosos com URL compartilhável
- ✅ Bulk actions em escala
- ✅ Painel de detalhes com logs de entrega
- ✅ Exportação CSV
- ✅ Mobile-first

