

## Problema

Dois problemas distintos causam o comportamento visto no screenshot:

1. **Template variables não resolvidas**: A ação `notify_user` no `execute-workflow` insere `action.config.title` e `action.config.message` diretamente no banco, sem substituir placeholders como `{{opportunity_title}}` e `{{opportunity_value}}`. Resultado: a notificação aparece com texto cru `"Deal ganho: {{opportunity_title}} - R$ {{opportunity_value}}"`.

2. **Celebração não dispara**: O `CelebrationProvider` só reage a notificações com `type` igual a `deal_won`, `team_deal_won`, `new_contract` ou `new_onboarding`, E com `metadata.show_celebration = true`. A notificação do workflow tem `type: 'workflow'` e não tem `show_celebration` no metadata — então é completamente ignorada pelo sistema de celebração.

## Plano

### 1. Resolver template variables no execute-workflow

**Arquivo**: `supabase/functions/execute-workflow/index.ts` (linhas ~560-573)

Antes de inserir a notificação, substituir placeholders comuns no `title` e `message`:

```typescript
const replaceTemplateVars = (text: string, opp: any) => {
  return text
    .replace(/\{\{opportunity_title\}\}/g, opp.title || '')
    .replace(/\{\{opportunity_value\}\}/g, parseFloat(opp.value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 }))
    .replace(/\{\{opportunity_status\}\}/g, opp.status || '')
    .replace(/\{\{owner_name\}\}/g, opp.owner_name || opp.owner?.name || '')
    .replace(/\{\{pipeline_name\}\}/g, opp.pipeline_name || '')
    .replace(/\{\{stage_name\}\}/g, opp.stage_name || '');
};
```

Aplicar nos campos `title` e `message` da ação `notify_user`.

### 2. Suportar celebração em notificações de workflow "deal won"

Na mesma ação `notify_user`, detectar se a notificação é sobre deal ganho (ex: título contém "Deal ganho" ou configuração explícita) e adicionar `show_celebration: true` no metadata + usar tipo `deal_won` em vez de `workflow`:

```typescript
const isCelebration = action.config?.celebrate === true || 
  (opportunity.status === 'won' && action.config?.title?.toLowerCase().includes('deal ganho'));

await supabase.from('notifications').insert({
  organization_id: opportunity.organization_id,
  user_id: action.config?.user_id || opportunity.owner_user_id,
  type: isCelebration ? 'deal_won' : 'workflow',
  title: resolvedTitle,
  message: resolvedMessage,
  metadata: {
    workflow_rule_id: rule.id,
    opportunity_id: opportunity.id,
    ...(isCelebration ? {
      show_celebration: true,
      value: opportunity.value,
      account_name: opportunity.account_name,
    } : {}),
  },
});
```

### 3. Deploy

Redeployar a Edge Function `execute-workflow`.

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| `supabase/functions/execute-workflow/index.ts` | Adicionar interpolação de template vars + suporte a celebração em notify_user |

