

# Sincronização de Respostas de E-mail no NOID CRM

## Problema

Quando o vendedor envia um e-mail pelo CRM via SMTP, a resposta do cliente chega apenas no Gmail — não aparece no histórico de e-mails da oportunidade. O vendedor precisa ficar dentro do CRM sem depender de abrir o Gmail.

## Arquitetura da Solução

O sistema já tem Gmail OAuth configurado (`sync-emails`, `gmail-oauth-callback`) e uma tabela `opportunity_emails` para histórico. O que falta é:

1. Buscar respostas via Gmail API e vinculá-las às oportunidades
2. Mostrar e-mails recebidos no histórico (distinguindo enviados de recebidos)
3. Notificar o vendedor em tempo real quando uma resposta chega

```text
Cliente responde e-mail
        │
        ▼
   Gmail Inbox
        │
        ▼
  sync-email-replies (Edge Function - polling via cron ou manual)
        │
        ├─ Busca threads do Gmail que contenham e-mails enviados pelo CRM
        ├─ Identifica mensagens novas (replies)
        ├─ Vincula à oportunidade via thread_id ou opportunity_email original
        ├─ Insere em opportunity_emails com direction = 'inbound'
        └─ Cria notificação para o vendedor
                │
                ├─ Badge no sino
                └─ Toast realtime
```

## Alterações

### 1. Migration: adicionar campos à tabela `opportunity_emails`

- `direction` (text, default `'outbound'`) — distinguir enviado vs recebido
- `gmail_message_id` (text, nullable) — ID da mensagem no Gmail para deduplicação
- `gmail_thread_id` (text, nullable) — thread ID para agrupar conversas
- `in_reply_to` (uuid, nullable, FK para `opportunity_emails.id`) — referência ao e-mail original que foi respondido

Atualizar os registros existentes: todos passam a ter `direction = 'outbound'`.

### 2. Edge Function: `sync-email-replies`

Nova função que:
- Lê `email_sync_config` do usuário (Gmail OAuth token)
- Busca em `opportunity_emails` os e-mails enviados pelo CRM que tenham `gmail_thread_id` ou que precisem buscar o thread
- Para cada e-mail enviado recente, consulta a thread no Gmail API
- Identifica mensagens na thread que NÃO foram enviadas pelo vendedor (são respostas)
- Deduplicação por `gmail_message_id` — não insere se já existe
- Insere reply em `opportunity_emails` com `direction = 'inbound'`
- Cria notificação do tipo `email_reply_received` para o `sent_by` do e-mail original

### 3. Atualizar `send-smtp-email` para gravar `gmail_thread_id`

Após enviar via SMTP, o sistema não tem o `gmail_message_id` diretamente. Mas podemos:
- Gerar um `Message-ID` header customizado antes do envio e gravá-lo
- Na sync, buscar por subject matching + contato para vincular threads

Alternativa mais robusta: após enviar o e-mail, fazer uma busca rápida no Gmail API pelo subject + destinatário para capturar o `thread_id` e atualizar o registro. Isso garante matching perfeito.

### 4. Atualizar `OpportunityEmailsTab.tsx`

- Mostrar indicador visual de direção (enviado ↗ vs recebido ↙)
- E-mails recebidos com avatar/cor diferente
- Badge "Resposta" para e-mails inbound
- Botão "Sincronizar respostas" manual (além do cron)

### 5. Notificação realtime

- Ao inserir reply inbound, criar `notification` com tipo `email_reply_received`
- Metadata: `{ account_name, subject, opportunity_id, from_email }`
- No `useNotifications.ts`, adicionar toast para esse tipo:
  - "Nova resposta: [assunto] de [remetente]"
  - Link direto para a aba de e-mails da oportunidade

### 6. Polling automático (pg_cron)

- Agendar `sync-email-replies` para rodar a cada 5 minutos via pg_cron
- Busca para todos os usuários com `sync_enabled = true`
- Inclui refresh de token OAuth se necessário

## Arquivos impactados

| Arquivo | Alteração |
|---------|-----------|
| Migration SQL | Adicionar `direction`, `gmail_message_id`, `gmail_thread_id`, `in_reply_to` |
| `supabase/functions/sync-email-replies/index.ts` | **Nova** — busca respostas no Gmail e insere no CRM |
| `supabase/functions/send-smtp-email/index.ts` | Gravar Message-ID customizado; buscar thread_id no Gmail após envio |
| `src/components/opportunity/OpportunityEmailsTab.tsx` | Visual de direção + botão sync manual |
| `src/services/supabase/opportunity-emails.ts` | Interface atualizada com novos campos |
| `src/hooks/useNotifications.ts` | Toast para `email_reply_received` |

## Pré-requisito

O vendedor precisa ter o Gmail conectado via OAuth nas configurações de integração (que já existe). A sync de respostas usa o mesmo token OAuth já configurado.

## Resultado

- Respostas de clientes aparecem automaticamente no histórico de e-mails da oportunidade
- Vendedor recebe notificação visual em tempo real
- Vendedor permanece 100% dentro do NOID CRM sem precisar abrir o Gmail

