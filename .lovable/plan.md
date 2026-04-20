
## Plano: correção forense definitiva do fluxo de aprovação/envio do Email Agent + base reaproveitável para novos agentes

## Diagnóstico consolidado
O erro atual não é “mais um bug isolado”. Existe uma quebra estrutural no fluxo de aprovação:

1. O backend marca a fila como `approved` antes de confirmar o envio.
2. Depois tenta enviar o e-mail com payload incompatível com o sender interno.
3. O sender interno exige `user_id`, `to_emails`, `subject`, `html_body`, mas o aprovador está enviando outro formato.
4. Resultado:
   - o modal retorna erro;
   - o item some da fila porque já saiu de `pending`;
   - o histórico mostra “Aprovação concedida” porque a fila foi alterada;
   - a auditoria não registra aprovação porque esse insert só acontece depois do envio bem-sucedido;
   - o run fica em estado inconsistente (`approval_status=approved` + `execution_status=failed`).

Isso explica exatamente o comportamento descrito por você.

## O que vou corrigir de uma vez
### 1) Separar “aprovar” de “enviado com sucesso”
Reestruturar o fluxo do backend para refletir a realidade:

```text
pending
  -> approving
  -> approved_pending_send
  -> sent
ou
  -> send_failed
```

Semântica prática:
- “aprovado” não pode significar “e-mail enviado”.
- o histórico e a auditoria precisam refletir cada etapa separadamente.
- se o envio falhar, o item não pode desaparecer como se estivesse resolvido.

### 2) Padronizar o contrato de envio SMTP
Criar um contrato único para envio, usado por:
- `execute-email-agent-run`
- `approve-email-agent-action`
- futuros agentes com envio assistido/aprovado

O payload será unificado num helper compartilhado, para impedir divergência entre:
- sender interno
- sender autenticado por usuário
- aprovação manual
- execução automática

### 3) Corrigir a ordem transacional do backend
No aprovador:
- validar permissão
- carregar queue/run/email
- persistir edições humanas
- registrar auditoria de “approval_requested_to_send” / “execution_approved”
- tentar envio
- só então finalizar estados de sucesso
- se falhar, gravar `send_failed` sem fingir sucesso

A ideia é impedir qualquer “meio sucesso invisível”.

### 4) Tornar a fila resiliente a falhas
Quando o envio falhar após a aprovação:
- o item deve continuar visível em uma fila clara de pendência de envio, ou voltar para revisão com badge de erro;
- a UI deve mostrar o motivo real da falha;
- o usuário deve poder reenviar sem perder o conteúdo editado.

### 5) Corrigir histórico e auditoria para não mentirem
Hoje o histórico está lendo a aprovação como fato consumado. Vou separar eventos:
- `approval_pending`
- `approval_granted`
- `send_succeeded`
- `send_failed`
- `approval_rejected`

Assim:
- histórico da oportunidade não diz “Aprovação concedida” como se tudo tivesse dado certo;
- auditoria do agente sempre mostra a trilha completa;
- o run details passa a ser confiável para suporte e diagnóstico.

## Arquivos a ajustar
### Backend
- `supabase/functions/approve-email-agent-action/index.ts`
  - corrigir contrato de envio
  - reordenar fluxo
  - separar status de aprovação vs envio
  - garantir auditoria e feedback mesmo em falha
- `supabase/functions/send-smtp-email-internal/index.ts`
  - manter contrato oficial e validar mensagens de erro mais claras
- `supabase/functions/_shared/...`
  - extrair helper compartilhado de payload/dispatch do envio
- possivelmente `supabase/functions/execute-email-agent-run/index.ts`
  - alinhar o mesmo contrato para que automático e manual usem a mesma base

### Frontend
- `src/hooks/useAgentExecution.ts`
  - tratar respostas diferentes:
    - aprovado e enviado
    - aprovado mas falhou envio
    - aprovado aguardando retry
