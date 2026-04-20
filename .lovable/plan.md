

## Levar aprovações de e-mail para dentro da oportunidade

Hoje, qualquer e-mail gerado pelo Email Agent só pode ser aprovado em `/app/settings/noid-intelligence/approvals`, que é uma área administrativa. O vendedor não tem acesso e o admin não escala. Vamos trazer essa fila para o contexto natural do trabalho do vendedor: dentro da própria oportunidade, na aba **E-mails** e na **Timeline**.

## O que vai mudar

### 1) Aba "E-mails" da oportunidade ganha uma seção "Aguardando aprovação"
No topo da `OpportunityEmailsTab`, antes da lista de e-mails enviados/recebidos, aparece:

- Card amarelo destacado quando houver pendências do agente para esta oportunidade
- Cada item mostra: nome do agente, destinatário, assunto, cenário, confiança, raciocínio e preview do corpo
- Botões de ação inline (sem precisar sair da oportunidade):
  - **Aprovar e enviar**
  - **Editar e aprovar** (abre modal com assunto/corpo editáveis)
  - **Rejeitar** (com motivo opcional)
  - **Ver detalhes da run** (link para o hub)
- Se não houver pendências, a seção some (não polui a UI)

### 2) Permissão para aprovar
Hoje só admin acessa o hub. Vamos liberar a aprovação dentro da oportunidade para:

- **Dono da oportunidade** (`owner_user_id`)
- **Participantes do deal** (deal participants)
- **Admin / manager** (mantém override)

Backend: `approve-email-agent-action` e `reject-email-agent-action` passam a aceitar essa regra ampliada (hoje aceitam qualquer usuário autenticado da org — vamos endurecer + permitir o dono).

### 3) Timeline da oportunidade registra a aprovação pendente
Adicionar um novo `type: 'agent_approval'` no `unified_timeline` (view) cobrindo `ai_agent_approval_queue`:

- **Pendente**: "Email Agent gerou um rascunho aguardando sua aprovação" + botão "Revisar" que abre o card inline na aba E-mails (via deep link `?tab=emails&approval=<id>`)
- **Aprovado**: "Aprovado por <user> · enviado para <recipient>"
- **Rejeitado**: "Rejeitado por <user> · motivo: <reason>"

Assim o vendedor vê na timeline o ciclo completo, mesmo sem abrir a aba de e-mails.

### 4) Notificação para o dono do deal
Quando a fila recebe um item novo cujo run pertence a uma oportunidade, criar uma notificação PRIME `in_app` para o `owner_user_id`:

- Título: "Email Agent precisa da sua aprovação"
- Subtítulo: "<Oportunidade> · <Assunto>"
- Deep link: `/app/opportunities/<id>?tab=emails&approval=<queue_id>`
- Aparece no Unified Inbox (Sparkles na sidebar) — respeita a regra de canal único de notificações

### 5) Realtime
A aba E-mails já fará subscribe em `ai_agent_approval_queue` filtrando pela oportunidade — o card pendente aparece/some sem refresh.

## Critério de aceite

1. Concluir atividade no FUP-3 → FUP-4 dispara o agente (já corrigido)
2. Em poucos segundos, o card "Aguardando aprovação" aparece na aba **E-mails** da oportunidade
3. Aparece também um evento na **Timeline** com botão "Revisar"
4. Aparece notificação no **Unified Inbox** para o dono do deal
5. O vendedor (dono ou participante) consegue Aprovar / Editar+Aprovar / Rejeitar **sem precisar entrar em NOID Intelligence**
6. Após aprovar: o e-mail é enviado, vira um item normal na lista de e-mails enviados, e a timeline mostra "Aprovado e enviado"
7. A página `/app/settings/noid-intelligence/approvals` continua existindo como visão consolidada para admins, mas deixa de ser obrigatória para operação diária

## Detalhes técnicos

- **Frontend**:
  - Novo componente `OpportunityPendingApprovalsCard.tsx` consumido pela `OpportunityEmailsTab`
  - Novo hook `useOpportunityApprovals(opportunityId)` que filtra `ai_agent_approval_queue` por `run.context_snapshot_json->>'opportunity_id'` (a coluna direta não existe, então usaremos um join via `ai_agent_execution_runs` e filtraremos no front, ou criaremos índice/view)
  - Reaproveita `useApproveAction` / `useRejectAction` existentes
  - Subscription realtime em `ai_agent_approval_queue` por organization_id
  - Deep link `?tab=emails&approval=<id>` abre a aba e expande o card
- **Backend**:
  - Migração: adicionar coluna `opportunity_id uuid` em `ai_agent_execution_runs` + backfill a partir de `context_snapshot_json->>'opportunity_id'` + popular daqui em diante no `execute-workflow` e `execute-email-agent-run`. Isso evita query lenta no front.
  - Migração: estender a view `unified_timeline` para incluir eventos de `ai_agent_approval_queue` (pendente / aprovado / rejeitado) ligados a `opportunity_id`
  - Edge function `approve-email-agent-action`: validar permissão (owner do deal OR participante OR admin/manager)
  - Trigger `AFTER INSERT ON ai_agent_approval_queue`: criar notificação PRIME para o owner do deal, com deep link
- **RLS**:
  - `ai_agent_approval_queue` SELECT: já é por org; manter
  - `ai_email_messages`: garantir que owner/participant da oportunidade enxergue o draft

## Arquivos a tocar

- `src/components/opportunity/OpportunityEmailsTab.tsx` — incluir card de pendências no topo
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx` — novo
- `src/hooks/useOpportunityApprovals.ts` — novo
- `src/components/opportunity/UnifiedTimeline.tsx` + `src/services/crm/timeline.ts` — renderizar novo tipo `agent_approval` com botão "Revisar"
- `src/pages/OpportunityDetail.tsx` — ler `?tab=emails&approval=<id>` e abrir a aba
- `supabase/functions/approve-email-agent-action/index.ts` — permissão ampliada
- `supabase/functions/reject-email-agent-action/index.ts` — permissão ampliada
- `supabase/functions/execute-email-agent-run/index.ts` — popular `opportunity_id` ao criar a run
- Migrações:
  - `ALTER TABLE ai_agent_execution_runs ADD COLUMN opportunity_id uuid` + backfill + index
  - `CREATE OR REPLACE VIEW unified_timeline` adicionando aprovações
  - Trigger de notificação para o dono do deal

## Tempo estimado

~60–80 min para implementação + teste end-to-end no FUP-3 → FUP-4.

