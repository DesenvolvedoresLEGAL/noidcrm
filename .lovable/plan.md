
Corrigir o disparo do Email Agent agora exige um ajuste pequeno, mas crítico, no fluxo interno entre os workflows e o executor do agente.

## Diagnóstico confirmado

O workflow está sendo executado parcialmente para a oportunidade `ae53f70b-be5d-4dc1-be99-62675175ba96`:

- move a etapa
- cancela/cria atividade
- cria a run do agente

Mas a execução real do agente falha logo depois.

### Evidência no histórico do workflow
A execução mais recente (`workflow_executions.id = 48371304-27ac-4bf0-8b95-4dcb7032c6b9`) registrou:

```text
trigger_email_agent:
- run_id: 924cd146-8678-407e-aed2-a8c616ca13a0
- execution_mode: approval_pending
- executor_status: executor_failed
- executor_error: Unauthorized
```

### Evidência no banco
A run foi criada, mas ficou parada:

```text
ai_agent_execution_runs.id = 924cd146-8678-407e-aed2-a8c616ca13a0
execution_status = queued
execution_mode = approval_pending
```

E não existe item correspondente em `ai_agent_approval_queue`.

## Causa raiz

O `execute-workflow` já foi corrigido para:
- criar a run com `approval_pending`
- chamar `execute-email-agent-run` automaticamente

Mas ele faz essa chamada usando credencial interna/service role.

O problema é que `execute-email-agent-run` ainda exige um usuário autenticado via JWT real:

- lê `Authorization`
- chama `auth.getUser()`
- se não houver usuário válido, retorna `Unauthorized`

Ou seja:
- o workflow consegue enfileirar a run
- mas o executor do agente rejeita a chamada interna
- por isso nada aparece em Aprovações

## O que será implementado

### 1) Permitir execução interna segura no `execute-email-agent-run`
Ajustar `supabase/functions/execute-email-agent-run/index.ts` para aceitar dois modos válidos:

- chamada do usuário via JWT normal
- chamada interna via `x-internal-secret` usando `INTERNAL_WORKFLOW_SECRET`

Comportamento esperado:
- se vier `x-internal-secret` válido, processa sem exigir `auth.getUser()`
- se não vier secret, continua aceitando JWT de usuário normalmente

## 2) Definir ator/sender correto para execuções internas
Hoje o executor usa `user.id` em vários pontos:
- `requested_by`
- `actor_id`
- `sender_user_id`
- `owner_user_id`

Para chamadas internas isso precisa ser resolvido explicitamente.

Ajuste planejado:
- identificar um `actingUserId` seguro para a run
- prioridade recomendada:
  1. dono da oportunidade (`opportunities.owner_user_id`)
  2. se não existir, `requested_by` persistido na run/trigger
  3. se ainda não existir, executar sem preencher campos opcionais de auditoria que dependem de usuário

Isso evita:
- falhas silenciosas ao inserir audit/approval
- envio associado ao usuário errado
- aprovações “sem dono”

## 3) Garantir criação da aprovação no modo `draft_for_review`
Como a regra atual do workflow está sem `mode` explícito no JSON salvo, o backend está aplicando o default:

```text
mode = draft_for_review
execution_mode = approval_pending
```

Depois do ajuste, esse caminho deve:
- deliberar
- gerar o e-mail
- criar `ai_agent_execution_actions`
- criar `ai_email_messages`
- criar `ai_agent_approval_queue`
- marcar a run como `awaiting_approval`

Resultado esperado na UI:
- aparecer em `/app/settings/noid-intelligence/approvals`
- badge de pendência no hub
- run visível no log do agente com status `awaiting_approval`

## 4) Hardening do auto-send para não quebrar depois
Há um segundo risco estrutural que vale corrigir no mesmo sprint curto:

### Risco atual
No caminho de envio automático, `execute-email-agent-run` chama `send-smtp-email`, que exige JWT de usuário real e SMTP do próprio usuário autenticado.

Isso é frágil para execuções automáticas internas porque:
- uma chamada interna não tem JWT humano válido
- mesmo quando houver aprovação humana, o envio pode sair do aprovador em vez do vendedor/dono correto

### Ajuste recomendado
Unificar o envio automático/aprovado para usar o remetente correto do contexto:
- preferir `sender_user_id` / dono da oportunidade
- quando for backend interno, usar `send-smtp-email-internal`
- reservar `send-smtp-email` para ações iniciadas diretamente pelo usuário no frontend

Isso não é o bloqueio do seu teste atual, mas impede o próximo bug assim que o agente sair de “approval only”.

## Arquivos a ajustar

1. `supabase/functions/execute-email-agent-run/index.ts`
- aceitar `x-internal-secret`
- separar autenticação interna vs autenticação por usuário
- criar `actingUserId`
- usar `actingUserId` em audit, approval queue, email message e activity
- no caminho de auto-send, usar estratégia compatível com execução interna

2. `supabase/functions/execute-workflow/index.ts`
- incluir `x-internal-secret` na chamada para `execute-email-agent-run`
- manter `run_id`, `execution_mode`, `executor_status` e erro no `actions_executed`

3. `supabase/functions/approve-email-agent-action/index.ts`
- opcionalmente alinhar o envio aprovado para usar o remetente original da mensagem/agente, não o aprovador, se isso ainda não estiver garantido

## Critério de aceite

Ao concluir novamente a atividade configurada no workflow:

1. o workflow continua movendo a oportunidade e criando a atividade
2. a run do agente é criada
3. o executor não retorna mais `Unauthorized`
4. a run sai de `queued`
5. como o modo atual é revisão humana, a run vira `awaiting_approval`
6. surge um item em `/app/settings/noid-intelligence/approvals`
7. o log do workflow mostra sucesso no `trigger_email_agent`
8. o log do agente passa a mostrar a run do dia

## Teste de ponta a ponta

Vou validar este cenário exato:

```text
Concluir atividade
  -> workflow_executions
  -> ai_agent_execution_runs
  -> execute-email-agent-run
  -> ai_agent_execution_actions
  -> ai_email_messages
  -> ai_agent_approval_queue
```

Verificações finais:
- run criada para a oportunidade
- approval queue preenchida
- hub mostra pendência
- tela de Aprovações deixa aprovar/rejeitar
- sem erro `Unauthorized`

## Resultado esperado para você

Depois da correção, “testar essa porra” vai significar de verdade:

- concluir a atividade
- o workflow aciona o Email Agent
- o agente gera o email
- a aprovação aparece na fila
- você consegue aprovar e enviar

Sem depender de cron, sem SQL manual e sem “run fantasma” parada em `queued`.
