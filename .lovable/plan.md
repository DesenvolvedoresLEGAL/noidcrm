

# Plano Mundial — Centro de Notificações Unificado (NOID PRIME Inbox)

## Diagnóstico (estado atual = caos)

Existem **2 sistemas paralelos** de notificação rodando simultaneamente:

| Entrada | Onde | Tabela backend | Hook | Recursos |
|---|---|---|---|---|
| 🔔 Sino | Header (mobile + barra desktop dedicada) | `notifications` (v1) | `useNotificationsCenter` | Filtros, prioridade, push, dismiss |
| ⭐ Estrela | Sidebar (NOID CRM) | `notifications_v2` (legado) + Release Notes | `useNotifications` | Notificações + Novidades (release notes) |

**Problemas reais:**
1. Usuário não sabe qual ícone clicar — duas caixas, dois contadores diferentes (99+ vs 100).
2. O sino ocupa uma faixa horizontal inteira no desktop (`h-10` border-b), quebrando o design limpo.
3. Notificações estão **fragmentadas em duas tabelas** — eventos novos vão pra `notifications_v2`, mas eventos legados ainda chegam em `notifications`.
4. Release Notes (Novidades) ficam isolados na estrela, sem integração com o resto.
5. Mobile mostra o sino mas a estrela está escondida (sidebar fechada).

## Visão de Produto (referência: Linear, Front, HubSpot, Salesforce Lightning)

CRMs de classe mundial usam **um único Inbox** acessível de qualquer lugar, organizado por **intenção do usuário**, não por origem técnica do evento.

**Princípios:**
- **Um único ponto de entrada visual** (a estrela na sidebar, com badge unificado).
- **Drawer lateral amplo (sheet)** ao invés de popover apertado — espaço pra contexto.
- **Tabs de intenção**, não de tabela: `Prioridade`, `Atividades`, `Propostas`, `Conversas`, `Novidades`.
- **Inbox Zero** — cada item tem ação primária clara (Abrir, Concluir, Dispensar, Adiar).
- **Snooze** (lembrar mais tarde) e **Bulk actions** (marcar todas, dispensar todas por categoria).
- **Sticky "Resumo do Dia"** no topo quando há digest disponível.
- **Filtros persistentes** por usuário (lembrar última aba).

## Plano de Execução

### Fase 1 — Limpar o caos (entregável imediato)

1. **Remover o sino do desktop**: deletar a faixa `h-10` em `Layout.tsx` (linhas 25-28).
2. **Remover o sino do mobile**: substituir `MobileHeader.tsx` para usar a estrela nova ou deixar só o trigger da sidebar.
3. **Deprecar `src/components/NotificationBell.tsx`** (não usado em lugar nenhum mais).
4. **Promover a estrela da sidebar** como o único entry point, com badge unificado de TODAS as fontes.

### Fase 2 — Unificar as duas tabelas (PRIME Inbox)

Criar **`useUnifiedInbox`** que mescla:
- `notifications_v2` (priority/dismiss/push) — fonte principal
- `notifications` v1 (legado — manter leitura até migração total)
- `release_notes` (novidades)
- `daily_digest_cache` (resumo do dia → item sticky)

Contagem unificada: `criticas + altas_não_lidas + novidades_não_vistas`.

### Fase 3 — UX de classe mundial (novo `UnifiedNotificationInbox.tsx`)

Substituir os dois NotificationCenter por um único componente:

```text
┌─ Sidebar Header ──────────────┐
│ NOID CRM                  ⭐3 │ ← badge unificado
└───────────────────────────────┘
        │ click
        ▼
┌─ Sheet (right, 480px) ─────────────────────────┐
│ 📥 Caixa de Entrada              [⚙️] [✓ todas]│
├────────────────────────────────────────────────┤
│ [Prioridade•3] [Atividades] [Propostas]        │
│ [Conversas] [Novidades•2] [Tudo]               │
├────────────────────────────────────────────────┤
│ ☀️ Resumo do dia (sticky se existe digest)     │
│   5 atrasadas · 2 vencendo · 1 resposta        │
│   [Abrir resumo completo]                      │
├────────────────────────────────────────────────┤
│ 🔴 Crítico · há 1 min                          │
│   Proposta PROP-2026-00527 vencida             │
│   [Abrir] [Adiar 1h] [Dispensar]               │
├────────────────────────────────────────────────┤
│ 🟠 Alta · há 12 min                            │
│   Cliente respondeu · Empresa X                │
│   [Abrir conversa] [Lida]                      │
└────────────────────────────────────────────────┘
```

