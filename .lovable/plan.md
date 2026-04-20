

## Diagnóstico definitivo

A página `/app/settings/noid-intelligence/approvals` mostra "Nenhuma ação pendente" mesmo com 2 itens reais na fila (`5b122858…` e `a9cef37c…`), enquanto o badge do hub mostra "1 pendente".

**Causa raiz confirmada via inspeção do schema:**
- `executionService.getApprovalQueue()` faz um embed PostgREST: `select('*, ai_email_messages(...), ai_agent_execution_runs(...), ai_agents(...)')`
- **Não existe foreign key** entre `ai_agent_approval_queue` e `ai_email_messages`. Elas só se relacionam indiretamente via `run_id`.
- Sem FK, o PostgREST falha o embed e retorna array vazio (silenciosamente, sem quebrar o app).
- O `useApprovalQueueCount` funciona porque é apenas `count + head:true`, sem embed → por isso o badge mostra contagem (apesar de mostrar "1" em vez de "2", o que é um bug de cache/refetch separado).

Confirmado no banco:
- 2 itens `pending` na fila
- 2 emails correspondentes via `run_id` com `subject` e `body`
- Usuário `bruno@operadora.legal` tem role `admin` + `org_role=operations` na org `d1b68a0f…` → RLS permite leitura
- FKs existentes: `ai_agent_approval_queue → ai_agents`, `→ ai_agent_execution_runs`, `→ profiles`, `→ organizations`, `→ ai_agent_versions`, `→ ai_agent_execution_actions`. **Nenhuma para `ai_email_messages`.**

## O que será implementado

### 1) Reescrever `executionService.getApprovalQueue()` para não depender de FK inexistente
Trocar a query única com embed problemático por composição de 2 queries simples:
- buscar fila `ai_agent_approval_queue` com embed apenas para `ai_agents` e `ai_agent_execution_runs` (FKs existem)
- buscar `ai_email_messages` em separado por `run_id` (in-list)
- mesclar por `run_id` no cliente

Esse é exatamente o padrão que `useOpportunityApprovals` já usa e que funciona.

### 2) Garantir que `ApprovalsPage` continue lendo `item.ai_email_messages` sem mudança
O resultado do service vai expor o email no mesmo campo (`ai_email_messages: {...}`) para preservar o consumo atual da página, sem mexer no JSX.

### 3) Sincronizar contador do hub
Ajustar `useApprovalQueueCount` para invalidar quando aprovar/rejeitar (já existe realtime, mas vou garantir invalidação cruzada com as mutations) — assim a divergência "1 vs 2" some.

### 4) Validar com a query corrigida
Após o fix, abrir `/app/settings/noid-intelligence/approvals` deve mostrar:
- card amarelo para `Renase: acompanhando nossa conversa inicial` (oportunidade `da49abfa…`)
- card amarelo para `Dúvidas sobre nossa proposta, Edgar?` (oportunidade `ae53f70b…`)
- ambos com botões Aprovar / Editar / Rejeitar funcionais

## Arquivo a tocar

- `src/services/ai-agents/executionService.ts` — método `getApprovalQueue` reescrito sem o embed quebrado
- `src/hooks/useAgentExecution.ts` — invalidar `approval-queue-count` nas mutations approve/reject (alinhar contador do hub)

## Critério de aceite

1. `/app/settings/noid-intelligence/approvals` lista os 2 itens pendentes hoje
2. Badge do hub mostra "2 pendentes"
3. Aprovar/Rejeitar pela tela funciona e o item some imediatamente
4. Critério herdado: o card já criado dentro da oportunidade (aba E-mails) continua funcionando — o `useOpportunityApprovals` não muda

## Tempo

~10 min — é uma mudança cirúrgica num único arquivo de serviço.

