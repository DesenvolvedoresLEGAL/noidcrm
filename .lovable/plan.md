

# Diagnóstico: Celebração e Slack não dispararam na proposta HILÊ

## Causa Raiz

A proposta HILÊ (ID: `4bacf69d`) foi aceita às 16:15:32, mas a edge function `generate-acceptance-proof` **nunca executou** — zero logs nos registros do servidor. A função tem **1004 linhas** e provavelmente excedeu o timeout de 30 segundos nas 3 tentativas do `invokeWithRetry`.

Quando isso acontece, o código cai no fallback `directProposalApproval`, que apenas atualiza o status da proposta para "accepted" no banco — **não cria notificações `deal_won`, não envia Slack, não dispara celebração**.

As notificações de `proposal_status` e `opportunity_status` que aparecem no sidebar vieram de um trigger de banco de dados, não da edge function.

```text
Fluxo Esperado:
  Cliente aceita → generate-acceptance-proof → notificações deal_won + Slack + celebração

Fluxo Real:
  Cliente aceita → generate-acceptance-proof TIMEOUT → directProposalApproval (só muda status)
  → Trigger DB cria notificações genéricas (proposal_status, opportunity_status)
  → SEM deal_won, SEM Slack, SEM celebração
```

## Solução

Criar uma edge function leve `post-acceptance-effects` que é chamada **tanto** pelo caminho principal quanto pelo fallback. Isso garante que, mesmo quando `generate-acceptance-proof` falha, as celebrações e Slack ainda disparam.

### 1. Nova Edge Function `post-acceptance-effects`
Responsabilidades isoladas (sem gerar PDF, sem lógica pesada):
- Buscar dados mínimos da proposta + oportunidade
- Criar notificações `deal_won` / `team_deal_won` para stakeholders (com `show_celebration: true`)
- Enviar notificação Slack para o canal #geral
- Execução rápida (< 5s)

### 2. Atualizar `directProposalApproval` em `ProposalPublicView.tsx`
Após o fallback atualizar o status com sucesso, chamar `post-acceptance-effects` em modo fire-and-forget:
```typescript
// After direct approval succeeds
supabase.functions.invoke('post-acceptance-effects', {
  body: { proposalId, opportunityId: proposal.opportunity.id }
});
```

### 3. Atualizar `generate-acceptance-proof`
Após criar as notificações e enviar Slack (que já faz), marcar um flag para evitar duplicação:
- Inserir `metadata.effects_triggered = true` nas notificações
- A `post-acceptance-effects` checará se já existem notificações `deal_won` para essa proposta antes de criar duplicadas

### 4. Atualizar `ProposalPublicView.tsx` - caminho principal
Após `generate-acceptance-proof` retornar sucesso, NÃO chamar `post-acceptance-effects` (já foi feito dentro da function). Apenas no fallback.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/post-acceptance-effects/index.ts` | **Novo** — celebrações + Slack + notificações leves |
| `src/pages/ProposalPublicView.tsx` | Chamar `post-acceptance-effects` no fallback `directProposalApproval` |
| `supabase/functions/generate-acceptance-proof/index.ts` | Nenhuma alteração (continua tentando normalmente) |

## Resultado
- Se `generate-acceptance-proof` funcionar: celebrações disparam normalmente (como antes)
- Se falhar/timeout: o fallback agora também dispara celebrações e Slack via `post-acceptance-effects`
- Anti-duplicação garante que se ambos rodarem, as notificações não são duplicadas

