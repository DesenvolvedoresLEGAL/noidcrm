
## Diagnóstico confirmado

O agente está disparando no backend, mas a UI da oportunidade continua vazia por uma combinação de gaps:

1. **O draft existe no backend**
   - Para a oportunidade `da49abfa-85ae-4829-ba32-e01739cfc5f3` já existe:
     - `ai_agent_execution_runs.id = 47854b8d-c639-406e-85e6-db5fc98dc1f0`
     - `execution_status = awaiting_approval`
     - `ai_email_messages.id = f01c99a1-e9cd-483b-bbc4-094a4dbaf9c9`
     - `ai_agent_approval_queue.id = 5b122858-bfde-4a36-a465-bb95ee12bd14`
   - Ou seja: **o Email Agent funcionou**. O problema agora é **exibição/ligação da UI**, não mais disparo.

2. **A aba E-mails filtra do jeito errado**
   - `useOpportunityApprovals()` busca runs por:
     - `.from('ai_agent_execution_runs').eq('opportunity_id', opportunityId)`
   - Mas a run nova `47854...` está com `opportunity_id = NULL`, embora o `context_snapshot_json` e o `ai_email_messages.opportunity_id` tenham o ID correto da oportunidade.
   - Resultado: o card “Aguardando aprovação” nunca encontra essa run.

3. **O Histórico que o usuário usa não é o componente que foi adaptado**
   - A oportunidade renderiza `OpportunityHistoryTab`, que usa `getEnhancedTimeline()`.
   - O ajuste feito foi em `UnifiedTimeline.tsx`, mas **essa não é a timeline exibida no detalhe da oportunidade**.
   - Resultado: mesmo com a `view unified_timeline` já contendo `agent_approval`, o vendedor **não vê nada no histórico real da oportunidade**.

4. **Há erro de build pendente**
   - O projeto está com typecheck quebrando em:
     - `src/components/diagnostic/DiagnosticModal.tsx`
     - `src/lib/reports/canonicalFilters.ts`
   - Enquanto isso não for corrigido, mudanças de frontend podem não refletir corretamente no app.

5. **Existe inconsistência entre runs antigas e novas**
   - A oportunidade `ae53f70b-...` tem run `awaiting_approval` e email `pending_approval`, mas sem item correspondente em `ai_agent_approval_queue`.
   - Isso indica que além do fix principal, vale fazer um reparo para pendências órfãs já geradas.

## O que será implementado

### 1) Corrigir o bloqueio de build primeiro
Ajustar os dois erros de typecheck para garantir deploy real da UI:
- substituir/remover o import problemático de `@radix-ui/react-visually-hidden`
- remover ou tipar localmente o uso de `@supabase/postgrest-js` em `canonicalFilters.ts`

Sem isso, qualquer correção visual pode continuar “não aparecendo”.

### 2) Tornar a busca de aprovações resiliente
Ajustar `useOpportunityApprovals()` para não depender só de `ai_agent_execution_runs.opportunity_id`.

Novo critério:
- buscar aprovações pela run **ou** pelo `ai_email_messages.opportunity_id`
- fallback adicional por `entity_type='opportunity' AND entity_id=opportunityId`

Com isso, mesmo se a coluna denormalizada vier nula, a aprovação aparece na oportunidade.

### 3) Garantir que `opportunity_id` seja persistido corretamente nas runs
Endurecer `execute-email-agent-run` para que toda atualização posterior da run preserve/grave `opportunity_id` com segurança.

Também fazer um reparo de consistência:
- backfill para runs recentes onde:
  - `entity_type='opportunity'`
  - `entity_id` está preenchido
  - `opportunity_id` está nulo

Assim o filtro rápido volta a funcionar de forma confiável.

### 4) Levar `agent_approval` para o histórico real da oportunidade
Integrar o novo tipo no fluxo usado por `OpportunityHistoryTab`:
- ampliar `EnhancedTimelineEvent` para aceitar `agent_approval`
- adaptar `getEnhancedTimeline()` para enriquecer esse tipo
- ajustar `TimelineEventCard` para renderizar:
  - pendente: “Email Agent gerou um rascunho aguardando aprovação”
  - aprovado
  - rejeitado
- incluir botão/link “Revisar” com deep link:
  - `/app/opportunities/:id?tab=emails&approval=:queueId`

### 5) Garantir atualização instantânea da aba E-mails
Melhorar `OpportunityEmailsTab` / `useOpportunityApprovals()` para:
- invalidar corretamente após approve/reject
- reagir a mudanças em `ai_email_messages` e `ai_agent_execution_runs` além da fila
- evitar depender de refresh manual

### 6) Reparar pendências órfãs já criadas
Criar um pequeno reparo para runs recentes em `awaiting_approval` com:
- `ai_email_messages.send_status = 'pending_approval'`
- sem linha em `ai_agent_approval_queue`

Objetivo:
- reconstituir a fila de aprovação dessas execuções para não perder testes já feitos.

## Arquivos a ajustar

### Frontend
- `src/hooks/useOpportunityApprovals.ts`
- `src/components/opportunity/OpportunityEmailsTab.tsx`
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx`
- `src/components/opportunity/OpportunityHistoryTab.tsx`
- `src/services/crm/enhanced-timeline.ts`
- `src/components/opportunity/TimelineEventCard.tsx` (ou componente equivalente que renderiza cada evento)
- `src/components/diagnostic/DiagnosticModal.tsx`
- `src/lib/reports/canonicalFilters.ts`

### Backend / banco
- `supabase/functions/execute-email-agent-run/index.ts`
- nova migração para backfill/reparo de `ai_agent_execution_runs.opportunity_id`
- nova migração opcional para reconstruir itens faltantes em `ai_agent_approval_queue`

## Critério de aceite

Para a oportunidade `da49abfa-85ae-4829-ba32-e01739cfc5f3`:
1. a aprovação já existente passa a aparecer no topo da aba **E-mails**
2. o link com `?tab=emails&approval=...` abre e destaca o card correto
3. o **Histórico** mostra o evento de aprovação pendente com CTA “Revisar”
4. aprovar/rejeitar pela oportunidade atualiza UI sem precisar ir ao hub administrativo
5. ao aprovar, o item sai da fila e o e-mail segue o fluxo normal
6. runs órfãs recentes deixam de ficar invisíveis

## Validação final

### Cenário 1 — caso já quebrado
- abrir `/app/opportunities/da49abfa-85ae-4829-ba32-e01739cfc5f3`
- confirmar que o draft pendente aparece na aba **E-mails**
- confirmar que o **Histórico** exibe o evento de aprovação

### Cenário 2 — novo disparo real
- concluir outra atividade com workflow de Email Agent
- validar:
  - run criada
  - fila criada
  - card aparece na oportunidade
  - histórico registra
  - aprovação funciona inline

## Resultado esperado
Depois dessas correções, o vendedor não precisará entrar em NOID Intelligence para aprovar draft operacional do agente. O fluxo volta para o contexto natural da oportunidade, que era exatamente o objetivo.
