## Diagnóstico forense

A oportunidade `b92b045f...` foi reaberta e reaprovada. Comparando os dois jobs em `acceptance_effect_jobs`:

| Aceite | Job criado | Notifs legacy | Notifs v2 (celebração) | Slack |
|--------|-----------|---------------|------------------------|-------|
| 19:41 (1º aceite) | ok | criou `deal_won` para toda a org | criou v2 para toda a org | enviou |
| 21:34 (re-aceite) | ok | **NÃO criou `deal_won`** (só `proposal_status`) | **NÃO criou nada em v2** | enviou (correto) |

### Causa raiz

Em `supabase/functions/post-acceptance-effects/index.ts` (linhas ~270-283), o guard de idempotência da etapa de notificações é global por proposta:

```ts
const { data: existingNotifs } = await supabase
  .from("notifications")
  .select("id")
  .in("type", ["deal_won", "team_deal_won", "new_contract", "new_onboarding"])
  .eq("metadata->>proposal_id", proposal_id)
  .limit(1);

if (existingNotifs && existingNotifs.length > 0) {
  // marca stage como done e sai — sem criar v2!
}
```

Quando a proposta é reaberta e re-aceita, esse check encontra os `deal_won` do **aceite anterior** e aborta. Resultado:
- Nenhum `notifications` novo
- Nenhum `notifications_v2` novo → `RealtimeNotificationListener` não emite toast, central de notificações não recebe item, `CelebrationProvider` (que escuta v2 `deal_won`) não dispara modal nem som

O Slack funcionou porque a etapa Slack usa claim atômico **por job** (`slack_processed_at` específico daquele job), não check global.

## Correção

Em `supabase/functions/post-acceptance-effects/index.ts`, restringir o check de idempotência ao escopo do `accepted_at` do job atual (a mesma chave única já usada em `acceptance_effect_jobs (proposal_id, accepted_at)`):

```ts
const { data: existingNotifs } = await supabase
  .from("notifications")
  .select("id")
  .in("type", ["deal_won", "team_deal_won", "new_contract", "new_onboarding"])
  .eq("metadata->>proposal_id", proposal_id)
  .gte("created_at", job.accepted_at)   // ← só conta o ciclo atual
  .limit(1);
```

Assim:
- Re-execução do mesmo job (retry) ainda é idempotente — encontra suas próprias notifs criadas após `accepted_at`.
- Re-aceite após reabertura (novo job, novo `accepted_at` mais recente) ignora notifs antigas e cria celebração/v2/toast/som normalmente.

Aplicar o mesmo padrão (`gte("created_at", job.accepted_at)`) em qualquer outro check global de notificações dentro do arquivo, se houver (verificar etapas de `new_contract`/`new_onboarding`).

## Arquivos impactados

- `supabase/functions/post-acceptance-effects/index.ts` — único ponto de alteração.

## Riscos

- Baixo. A mudança apenas reduz o escopo do guard; etapas continuam protegidas pelo `notifications_processed_at` do próprio job (já é setado ao final).
- Não toca em RLS, schema, tenant isolation, Slack, inventário ou contrato.

## Validação pós-deploy

1. Reabrir uma proposta de teste, re-aceitar.
2. Conferir:
   - `notifications` ganha novas linhas `deal_won` com `created_at >= accepted_at` do novo job.
   - `notifications_v2` ganha novas linhas `deal_won`.
   - Modal de celebração, som e toast aparecem para o vendedor.
   - Slack continua enviando apenas 1 mensagem (sem regressão da correção anterior).
