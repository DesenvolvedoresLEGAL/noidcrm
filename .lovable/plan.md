

## Refinamento do Email Agent: contexto completo + feedback loop

O agente está funcionando mecanicamente, mas toma decisões ruins porque recebe contexto incompleto e não aprende com rejeições. Vou atacar os 5 gaps identificados.

---

### Problemas confirmados

1. **"Não houve envio de email pelo sistema" — FALSO**: O agente só consulta `ai_email_messages` (emails do próprio agente). Emails manuais enviados pelo vendedor ficam em `opportunity_emails` e são completamente invisíveis para a deliberação. Resultado: raciocínio errado.

2. **"15 minutos na quinta-feira" em todos os emails**: O contexto enviado ao modelo NÃO inclui a data atual (`today`), nem `close_date_prevista`, nem `expires_at` da proposta, nem `next_followup_date`. O modelo inventa uma data genérica porque não tem referência temporal real.

3. **Proposta com validade curta ignorada**: O campo `expires_at` das proposals é buscado do banco mas NÃO é passado no `contextSummary` — só `status`, `total_value` e `viewed_at` são incluídos. O agente não sabe quando a proposta expira.

4. **Sem feedback loop**: Quando o vendedor rejeita, o `rejection_reason` é salvo em `ai_agent_approval_queue` e `ai_agent_audit`, mas **nunca é reutilizado**. Na próxima deliberação, o agente repete o mesmo erro. Não existe tabela de feedback nem injeção de rejeições anteriores no prompt.

5. **Sem agendamento futuro**: O agente gera emails para envio imediato. Não existe conceito de "programar para amanhã" ou "enviar em 2 dias".

---

### O que será implementado

#### 1) Enriquecer o contexto da deliberação

Adicionar ao `contextSummary` passado para a IA (em `execute-email-agent-run`):

- **`today`**: data/hora atual em BRT para referência temporal
- **`opportunity.close_date_prevista`**: previsão de fechamento
- **`opportunity.next_followup_date`**: próximo follow-up agendado
- **`opportunity.last_contact_date`**: último contato registrado
- **`proposals[].expires_at`**: validade da proposta
- **`proposals[].sent_at`**: quando foi enviada
- **`manual_emails`**: últimos 5 emails manuais de `opportunity_emails` (subject, direction, sent_at) — para que o agente saiba que já houve envio de proposta, respostas do cliente etc.
- **`recent_activities[].scheduled_date`** e **`recent_activities[].title`** completos (hoje só vai o count)

#### 2) Melhorar os prompts de deliberação e geração

Ajustar os prompts default (fallback) para instruir o agente a:

- **Verificar se já houve emails manuais** antes de afirmar "não houve envio"
- **Usar a data atual** para sugerir datas reais (não "quinta-feira" genérica)
- **Considerar `expires_at`** da proposta para urgência
- **Considerar `close_date_prevista`** para timing do follow-up
- **Nunca sugerir data de reunião sem verificar** se é dia útil e se há margem antes do deadline
- **Variar o CTA** entre emails — não repetir "15 minutos na quinta" para todos

#### 3) Criar feedback loop com rejeições anteriores

**Nova tabela `ai_agent_feedback`:**
- `id`, `organization_id`, `agent_id`, `run_id`, `queue_id`
- `feedback_type` (rejection, edit, positive)
- `feedback_text` (motivo da rejeição ou notas)
- `original_output_json` (o email gerado)
- `edited_output_json` (se houve edição antes de aprovar)
- `context_snapshot_json` (snapshot do contexto para entender o cenário)
- `created_by`, `created_at`

**Persistir feedback automaticamente:**
- Na rejeição: gravar com `feedback_type = 'rejection'`
- Na edição+aprovação: gravar com `feedback_type = 'edit'`, incluindo diff original vs editado
- Na aprovação sem edição: gravar com `feedback_type = 'positive'`

**Injetar no prompt de deliberação:**
- Antes de deliberar, buscar os últimos 5-10 feedbacks do mesmo agente+organização
- Incluir como seção "Feedback de rejeições anteriores" no contexto
- Exemplo: "Email rejeitado em 20/04: motivo 'Sugeriu data incorreta, proposta vence antes'. Contexto: proposta com expires_at 23/04"

#### 4) Suporte a agendamento de envio

Adicionar campo `scheduled_send_at` na resposta do modelo e na tabela `ai_email_messages`:

- O modelo pode decidir: "enviar agora" ou "agendar para 2026-04-22 09:00 BRT"
- Se agendado, o email fica em `pending_approval` com `scheduled_send_at` preenchido
- Na UI de aprovação, mostrar "Agendado para: 22/04 às 09:00"
- O vendedor pode alterar a data ao editar
- O envio real acontece no `process-email-queue` ou via cron que verifica emails agendados

#### 5) Usar modelo mais forte para deliberação

Trocar `google/gemini-2.5-flash` por `google/gemini-2.5-pro` na fase de deliberação — é onde o raciocínio importa mais. Manter flash para geração do email (mais rápido, contexto já digerido).

---

### Arquivos a ajustar

**Backend:**
- `supabase/functions/execute-email-agent-run/index.ts` — enriquecer contexto, melhorar prompts, injetar feedback, modelo pro na deliberação
- `supabase/functions/approve-email-agent-action/index.ts` — gravar feedback positivo/edição
- `supabase/functions/reject-email-agent-action/index.ts` — gravar feedback de rejeição
- `supabase/functions/_shared/agent-policy-engine.ts` — incluir `opportunity_emails` no `buildRecentInteractions`

**Migração:**
- Criar tabela `ai_agent_feedback` com RLS por organização
- Adicionar coluna `scheduled_send_at timestamptz` em `ai_email_messages`

**Frontend:**
- `src/components/opportunity/OpportunityPendingApprovalsCard.tsx` — mostrar data agendada, campo de motivo na rejeição (obrigatório), campo de edição de data

---

### Critério de aceite

1. O raciocínio do agente menciona "já foi enviado email de proposta em DD/MM" quando aplicável
2. Cada email sugere uma data diferente e contextual (baseada em `close_date_prevista` e `expires_at`)
3. Nenhum email sugere reunião em data após `expires_at` da proposta
4. Ao rejeitar com motivo, o próximo run do mesmo agente recebe esse feedback no prompt
5. Ao editar+aprovar, o diff é salvo para aprendizado
6. O campo `scheduled_send_at` aparece na UI quando preenchido

