

# Módulo de Notificações PRIME — Sprint 1: Fundação

## Resumo

Criar 7 novas tabelas (+ enums), índices, RLS policies e a rota `/app/settings/notifications` com tela base. A tabela `notifications` existente (9454 registros) será mantida intacta — as novas tabelas coexistem e a migração futura de dados será feita em sprint posterior.

## Banco de Dados — Migration

### Enums
```sql
CREATE TYPE notification_priority AS ENUM ('low','medium','high','critical');
CREATE TYPE notification_status AS ENUM ('pending','sent','read','dismissed','failed');
CREATE TYPE notification_channel AS ENUM ('in_app','email','push');
CREATE TYPE delivery_status AS ENUM ('queued','sent','failed');
CREATE TYPE digest_run_status AS ENUM ('pending','success','failed');
```

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `notification_settings` | Preferências por usuário (toggles de canal/tipo) |
| `notification_events` | Eventos brutos do sistema |
| `notifications_v2` | Notificações geradas (usamos `_v2` para não colidir com a tabela existente) |
| `notification_delivery_logs` | Log por canal de entrega |
| `browser_push_subscriptions` | Subscrições do navegador |
| `daily_digest_runs` | Controle do job diário |
| `daily_digest_cache` | Cache do resumo para dashboard |

> **Nota**: A tabela atual `notifications` continua funcionando. Usamos `notifications_v2` para a nova arquitetura. Numa sprint futura, migraremos os dados e renomearemos.

### Índices
- `notifications_v2(user_id, status, created_at DESC)`
- `notification_events(event_type, occurred_at DESC)`
- `daily_digest_cache(user_id, digest_date DESC)`
- `browser_push_subscriptions(user_id, is_active)`

### RLS Policies
Todas as tabelas com RLS enabled. Regras:
- `notification_settings`: usuário lê/escreve apenas `user_id = auth.uid()`
- `notifications_v2`: usuário lê/atualiza apenas `user_id = auth.uid()`; INSERT via service role (backend)
- `notification_events`: SELECT para authenticated (filtrado por organization via `get_user_organization_id()`)
- `notification_delivery_logs`: SELECT via JOIN com notifications_v2 do próprio usuário (security definer function)
- `browser_push_subscriptions`: CRUD apenas `user_id = auth.uid()`
- `daily_digest_runs` / `daily_digest_cache`: SELECT apenas `user_id = auth.uid()`

### Security Definer Functions
- `can_read_delivery_log(log_id uuid)` — verifica se o notification_id pertence ao auth.uid()
- Reutiliza `get_user_organization_id()` já existente

## Frontend

### Nova Rota
`/app/settings/notifications` → `NotificationPreferences.tsx`

### Arquivos

| Ação | Arquivo |
|------|---------|
| Create | `src/pages/settings/NotificationPreferences.tsx` — tela com loading/empty states, toggles para cada preferência |
| Edit | `src/pages/settings/SettingsPageV3.tsx` — adicionar item "Notificações" na categoria "Minha Conta" |
| Edit | `src/pages/settings/SettingsLayout.tsx` — adicionar breadcrumb para `/app/settings/notifications` |
| Edit | `src/App.tsx` — adicionar Route para o componente |

### UI da Tela de Preferências
- Seção "Resumo Diário": toggle enabled, horário (select), canais (email/dashboard)
- Seção "Alertas em Tempo Real": toggles in-app, browser push, email
- Seção "Tipos de Alerta": toggles para proposal_view, proposal_expiring, client_reply, activity_due, team_events
- Botão "Salvar" com upsert em `notification_settings`
- Hook `useNotificationSettings` para carregar/salvar

### Hook
| Ação | Arquivo |
|------|---------|
| Create | `src/hooks/useNotificationSettings.ts` — CRUD contra `notification_settings` |

## O que NÃO entra nesta sprint
- Automações (triggers, edge functions)
- Envio de e-mails/push
- Digest diário
- Migração da tabela `notifications` antiga
- Centro de notificações redesenhado

