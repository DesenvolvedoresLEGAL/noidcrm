
Objetivo: corrigir de forma definitiva o fluxo de aprovação para que qualquer proposta aceita dispare Slack + notificações + modal, independentemente da origem do aceite (página pública, CRM/manual, integração externa como BaseLinker).

1. Diagnóstico confirmado
- O fluxo principal de aprovação está quebrado no ponto central:
  - `supabase/functions/generate-acceptance-proof/index.ts` parou de enviar Slack/notificações e hoje apenas loga: “handled by post-acceptance-effects”.
  - Mas `src/pages/ProposalPublicView.tsx` só chama `post-acceptance-effects` dentro do fallback `directProposalApproval()`, ou seja: quando o fluxo principal dá certo, os efeitos não rodam.
- Existe um segundo buraco:
  - `src/components/opportunity/OpportunityProposalsTab.tsx` usa `updateProposal(id, { status: 'accepted' })`.
  - `src/services/supabase/proposals.ts -> updateProposal()` só atualiza a proposta; não dispara Slack, notificação nem modal.
- Existe um terceiro buraco:
  - `acceptProposal()` em `src/services/supabase/proposals.ts` chama ERP, mas não chama `post-acceptance-effects`.
- A idempotência atual de `post-acceptance-effects` também está errada:
  - se existir qualquer notificação do proposal, a função retorna “skip”.
  - isso impede retry parcial: se notificou mas falhou no Slack, nunca mais tenta Slack.

2. Correção definitiva
Vou centralizar os efeitos de aceite no backend, em vez de depender do frontend.

2.1. Criar um “outbox/queue” de efeitos de aceite
- Nova tabela para registrar um job por proposta aceita, com `proposal_id` único.
- Campos de controle por etapa:
  - `notifications_processed_at`
  - `slack_processed_at`
  - `erp_processed_at` (se quisermos unificar também)
  - `attempt_count`
  - `last_error`
  - `status` (`pending`, `processing`, `completed`, `failed`)
- Segurança:
  - RLS habilitado
  - sem acesso direto do client comum
  - processamento feito pelo backend

2.2. Criar trigger no banco para qualquer transição real para `accepted`
- Quando `proposals.status` mudar de qualquer valor para `accepted`, o trigger cria/upserta o job.
- Isso cobre:
  - aprovação na proposta pública
  - “Marcar como Aceita” no CRM
  - qualquer integração externa que atualize a proposta
  - qualquer fluxo futuro

2.3. Refatorar `post-acceptance-effects` para processar o job, não depender do frontend
- A função passa a:
  - carregar proposal/oportunity/account/profile/org
  - criar notificações para todos os membros ativos
  - enviar Slack
  - marcar cada etapa como concluída separadamente
- Remover o “skip global” baseado apenas na existência de notificação.
- Trocar por idempotência por etapa:
  - se notificações já foram criadas, não duplica
  - se Slack ainda não foi enviado, tenta novamente
- Assim retry deixa de ser bloqueado por falha parcial.

2.4. Acionar o processador em todos os pontos atuais
Mesmo com trigger, vou alinhar os entry points para processar rápido:
- `ProposalPublicView.tsx`: chamar o processador também no caminho de sucesso do `generate-acceptance-proof`, não só no fallback.
- `updateProposal()` em `src/services/supabase/proposals.ts`: se o status virar `accepted`, enfileirar/processar.
- `acceptProposal()` também deve enfileirar/processar.
Isso dá baixa latência no fluxo atual, mas a garantia real fica no backend.

3. Arquivos e partes impactadas
- `supabase/functions/post-acceptance-effects/index.ts`
  - refatoração da idempotência
  - processamento por etapa
  - logs melhores
- `src/pages/ProposalPublicView.tsx`
  - chamar efeitos também no caminho principal bem-sucedido
- `src/services/supabase/proposals.ts`
  - `updateProposal()`
  - `acceptProposal()`
- `src/components/opportunity/OpportunityProposalsTab.tsx`
  - passa a usar o fluxo corrigido via helper já centralizado
- Nova migration
  - tabela de jobs/outbox
  - trigger em `proposals`
  - índices e políticas
- Se necessário, um worker separado de processamento; se não, reaproveito `post-acceptance-effects` como processador oficial

4. Validação após implementação
- Testar 3 cenários:
  1. aprovação pela proposta pública
  2. “Marcar como Aceita” no CRM
  3. aceite vindo por integração/atualização externa
- Confirmar em cada um:
  - criação das notificações
  - modal em realtime
  - envio no Slack
  - ausência de duplicidade
  - retry funcionando quando uma etapa falhar
- Reprocessar o caso da BaseLinker com o novo worker para validar o fluxo real sem gerar duplicações indevidas.

5. Resultado esperado
- O sistema para de depender de um ponto específico do frontend.
- Qualquer proposta aceita passa a disparar os efeitos obrigatórios.
- Slack e modal deixam de “sumir” quando o aceite vem por um caminho alternativo.
- Falha parcial deixa de matar retries.

Seção técnica
```text
qualquer origem de aceite
        │
        ▼
proposals.status -> accepted
        │
        ▼
trigger cria/upserta job de efeitos
        │
        ▼
processador backend
   ├─ cria notifications
   ├─ envia Slack
   └─ marca etapas concluídas
        │
        ▼
realtime entrega modal para os usuários
```
