

## Diagnóstico forense — por que o e-mail das 6h não chegou

Investiguei direto no banco. **Não foi um problema, foram TRÊS problemas em cascata. Cada um sozinho já bloqueia o envio.**

### Problema #1 — O cron NUNCA foi criado (causa raiz)
Consultei `cron.job` via analytics: **vazio**. Não existe nenhum cron agendado no projeto. A função `build-daily-digest` foi escrita esperando ser chamada de hora em hora (`0 * * * *`), mas o `SELECT cron.schedule(...)` nunca foi executado. **Nenhum agendamento = nenhuma execução = nenhum e-mail.**

Confirmação: `daily_digest_runs` está com **0 registros**. Nunca rodou uma vez sequer desde a criação da tabela.

### Problema #2 — Seu profile está sem e-mail
`profiles.email` do seu user (`fd4bbf6a...`) está **NULL**. Mesmo que o cron rodasse, a função pula o envio porque `userEmail` vem vazio (linha 220: `if (emailEnabled && userEmail)`). Você está como seller ativo, mas o profile precisa ter `email` preenchido para o digest endereçar a mensagem.

### Problema #3 — SMTP customizado ativo, sem fallback claro
Você tem `user_smtp_configs.is_active = true`. A função tenta SMTP primeiro; se falhar, cai no Resend. Mas se o SMTP estiver com credenciais inválidas, o erro é só logado e o usuário pode acabar sem receber. Precisa garantir que o fallback funcione e que erros fiquem visíveis em `daily_digest_runs`.

### Confirmações via banco
- `pg_cron 1.6.4` e `pg_net 0.19.5` instalados ✅
- `notification_settings`: digest enabled, hora 06:00, e-mail enabled ✅
- `cron.job`: **vazio** ❌
- `daily_digest_runs`: **0 linhas** ❌
- `profiles.email` do user: **NULL** ❌
- `sellers.active`: true ✅
- `user_smtp_configs.is_active`: true ✅

---

## Plano de fix definitivo

### FASE 1 — Criar o cron (CRÍTICO, resolve o root cause)
Migration que executa `cron.schedule('build-daily-digest-hourly', '0 * * * *', ...)` chamando `build-daily-digest` via `net.http_post` com Authorization Bearer (anon key) + `x-internal-secret`. Roda toda hora; a função filtra internamente quem é a hora local (06:00 BRT = 09:00 UTC).

Adicional: criar 2º cron `build-daily-digest-catchup` rodando às 12:00 UTC (9h BRT) que chama com `?ignore_hour=1` MAS com **proteção de idempotência reforçada** (já existe via `daily_digest_cache`) — garante recuperação se o slot das 9h UTC tiver falhado.

### FASE 2 — Corrigir profile.email faltando (CRÍTICO)
Migration que faz backfill: `UPDATE profiles SET email = (SELECT email FROM auth.users WHERE auth.users.id = profiles.id) WHERE email IS NULL`. Adicionar trigger `BEFORE INSERT/UPDATE ON profiles` que garante `email` sempre sincronizado de `auth.users` quando vier NULL.

### FASE 3 — Hardening do envio (alta prioridade)
Editar `build-daily-digest/index.ts`:
1. **Skipar com motivo registrado**: se `userEmail` for null, criar uma linha em `daily_digest_runs` com `status='skipped'` e `summary_payload={reason:'no_profile_email'}`, ao invés de pular silenciosamente.
2. **Adicionar coluna `error_text` (ou usar `summary_payload.error`)**: hoje quando falha o envio, só loga no console, sem trilha visível. Já temos `summary_payload` JSONB; vou padronizar gravação de `{error, error_at, channel}`.
3. **Tentar Resend mesmo se SMTP retornar erro de credencial**: hoje cai no Resend só se `resp.ok === false`, está OK, mas vou adicionar try/catch redundante.

### FASE 4 — Painel de observabilidade (visibilidade)
Criar/atualizar `src/components/admin/notifications/DailyDigestHealthCard.tsx`:
- Última execução do cron (hora + status)
- Total de runs hoje (sucesso/falha/skipped)
- Lista de usuários que receberam vs. não receberam, com motivo
- Botão "Disparar agora para mim" → invoca `build-daily-digest?force_user_id=<me>`

### FASE 5 — Teste manual imediato (validação)
Após o deploy, invocar manualmente:
```
POST /functions/v1/build-daily-digest?force_user_id=fd4bbf6a-cf4e-490e-94ca-d47166277590&ignore_hour=1
```
Para validar que o e-mail chega na sua caixa AGORA, sem esperar 24h pelo próximo ciclo.

### Arquivos a editar (~6)
1. **Migration** — `cron.schedule` + backfill `profiles.email` + trigger sync (1 arquivo)
2. **`supabase/functions/build-daily-digest/index.ts`** — registrar skipped/erro em `daily_digest_runs`
3. **`src/components/admin/notifications/DailyDigestHealthCard.tsx`** (novo) — painel de saúde
4. **`src/pages/settings/system/sections/NotificationsAdminSection.tsx`** ou similar — montar card
5. **Invocação manual** via `supabase--curl_edge_functions` para teste real
6. **Doc** — `docs/notificacoes-daily-digest.md` explicando arquitetura, cron, troubleshooting

### Resultado esperado após o deploy
- Cron `build-daily-digest-hourly` ativo, rodando todo `0 * * * *`
- Cron `build-daily-digest-catchup` às 12:00 UTC (segurança extra)
- Seu `profiles.email` preenchido
- Invocação manual: você recebe o e-mail em até 30 segundos via SMTP custom (ou Resend fallback)
- Amanhã 06:00 BRT (09:00 UTC): cron dispara automaticamente, e-mail chega
- Painel admin mostra saúde em tempo real
- `daily_digest_runs` passa a registrar TUDO (sucesso, skip, falha, motivo)

### Por que isso é o fix definitivo
Os 3 bugs eram independentes e silenciosos:
1. Sem cron → função nunca chamada → nada nos logs
2. Sem profile.email → função pulava sem registrar nada
3. Sem visibilidade de runs → impossível diagnosticar pela UI

Esta sprint resolve os 3 e adiciona observabilidade pra você nunca mais ficar no escuro sobre o digest.

### Tempo: ~25 min