- `src/services/ai-agents/executionService.ts`
  - tipar retorno real do backend
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx`
  - exibir falha de envio de forma explícita
  - manter item visível/reprocessável
- `src/pages/settings/noid-intelligence/ApprovalsPage.tsx`
  - mesma lógica da card local
- componentes/timeline que consomem aprovação
  - ajustar labels para refletir o estado real
- tela de auditoria do agente
  - garantir visualização dos eventos corretos

## Ajustes de dados / modelo
Se necessário, farei pequena evolução no modelo para refletir o fluxo real:
- status intermediário de envio/aprovação na fila ou no run;
- motivo estruturado de falha;
- timestamps separados para:
  - aprovado em
  - envio iniciado em
  - enviado em
  - falhou em

Se der para resolver sem migration, melhor. Se a base atual estiver curta para observabilidade, incluo migration enxuta e segura.

## Blindagem para novos agentes
Para isso não virar sofrimento toda vez que subir agente novo, vou estruturar uma base reaproveitável:

### A. Contrato único de execução assistida
Criar um padrão para agentes que geram ação com aprovação humana:
- gerar draft
- enfileirar aprovação
- editar
- aprovar
- executar
- auditar
- medir resultado

### B. Shared helpers
Extrair helpers compartilhados para:
- resolução de ator (`auth.user.id` -> `profiles.id`)
- verificação de permissão
- transição segura de status
- envio de ação executável
- escrita de auditoria
- escrita de feedback
- escrita de impacto

### C. Template operacional para novos agentes
Os próximos agentes vão seguir o mesmo backbone:
- `run`
- `action`
- `approval_queue`
- `audit`
- `impact`
- `feedback`

Assim o problema deixa de ser “cada agente inventa um fluxo” e vira “todo agente segue a mesma fundação”.

### D. Memória do projeto
Vou consolidar isso na memória do projeto como regra arquitetural:
- agentes com aprovação humana nunca podem marcar sucesso antes da execução real;
- aprovação e entrega são eventos distintos;
- toda action executável precisa usar helper compartilhado de dispatch/audit/status.

Isso reduz retrabalho futuro e evita regressão quando novos agentes forem criados.

## QA e validação que vou aplicar
### Cenários obrigatórios
1. Aprovar sem editar:
   - sai da fila apenas se enviar de verdade
   - auditoria registra aprovação
   - histórico registra envio concluído

2. Editar e salvar/enviar:
   - preserva HTML editado
   - envia com sucesso
   - marca `was_human_edited`
   - auditoria registra edição + aprovação + envio

3. Aprovar com falha SMTP:
   - não some como resolvido
   - histórico não mente
   - auditoria mostra aprovação + falha de envio
   - usuário consegue tentar novamente

4. Rejeitar:
   - some da fila corretamente
   - histórico mostra rejeição
   - auditoria registra rejeição

5. Workflow automático gerando aprovação:
   - continua chegando na fila normalmente
   - usa o mesmo backbone do fluxo manual

### Verificações técnicas
- logs das funções
- estados em `ai_agent_approval_queue`
- estados em `ai_agent_execution_runs`
- estados em `ai_email_messages`
- registros em `ai_agent_audit`
- reflexo no histórico da oportunidade

## Resultado esperado
Depois dessa correção, o comportamento passa a ser previsível:

- clicou em “Salvar e enviar”:
  - ou envia e fecha corretamente;
  - ou falha com motivo claro, sem maquiar sucesso.
- histórico, fila, auditoria e status do run ficam coerentes entre si.
- novos agentes não precisarão ser montados “na raça”, porque a fundação de aprovação/execução ficará padronizada e reaproveitável.

## Entrega desta correção
Vou tratar isso como correção estrutural, não como remendo pontual:
1. corrigir contrato quebrado do envio;
2. reescrever transição de estados;
3. alinhar UI com estados reais;
4. padronizar helper compartilhado para agentes futuros;
5. validar ponta a ponta no fluxo de aprovação, falha e reenvio.
