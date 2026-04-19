

## Diagnóstico

**Estado atual:**
- 8 regras `VENDAS: Avançar + Orquestrar - FUP-N → FUP-N+1` no pipeline VENDAS, cada uma com 3 ações `create_activity` (WhatsApp + Email + Ligação) + 1 `move_stage`. Mesmo padrão em PV (Pré-Venda).
- Trigger é `activity_completed`: ao concluir QUALQUER atividade da etapa atual, cria 3 novas + move etapa. **Resultado:** se o vendedor cria 3 atividades e completa só 1, as outras 2 ficam "órfãs" na etapa anterior + 3 novas surgem na próxima. Bola de neve.
- **214 atividades pendentes vencidas** acumuladas no banco hoje.
- `Email Agent` existe (draft) mas **não há integração** entre `execute-workflow` e o agente. A action `create_activity` com `activity_type: 'email'` só cria uma tarefa manual no CRM — não dispara e-mail real.

**Suas 3 perguntas, minha recomendação:**

### Resposta 1: Criar 1 atividade só vs limpar pendentes — **AS DUAS, combinadas**
- **Reduzir para 1 atividade obrigatória por etapa** (a mais importante: WhatsApp ou Ligação, decidido por você por etapa). Email vira automático via Email Agent (resposta 3).
- **Auto-cancelar pendentes da etapa anterior** ao mover de etapa. Não excluir do banco — marcar como `status='cancelled'` com `cancelled_reason='stage_advanced'`. Mantém histórico forense, some da lista do vendedor.

### Resposta 2: Integração Email + Email Agent — **nova action `trigger_email_agent`**
Adicionar tipo de ação no executor que enfileira execução do Email Agent via `enqueue-email-agent-triggers`. Trigger pode ser `stage_enter` (quando entra na etapa) — não precisa criar atividade manual.

---

## Plano de implementação

### FASE 1 — Auto-cancelamento de atividades órfãs (CRÍTICO)
**1.1 Nova action no executor:** `cancel_pending_activities`
- Em `supabase/functions/execute-workflow/index.ts`, adicionar `case 'cancel_pending_activities'` no switch.
- Config: `{ scope: 'previous_stage' | 'all_pending', exclude_completed_today: true }`.
- Lógica: `UPDATE activities SET status='cancelled', cancelled_at=NOW(), cancellation_reason='stage_advanced' WHERE opportunity_id=X AND status='pending' AND deleted_at IS NULL`.
- Adicionar coluna `cancellation_reason TEXT` em `activities` se não existir (migration).

**1.2 Auto-injetar a action nas regras com `move_stage`:** opção no modal de regra "Cancelar atividades pendentes ao avançar etapa" (default ON para regras novas). Migration backfill: adicionar essa action a todas 16 regras `Avançar + Orquestrar` existentes.

**1.3 UI:** lista de atividades passa a filtrar `status IN ('pending')` por padrão. Atividades canceladas viram aba/filtro "Canceladas" em `Activities.tsx` para auditoria.

### FASE 2 — Reduzir para 1 atividade por etapa
**2.1 Limpeza das 16 regras existentes:** manter apenas a action `create_activity` do tipo principal por etapa (sugestão: WhatsApp para FUP-1/2/3, Ligação para FUP-4+, Email vira automático). Migration que remove as 2 ações redundantes de cada regra.

**2.2 Confirmação no modal de regra:** badge "⚠️ Múltiplas atividades podem causar acúmulo. Recomendado: 1 atividade + Email Agent." quando >1 `create_activity` é configurado.

### FASE 3 — Integração com Email Agent (nova action)
**3.1 Nova action:** `trigger_email_agent`
- Config: `{ agent_id: UUID, mode: 'auto_send' | 'draft_for_review', template_hint?: string }`
- Lógica: `POST` para `enqueue-email-agent-triggers` com `{ opportunity_id, source: 'workflow_rule', stage_id }`. O agente lê o contexto, gera o e-mail, dispara via SMTP do vendedor (segue [Custom SMTP architecture](mem://features/email/custom-smtp-architecture)) e registra no histórico da oportunidade.

**3.2 Suporte no modal de regra:** novo card de ação com selector do agente + modo (Auto-enviar / Salvar como rascunho).

**3.3 Publicar Email Agent:** o agente está em `draft`. Promover para `prod` via fluxo de governance ([Agent governance flow](mem://architectural-decision/ai/agent-governance-and-publication-flow)).

**3.4 Trigger recomendado:** mudar regras de `activity_completed` (movia etapa) para combo:
- `activity_completed` → `move_stage` + `cancel_pending_activities` + `create_activity` (1 só, principal)
- `stage_enter` (nova regra paralela) → `trigger_email_agent` (dispara e-mail no instante)

### FASE 4 — Limpeza retroativa do "lixo" atual
**4.1 Migration de hygiene:** marcar como `cancelled` as 214 atividades pendentes vencidas há >7 dias, com motivo `legacy_cleanup_2026_04`. Não excluir.
**4.2 Notificação no app:** banner "X atividades antigas foram arquivadas — veja em Atividades > Canceladas" para cada vendedor afetado.

---

## Arquivos a editar (~9)

1. **Migration** — coluna `cancellation_reason`/`cancelled_at` em `activities`, backfill regras existentes para incluir `cancel_pending_activities`, limpeza retroativa das 214 atividades vencidas.
2. **`supabase/functions/execute-workflow/index.ts`** — adicionar cases `cancel_pending_activities` e `trigger_email_agent`.
3. **`supabase/functions/enqueue-email-agent-triggers/index.ts`** — aceitar `source: 'workflow_rule'` (verificar se já suporta).
4. **`src/components/workflows/WorkflowRuleModal.tsx`** — UI das 2 novas ações + warning de múltiplas atividades.
5. **`src/services/crm/workflow-rules.ts`** — tipos TypeScript das novas actions.
6. **`src/pages/Activities.tsx`** + **`FilterBar.tsx`** — filtro `status='pending'` default + aba "Canceladas".
7. **`src/services/supabase/activities.ts`** — `getActivityStats` exclui `cancelled` dos badges; novo método `cancelActivity(id, reason)`.
8. **Doc** — `docs/automation-stage-orchestration.md` explicando o novo padrão.
9. **Memória** — atualizar [FUP automation logic](mem://business-rules/crm/vendas-pipeline-fup-automation) com nova arquitetura (1 atividade + auto-cancel + email agent).

## Decisão necessária antes de começar

Preciso de **3 escolhas suas**:

**A) Qual atividade manter por etapa do FUP de VENDAS?**
- Opção 1: Sempre WhatsApp (mais usado)
- Opção 2: WhatsApp para FUP-1/2/3, Ligação para FUP-4 em diante
- Opção 3: Você decide etapa por etapa via modal

**B) E-mails do Email Agent: enviar automático ou rascunho para vendedor revisar?**
- Auto-enviar (mais rápido, requer agente bem treinado)
- Rascunho (vendedor abre, revisa, envia — mais seguro pra começar)

**C) Auto-cancelar atividades pendentes ao mover etapa: aplicar a TODAS as 16 regras existentes ou só nas novas?**
- Todas (limpa bagunça atual de uma vez)
- Só novas (zero risco, mas mantém o problema atual)

## Tempo estimado
~45 min após decisões confirmadas.

