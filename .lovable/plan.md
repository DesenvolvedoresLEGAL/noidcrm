

## Diagnóstico — por que o e-mail diário não chega

Investiguei o módulo end-to-end e encontrei **6 bugs críticos** que impedem qualquer envio:

### 1. ❌ Esquema da tabela `daily_digest_runs` divergente
A edge function `build-daily-digest` faz `INSERT { run_date, status, total_users }` e depois `UPDATE { processed_users, completed_at }`.
Mas a tabela em produção tem colunas **diferentes**: `user_id`, `scheduled_for`, `started_at`, `finished_at`, `summary_payload`, `email_sent`, `dashboard_cached`.
Não existe `total_users`, `processed_users`, nem `completed_at`.
**Resultado**: o INSERT falha no primeiro statement e a função aborta antes de processar qualquer vendedor.

### 2. ❌ Cron existe mas roda no horário errado (UTC)
O job `build-daily-digest-morning` está agendado para `35 5 * * *` (5:35 UTC = **2:35 BRT**), e o `notification_settings.daily_digest_time` do Wagner é `06:00` (intenção: 6h da manhã local). O cron ignora completamente a preferência do usuário — dispara para todos no mesmo horário UTC.

### 3. ❌ Edge function chama URL inexistente
`send-daily-digest-email` faz POST para `/functions/v1/send-email-smtp`, mas a função correta se chama **`send-smtp-email`** (com hífen no meio). Mesmo se chegasse, falharia.

### 4. ❌ Contrato incompatível com `send-smtp-email`
`send-daily-digest-email` envia `{ to, subject, html, user_id }`. A função real espera `{ to_emails, cc_emails, subject, html_body, opportunity_id, organization_id }` **e exige Authorization Bearer do usuário** (não service role). Cron roda sem usuário logado — sempre retorna 401.

### 5. ❌ Sem fallback real — apenas `console.log`
Se o usuário não tem SMTP configurado (apenas 5 dos 12 vendedores têm), o código apenas faz `console.log("Digest email prepared for...")` e retorna `success: true`. **Nenhum e-mail é enviado.**

### 6. ❌ Não respeita `daily_digest_email_enabled` nem `daily_digest_enabled`
A função busca todos os `sellers` ativos e nunca consulta `notification_settings`. Mesmo um usuário com digest desativado receberia (se funcionasse).

### Evidências coletadas
- `daily_digest_runs`: **0 registros** (nenhuma execução bem-sucedida desde a criação)
- `daily_digest_cache`: 12 registros (criados manualmente em testes anteriores via outro caminho)
- Logs de edge function: vazios para `build-daily-digest` e `send-daily-digest-email`
- Wagner: `daily_digest_enabled=true`, `daily_digest_email_enabled=true`, `daily_digest_time=06:00` ✅ configurado corretamente

---

## Plano

### Fase 1 — Corrigir `build-daily-digest`
- Atualizar INSERT/UPDATE para usar o schema real (`user_id`, `scheduled_for`, `started_at`, `finished_at`, `summary_payload`, `email_sent`).
- Filtrar vendedores juntando com `notification_settings`: pular quem tem `daily_digest_enabled = false`.
- Criar 1 row em `daily_digest_runs` por usuário (status `running` → `completed`/`failed`).
- Marcar `email_sent = true` somente após sucesso real do envio.

### Fase 2 — Reescrever `send-daily-digest-email` para usar Lovable Emails (queue + Resend infra)
- Trocar a chamada quebrada por uso direto da **infraestrutura de email transacional do Lovable** (`enqueue_email` RPC → fila pgmq → `process-email-queue`). Isto garante:
  - Retry automático em rate-limit/5xx
  - Suppression list respeitada (bounce/complaint)
  - Footer de unsubscribe automático
  - Logs em `email_send_log` para auditoria
- Manter SMTP custom como **prioridade 1** quando o usuário tem `user_smtp_configs.is_active = true`, corrigindo:
  - URL correta: `send-smtp-email`
  - Payload correto: `{ to_emails: [email], subject, html_body, organization_id }`
  - Como cron não tem JWT do usuário, vou criar uma **rota interna** em `send-smtp-email` que aceita `x-internal-secret` (mesmo padrão de `activity-reminders`) e um `user_id` explícito para resolver o SMTP config — sem quebrar a auth de usuários reais.
- Respeitar `daily_digest_email_enabled = false` (apenas in-app, pular email).

### Fase 3 — Cron por horário local
- Trocar o cron único `35 5 * * *` por execução **horária**: `0 * * * *`.
- A função `build-daily-digest` filtra os usuários cujo `daily_digest_time` (assumindo BRT/America/Sao_Paulo) bate com a hora UTC atual (ex.: 06:00 BRT = 09:00 UTC).
- Idempotência garantida pelo check em `daily_digest_cache` (já existe no código).

### Fase 4 — Configuração do email transacional
- Verificar/configurar domínio de email (`email_domain--check_email_domain_status`).
- Se ainda não há domínio: mostrar setup dialog para o usuário configurar o domínio remetente.
- Se já existe: scaffold do template `daily-digest` em React Email com a identidade visual NOID (cores #4D2BFB, gradiente, layout de cards).
- Registrar template em `TEMPLATES` e deploy.

### Fase 5 — Disparo de teste para amanhã
- Criar uma rota de teste manual (botão admin) ou simplesmente disparar via `curl_edge_functions` agora para o usuário Wagner, validando que o e-mail chega.
- Checar logs em `email_send_log` para confirmar `sent`.
- Confirmar que cron de amanhã 06:00 BRT (09:00 UTC) vai disparar para todos os 12 vendedores ativos.

### Fase 6 — Tests
- Atualizar `build-daily-digest/index_test.ts` para cobrir:
  - Filtro por `notification_settings.daily_digest_enabled`
  - Filtro por hora local (`daily_digest_time` vs hora UTC atual)
  - Idempotência (pular se já existe em `daily_digest_cache`)
- Adicionar `send-daily-digest-email/index_test.ts`:
  - Roteamento SMTP custom vs Lovable Emails
  - Pular se `daily_digest_email_enabled = false`

---

## Pergunta antes de prosseguir

Para a Fase 4, preciso saber qual caminho você prefere para envio do e-mail quando o usuário **não tem SMTP custom** configurado:

1. **Lovable Emails** (recomendado) — infraestrutura nativa, zero config extra, requer apenas configurar um domínio remetente (ex.: `notify.operadora.legal`).
2. **Apenas SMTP custom** — só envia para os 5 usuários que já configuraram SMTP. Os outros 7 recebem só notificação in-app.
3. **Resend via connector** — se você já tem conta Resend.

Recomendo a opção **1 (Lovable Emails)** — é o padrão da plataforma, tem retry automático, suppression list e analytics. Posso prosseguir com ela?

