

# Análise Forense: Aprovação Frasnelli sem Slack/Celebração

## Evidência do banco

**Proposta**: `a1b374bd-...` (OPERADORA LEGAL), aceita `2026-04-22 12:28:29`, valor R$ 2.816,90.

**Job de side effects** (`acceptance_effect_jobs`):
| Campo | Valor |
|---|---|
| `notifications_processed_at` | ✅ 12:28:47 |
| `slack_processed_at` | ❌ **NULL** |
| `status` | `failed` |
| `last_error` | "Partial completion - some stages pending" |

**Notificações v2 criadas** (4 — Glaucia, Leandro, Bruno, Wagner): todas com `event_id` apontando para `notification_events` com `show_celebration=true`. Ou seja, o pipeline funcionou **exceto Slack e modal de celebração**.

## Causas raiz (3 bugs distintos)

### Bug 1 — Slack quebrado: header de auth aponta para chave errada

`supabase/functions/post-acceptance-effects/index.ts:390`
```ts
Authorization: `Bearer ${OPENAI_API_KEY}`,
"X-Connection-Api-Key": SLACK_API_KEY,
```
Durante a migração OpenAI (memória `openai-migration-and-temporal-guards`), o `LOVABLE_API_KEY` foi sobrescrito por `OPENAI_API_KEY`. Mas o **gateway do Slack da Lovable exige `LOVABLE_API_KEY` como Bearer**. Resultado: o gateway responde `invalid_auth`, que é não-retryable, e o `slack_processed_at` fica NULL para sempre.

### Bug 2 — Canal Slack hardcoded de outra organização

Linha 376: `channel: "C05CKC6TBQB"` hardcoded. Esse ID provavelmente pertence ao workspace original (não é o da OPERADORA LEGAL). Mesmo com auth correto, multi-tenant quebraria. Precisa vir de configuração por organização.

### Bug 3 — Modal de celebração não dispara para o Wagner

Pelo replay do CelebrationProvider (linha 173): ele escuta `INSERT` em `notifications_v2` com `filter: user_id=eq.${user.id}` e busca o payload em `notification_events`. Os dados estão corretos no banco. Hipóteses:
- a) O usuário Wagner já estava com a aba CRM aberta quando a aprovação ocorreu — mas o trigger do realtime aconteceu antes da query do `notification_events` retornar, causando race com `await`.
- b) O `CelebrationProvider` não está montado na rota de proposta pública (a aprovação veio do link público, então o Wagner só viu quando voltou ao CRM — e a notificação é INSERT realtime, então quem **não estava conectado** não recebe o gatilho).

A correção é polling de notificações `deal_won` não-vistas dos últimos 5 min na montagem do `CelebrationProvider`, garantindo replay quando o vendedor reabre o CRM.

## Plano de correção

### Camada 1 — Fix Slack (crítico)

`supabase/functions/post-acceptance-effects/index.ts`:
1. Trocar `Bearer ${OPENAI_API_KEY}` por `Bearer ${LOVABLE_API_KEY}` no header do gateway Slack (linha 390).
2. Mesma correção em `supabase/functions/test-slack/index.ts`.
3. Buscar o canal Slack por organização: nova coluna `organizations.slack_channel_id` (nullable). Se NULL, usar fallback `SLACK_DEFAULT_CHANNEL` env var. Remover hardcode `C05CKC6TBQB`.

### Camada 2 — Resiliência do Slack stage

- Quando o canal não estiver configurado para a org **e** não houver fallback, marcar `slack_processed_at` como concluído com `last_error="Slack channel not configured"` (não-bloqueante) em vez de manter `failed` para sempre.
- Permitir reprocessar via UI: manter o worker varrendo jobs `failed` com `attempt_count < 5`.

### Camada 3 — Replay de celebração ao montar CelebrationProvider

`src/components/CelebrationProvider.tsx`:
- Ao montar (após `user.id` resolver), fazer 1 query buscando `notifications_v2` do usuário com `type IN (...CELEBRATION_TYPES)`, `read_at IS NULL`, `created_at > now() - 10min`. Para cada uma, chamar `handleRealtimeCelebration` (já existente), que carrega o payload e dispara modal/confete.
- Adicionar deduplicação: `Set<string>` de IDs já celebrados nesta sessão para evitar re-disparar se o realtime também trouxer.

### Camada 4 — Reprocessar a Frasnelli imediatamente

Pós-deploy, executar uma chamada manual:
```
curl -X POST .../post-acceptance-effects -d '{"proposalId":"a1b374bd-..."}'
```
Isso retoma o job `failed`, dispara Slack com auth corrigido + canal correto, e marca `completed`. O Wagner receberá o modal de celebração ao recarregar (via novo replay).

## Arquivos tocados

**Backend**
- `supabase/functions/post-acceptance-effects/index.ts` — fix auth header, channel from org, completion semantics.
- `supabase/functions/test-slack/index.ts` — fix auth header.
- **Migração**: `ALTER TABLE organizations ADD COLUMN slack_channel_id TEXT;`

**Frontend**
- `src/components/CelebrationProvider.tsx` — replay query no mount + dedupe Set.
- `src/components/settings/SlackSettings.tsx` (ou criar) — campo para o admin definir `slack_channel_id` da org. *Opcional nesta entrega — pode ficar como follow-up.*

## Validação

1. Deploy → curl manual no `post-acceptance-effects` com `proposalId` da Frasnelli.
2. Conferir `acceptance_effect_jobs.slack_processed_at NOT NULL` e `status='completed'`.
3. Wagner recarrega CRM → modal de celebração aparece (replay query) com aplausos + confete extreme.
4. Mensagem chega no canal Slack configurado.
5. Próxima aprovação real: tudo dispara em tempo real (notif v2 já estavam OK; Slack agora também; modal via realtime + replay como rede de segurança).

## Riscos

- A coluna `slack_channel_id` começa NULL em todas as orgs → primeiras execuções caem no fallback env. Documentar o env `SLACK_DEFAULT_CHANNEL` ou pré-popular com o canal atual da OPERADORA LEGAL via SQL manual no momento do deploy.
- Replay query roda 1x por sessão; janela de 10min evita spam de modais antigos.
- Não há mudança em RLS, schema crítico ou lógica de receita.

