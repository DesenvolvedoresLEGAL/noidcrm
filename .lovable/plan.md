

## Diagnóstico (com dados reais do banco)

Confirmei via consulta direta ao banco com o usuário **wagner@operadora.legal**:
- **519 notificações no total**
- **116 ainda marcadas como NÃO LIDA no banco**
- Itens não lidos vão até 18/04 às 00:00 UTC (fora da janela "Hoje" do filtro local BRT)

A tela `/app/notifications` exibe **Total: 14** porque está filtrada por **Período = Hoje**, mas a Caixa de Entrada (estrela) carrega **TODAS** as notificações sem filtro de período. Resultado: o usuário "vê" tudo limpo na página de histórico, mas o badge e modal continuam mostrando 100+ atrasadas.

### Causas técnicas

1. **`useNotificationsHistory.bulkMarkRead`** só marca os items selecionados/visíveis no período atual. O usuário interpretou o "Tudo lido" do header da tela como "marcar todas as notificações", quando na verdade nem existe esse botão na página — o botão "Tudo lido" só existe **no Sheet do Inbox**, e ele de fato chama `.is('read_at', null)` em todas (deveria funcionar, mas pode ter falhado em algum ponto).

2. **Inconsistência semântica**: marcar como lido em uma view não dá feedback claro de que afetou todas as outras. Não há um botão "Marcar tudo como lido" globalmente acessível na própria tela `/app/notifications`.

3. **Filtro padrão "Hoje" engana o usuário** — vê KPI=14 e acha que esse é o universo total.

## Plano

### 1. Adicionar botão "Marcar todas como lidas" na Central de Notificações

Em `NotificationsHeader.tsx`, adicionar botão visível ao lado de "Exportar CSV":
- Aparece apenas quando há itens não lidos no `allItems` global (não filtrado)
- Mostra contador real: "Marcar X não lidas como lidas"
- Confirma ação se >50 itens
- Usa nova mutation `markAllReadGlobal` que ataca **todas** as notificações do usuário (sem filtro de período)

### 2. Criar `markAllReadGlobal` em `useNotificationsHistory.ts`

```typescript
const markAllReadGlobal = useMutation({
  mutationFn: async () => {
    if (!userId) return;
    // v2: TODAS as não lidas, sem filtro de período
    await supabase.from('notifications_v2')
      .update({ read_at: new Date().toISOString(), status: 'read' })
      .eq('user_id', userId)
      .is('read_at', null);
    // v1
    await supabase.from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    // news
    const allNewsIds = (await supabase.from('release_notes').select('id').limit(50)).data?.map(n => n.id) ?? [];
    const merged = [...new Set([...readNewsIds, ...allNewsIds])];
    setReadNewsIds(merged);
    localStorage.setItem(READ_NEWS_KEY, JSON.stringify(merged));
  },
  onSuccess: () => { invalidate(); invalidateInbox(); }
});
```

### 3. KPI "Não lidas no total" (fora do filtro de período)

Adicionar uma query separada no `useNotificationsHistory` que conta TODAS as não lidas do usuário (ignora período). Exibir esse número como hint no botão "Marcar todas" e como badge sutil no KPI de "Críticas pendentes" se houver discrepância significativa.

### 4. Confirmação visual unificada

Quando `markRead` é executado em qualquer fonte (modal de detalhe, linha do timeline, Inbox Sheet, bulk action), garantir que **todas** as queries relacionadas sejam invalidadas:
- `unified-inbox` (Sheet)
- `notif-history` (página)
- `notifications-center` (legado)

Já está parcialmente feito em `useNotificationsHistory`, mas falta no `useUnifiedInbox.markAllRead` invalidar `notif-history`.

### 5. Toast informativo

Após "Marcar todas como lidas":
- `toast.success("X notificações marcadas como lidas em todas as visualizações")`

### 6. Limpar estado atual do banco

Como há 116 notificações órfãs marcadas como não lidas para o Wagner (e outras 200+ para os demais), criar uma migration administrativa que **opcionalmente** marca como lidas todas as notificações com mais de 7 dias (data corte). Isso resolve o backlog. Pergunto ao usuário antes de aplicar essa migração.

## Arquivos modificados

- `src/hooks/useNotificationsHistory.ts` — adicionar `markAllReadGlobal` + query de `unreadCountGlobal`
- `src/hooks/useUnifiedInbox.ts` — invalidar também `notif-history` no `markAllRead`
- `src/components/notifications/history/NotificationsHeader.tsx` — botão "Marcar todas como lidas" com contador real
- `src/pages/NotificationsHistory.tsx` — wire-up do novo handler

## Pergunta

Quer que eu também aplique a **migration de cleanup** (marcar como lidas todas as `notifications_v2` com mais de 7 dias para todos os usuários) para zerar esse backlog acumulado de testes?

