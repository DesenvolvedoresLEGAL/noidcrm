
# Plano: corrigir definitivamente o “Email Agent disparou, mas não aparece na oportunidade”

## Diagnóstico confirmado

O agente não “parou de funcionar”. O disparo aconteceu no backend.

Para a oportunidade `040e16c4-736b-4335-a609-e3a95f470848`, já existe:
- item pendente na fila de aprovação
- run em `awaiting_approval`
- mensagem de e-mail vinculada à mesma oportunidade

Ou seja: o problema real está na camada de exibição/sincronização da oportunidade, não no gatilho principal do agente.

## Causa provável

Hoje a tela da oportunidade depende de uma montagem frágil em cliente:
- `useOpportunityApprovals.ts` reconstrói aprovações com 3 consultas separadas
- `OpportunityEmailsTab.tsx` esconde erro e trata `[]` como “nenhum e-mail”
- `OpportunityHistoryTab.tsx` ainda usa carga imperativa/local, sem reatividade consistente
- `execute-workflow/index.ts` ainda cria runs confiando em preenchimento indireto de `opportunity_id`, quando pode gravar isso explicitamente

Resultado:
- a aprovação aparece em `/configurações > aprovações`
- mas pode não aparecer imediatamente na oportunidade
- e a timeline/histórico pode continuar stale até reload manual

## O que vou implementar

### 1) Criar uma fonte única e robusta para “aprovações pendentes da oportunidade”
Substituir a reconstrução frágil do hook por uma fonte backend única, filtrada diretamente pela oportunidade.

Implementação:
- criar uma view ou RPC dedicada para aprovações por oportunidade
- retornar, em uma única leitura:
  - queue id
  - run id
  - status
  - requested_at
  - agent name
  - subject
  - recipient
  - body preview
  - send failure metadata
  - scenario_label
  - opportunity_id resolvido de forma determinística

Objetivo:
- a página de Aprovações e a oportunidade passam a ler a mesma verdade
- elimina divergência entre `ai_agent_execution_runs`, `ai_agent_approval_queue` e `ai_email_messages`

### 2) Tornar `useOpportunityApprovals` resiliente
Refatorar o hook para usar essa fonte única backend, em vez de “descobrir” os dados no browser.

Também vou:
- expor `isLoading` e `error`
- parar de mascarar erro como lista vazia
- manter invalidação com `aiAgentKeys.opportunityApprovals(...)`

### 3) Corrigir a UX da aba de E-mails
Em `OpportunityEmailsTab.tsx`:
- separar claramente:
  - carregando aprovações
  - erro ao carregar aprovações
  - nenhuma aprovação pendente
- garantir que o card de aprovação pendente apareça acima do histórico mesmo quando não houver e-mails manuais
- impedir falso estado “Nenhum e-mail encontrado” quando há aprovação pendente do agente

### 4) Tornar Histórico e E-mails reativos sem hard refresh
Padronizar essas superfícies para reagirem ao evento novo no mesmo instante.

Implementação:
- migrar o histórico/timeline da oportunidade para invalidação consistente com `crmTimelineKeys`
- adicionar/ajustar realtime/invalidation para:
  - `ai_agent_approval_queue`
  - `ai_agent_execution_runs`
  - `ai_email_messages`
- garantir atualização imediata quando:
  - uma atividade concluída dispara o agente
  - a aprovação é criada
  - o envio falha e vira `send_failed`
  - a aprovação é aceita/rejeitada

### 5) Remover dependência implícita no preenchimento de `opportunity_id`
Em `supabase/functions/execute-workflow/index.ts`:
- gravar `opportunity_id: oppId` explicitamente ao inserir `ai_agent_execution_runs`

Isso fecha uma classe inteira de bugs intermitentes em que a oportunidade depende de backfill/trigger/view para encontrar o run certo.

### 6) Revisar a timeline para refletir pendência de aprovação imediatamente
Garantir que a timeline da oportunidade mostre o evento “rascunho aguardando aprovação” assim que ele nasce, sem depender de refresh.

Se necessário:
- ajustar a view `unified_timeline`
- revisar o serviço `enhanced-timeline`
- garantir que eventos `agent_approval` pendentes sejam sempre resolvidos para a oportunidade correta

## Arquivos principais a mexer

### Frontend
- `src/hooks/useOpportunityApprovals.ts`
- `src/components/opportunity/OpportunityEmailsTab.tsx`
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx`
- `src/components/opportunity/OpportunityHistoryTab.tsx`
- `src/services/crm/enhanced-timeline.ts`
- `src/lib/query-keys.ts` (se precisar ampliar factories)

### Backend
- `supabase/functions/execute-workflow/index.ts`
- nova migration para view/RPC de aprovações por oportunidade
- possível ajuste na view `unified_timeline`

## Validação

1. Concluir atividade na oportunidade citada.
2. Verificar que:
   - a run vai para `awaiting_approval`
   - a fila global mostra pendente
   - a aba **E-mails** mostra imediatamente o card de aprovação
   - a aba **Histórico** mostra o evento do agente sem refresh
3. Aprovar o e-mail:
   - item some da pendência da oportunidade
   - timeline atualiza
   - envio aparece no histórico correto
4. Simular falha de envio:
   - item vira `send_failed`
   - continua visível na oportunidade com ação de reenviar
5. Repetir o fluxo com gatilho por workflow para garantir que o problema não volta.

## Resultado esperado

Depois dessa correção:
- se o Email Agent gerar aprovação, ela sempre aparecerá na própria oportunidade
- histórico e aba de e-mails vão refletir a pendência em tempo real
- não haverá mais discrepância entre “está em Aprovações” e “sumiu da oportunidade”