**Tabs de intenção** (não de tabela):
- **Prioridade** — apenas `critical` + `high` não lidos
- **Atividades** — overdue, today, completed
- **Propostas** — visualizadas, vencendo, aceitas/recusadas
- **Conversas** — replies de email/WhatsApp
- **Novidades** — release notes
- **Tudo** — feed cronológico

**Ações por item:**
- Abrir (navega ao `action_url`, marca como lida)
- Adiar (snooze 1h / 4h / amanhã) — campo novo `snoozed_until`
- Dispensar
- Lida

**Footer fixo do sheet:**
- "Configurar notificações" → `/app/settings/notifications`
- "Ver histórico completo" → `/app/notifications`

### Fase 4 — Polimento

- **Onboarding tour** apontando pra estrela na primeira visita pós-deploy.
- **Mobile**: estrela na sidebar permanece (já existe trigger), badge replicado no `SidebarTrigger` quando colapsada.
- **Persistência**: última aba selecionada salva em `localStorage`.
- **Realtime**: o `RealtimeNotificationListener` já existe — mantém os toasts, mas agora invalida o inbox unificado.

## Detalhes Técnicos

**Arquivos a modificar:**
- `src/components/Layout.tsx` — remover faixa do sino desktop (linhas 25-28).
- `src/components/MobileHeader.tsx` — remover `<NotificationCenter />`.
- `src/components/AppSidebar.tsx` — substituir `NotificationCenter` (legado) por `UnifiedNotificationInbox`. Garantir que aparece também quando sidebar está colapsada (ícone na parte inferior do header collapsed).

**Arquivos a criar:**
- `src/components/notifications/UnifiedNotificationInbox.tsx` — novo componente Sheet com tabs de intenção.
- `src/hooks/useUnifiedInbox.ts` — merge de v1 + v2 + release_notes + daily_digest com contagem unificada.

**Arquivos a deprecar (deletar):**
- `src/components/NotificationBell.tsx`
- `src/components/NotificationCenter.tsx` (legado raiz — vira o novo Unified)
- `src/components/notifications/NotificationCenter.tsx` (será substituído)

**Backend (opcional, fase 2.1):**
- Adicionar coluna `snoozed_until timestamptz` em `notifications_v2`.
- RLS já existe — só estender filtro `snoozed_until IS NULL OR snoozed_until <= now()`.

**Memória do projeto:**
- Salvar regra: "Inbox unificado é fonte única na sidebar (estrela). Nunca duplicar entry points de notificação no header."

## Resultado Esperado

- ✅ **Um único ícone**, na sidebar (estrela), com contador correto.
- ✅ **Header limpo** — devolve o espaço vertical ao conteúdo.
- ✅ **Mobile coerente** — mesma experiência via sidebar.
- ✅ **Inbox por intenção** (Prioridade, Atividades, Propostas, Conversas, Novidades) ao invés de "v1 vs v2".
- ✅ **Resumo do dia** integrado no topo do drawer.
- ✅ **Snooze + Bulk actions** — produtividade real, padrão Linear/Front.
- ✅ **Zero perda** — todas as fontes (v1, v2, release notes, digest) consolidadas.

## Pergunta antes de implementar

Quer que eu execute as **4 fases de uma vez** (entrega completa do PRIME Inbox), ou prefere fasear:
- **MVP (Fase 1+3 simplificada)**: remove sino, unifica na estrela com tabs básicas — entrega rápida.
- **Completo (Fases 1→4)**: tudo incluindo snooze, daily digest sticky, persistência de aba.

