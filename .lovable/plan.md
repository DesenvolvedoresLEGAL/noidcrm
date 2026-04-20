
Corrigir o disparo real do Email Agent no workflow exige atacar 2 problemas separados que hoje impedem o fluxo completo.

## Diagnóstico confirmado

O workflow está disparando parcialmente:
- move a oportunidade de etapa
- cancela/cria atividade
- tenta acionar `trigger_email_agent`

Mas o acionamento do agente falha no backend com este erro:

```text
new row for relation "ai_agent_execution_runs" violates check constraint "ai_agent_execution_runs_mode_check"
```

Causa exata:
- em `supabase/functions/execute-workflow/index.ts`, a ação `trigger_email_agent` grava:
  - `execution_mode = "draft"` quando o modo do workflow é `draft_for_review`
- porém a tabela `ai_agent_execution_runs` só aceita:
  - `controlled_live`
  - `approval_pending`
  - `blocked`

Resultado:
- nenhuma run é criada
- nenhuma aprovação entra em fila
- nenhum log aparece no agente
- nenhum e-mail é preparado

Além disso, mesmo após corrigir esse insert, existe um segundo gap:
- o workflow apenas cria a run com status `queued`
- não há um executor automático dessa run no caminho do workflow
- hoje `execute-email-agent-run` existe, mas é chamado manualmente pela UI de runs, não automaticamente após o workflow

## O que será implementado

### 1) Corrigir o modo salvo pela ação `trigger_email_agent`
Ajustar `supabase/functions/execute-workflow/index.ts` para mapear corretamente:

- `auto_send` -> `controlled_live`
- `draft_for_review` -> `approval_pending`

Isso elimina o erro de constraint e permite criar a run.

### 2) Executar a run automaticamente após o workflow criar a run
Depois de inserir em `ai_agent_execution_runs`, o workflow deve disparar o executor real do agente.

Implementação:
- após criar `runRow.id`, chamar `execute-email-agent-run`
- usar chamada interna autenticada do próprio backend
- se a execução falhar, registrar no `actions_executed` da `workflow_execution`

Fluxo final esperado:

```text
Atividade concluída
  -> workflow_executions criado
  -> execute-workflow roda
  -> trigger_email_agent cria ai_agent_execution_run
  -> execute-email-agent-run processa a run
      -> se precisar aprovação: cria ai_agent_approval_queue
      -> se auto-send permitido: envia direto
```

### 3) Melhorar observabilidade do disparo
Registrar com clareza no resultado do workflow:
- `run_id`
- `execution_mode`
- status final do executor (`awaiting_approval`, `executed`, `blocked`, `failed`, `skipped`)
- motivo quando bloquear por policy/cooldown

Assim o histórico deixa de parecer “não funcionou”.

### 4) Garantir que o usuário enxergue onde aprovar
Hoje já existe a página:
- `/app/settings/noid-intelligence/approvals`

Mas não existe modal automático abrindo na oportunidade quando o backend cria uma aprovação.

Vou manter o comportamento atual funcional e explícito:
- o disparo entra na fila de aprovações
- aparece no hub de NOID Intelligence
- aparece na página de Aprovações
- aparece nos runs do agente

Se você quiser, depois disso eu posso fazer uma melhoria extra:
- realtime na oportunidade para abrir aviso/modal quando uma aprovação nova for criada

## Arquivos a ajustar

1. `supabase/functions/execute-workflow/index.ts`
- corrigir `execution_mode`
- chamar `execute-email-agent-run` logo após criar a run
- enriquecer `result` com status real do executor

2. `src/pages/settings/noid-intelligence/AgentDetail.tsx` ou telas relacionadas de runs
- opcionalmente adicionar atalho mais visível para runs/aprovações recentes do agente

3. Opcional: `src/pages/OpportunityDetail.tsx`
- melhoria futura para mostrar aviso quando surgir uma aprovação pendente ligada à oportunidade

## Critério de aceite

Ao concluir uma atividade da etapa configurada no workflow:
1. a oportunidade muda de etapa
2. a nova atividade é criada
3. uma `ai_agent_execution_run` é criada sem erro
4. o executor do agente roda automaticamente
5. acontece um dos 2 comportamentos:
   - entra em `awaiting_approval` e aparece em Aprovações
   - ou envia direto e aparece nos logs/outcomes/timeline
6. o histórico do workflow mostra `run_id` e resultado do agente

## Teste de ponta a ponta

Vou validar este cenário específico:
- regra `VENDAS: Avançar + Orquestrar - FUP-3 → FUP-4`
- concluir a atividade
- conferir:
  - `workflow_executions`
  - `ai_agent_execution_runs`
  - `ai_agent_approval_queue`
  - logs de `execute-workflow`
  - logs de `execute-email-agent-run`

## Resultado esperado para o seu teste
Depois da correção, “ativar de fato” vai significar:
- o workflow não só cria a atividade e move a etapa
- ele realmente dispara o Email Agent
- se o agente estiver em modo assistido/política de aprovação, você verá a aprovação pendente
- se estiver liberado para envio automático, ele envia e registra tudo

## Tempo
~35–50 min para corrigir, validar o fluxo real e deixar pronto para você testar novamente.
