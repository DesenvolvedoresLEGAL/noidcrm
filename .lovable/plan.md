# Sprint B — Decision Engine: Score Vira Ação Automática

Transformar o output da Sprint A (enrichment com `quality_label` + `priority_score`) em ações reais no CRM (oportunidade, owner, task, sequência) sem intervenção humana, com governança total via regras configuráveis e logs auditáveis.

## Arquitetura

```text
ENRICHMENT (pronto)
    ↓ quality_label ∈ {high_confidence, usable}
DECISION ENGINE (novo)
    ↓ matching de regras + scoring
EXECUTION (novo)
    ↓ create opportunity / assign owner / create task / enroll sequence
CRM (existente)
```

Reaproveitamos: `prospects`, `prospect_scores.priority_score`, `enrichment_runs.quality_label/quality_score`, `opportunities`, `activities`, `accounts`, `sequence_enrollments`, `pipelines`. Usamos `organization_id` (terminologia do projeto), não `workspace_id`.

## 1. Banco de Dados (migration)

### `decision_rules`
Regras configuráveis por organização. Match por faixa de score/confiança/contact_score. Ações independentes (boolean por tipo). Campo `priority` (int) para resolver conflitos entre regras.

Colunas-chave: `organization_id`, `name`, `is_active`, `priority` (menor = mais específica), `min_score`/`max_score`, `min_confidence`, `min_contact_score`, `action_create_opportunity`, `action_create_task`, `action_assign_owner`, `action_enroll_sequence`, `pipeline_id` (text — match com `opportunities.pipeline_id`), `stage_id` (text), `sequence_id` (uuid), `owner_strategy` ∈ {`round_robin`,`fixed`,`territory`}, `fixed_owner_user_id`, `priority_label` ∈ {`hot`,`warm`,`cold`}, `task_template` (jsonb).

RLS: select/insert/update/delete por `organization_id` do usuário.

### `decision_logs`
Auditoria imutável de toda decisão tomada (ou não tomada).
Colunas: `organization_id`, `prospect_id`, `enrichment_run_id`, `rule_id` (nullable — quando nenhuma regra casou), `score`, `confidence`, `quality_label`, `decision_taken` ∈ {`executed`,`skipped_no_rule`,`skipped_duplicate`,`skipped_low_quality`,`failed`}, `actions_executed` (jsonb: `{opportunity_id, owner_user_id, activity_id, sequence_enrollment_id}`), `decision_payload` (jsonb — snapshot da regra), `error_message`.

RLS: select por organização; insert via service_role apenas (edge function).

### `outbound_tasks`
Fila de tasks de outbound geradas automaticamente (separada de `activities` para não poluir o CRM até serem aceitas/disparadas).
Colunas: `organization_id`, `prospect_id`, `account_id`, `opportunity_id`, `owner_user_id`, `task_type` ∈ {`email`,`whatsapp`,`call`}, `payload` (jsonb), `due_at`, `status` ∈ {`pending`,`scheduled`,`sent`,`failed`,`cancelled`}, `decision_log_id`.

Nota: a Sprint B cria a `activities` real no CRM (para o SDR ver) E grava a entrada em `outbound_tasks` para tracking de outbound. Activities = visível no CRM; outbound_tasks = camada de tracking/automação.

### `owner_queue`
Fila de round-robin por organização.
Colunas: `organization_id`, `user_id`, `weight` (default 1), `is_active`, `last_assigned_at`, `role_filter` (text — ex: `sdr`, `closer`, `null`=qualquer).

RLS: select por organização; manage por admins.

### Alteração em `opportunities`
Já tem `priority_score`, `prospect_id`, `source_metadata`. Não precisa alterar schema. Vamos popular `source_metadata` com `{caramelo: true, decision_log_id, rule_id, priority_label}` para rastreabilidade.

## 2. Edge Function: `run-decision-engine`

Input: `{ prospect_id, enrichment_run_id, organization_id, dry_run?: boolean }`.

Fluxo:
1. **Validar JWT** + carregar prospect, enrichment_run, prospect_scores.
2. **Anti-loop**: se já existe `decision_logs` com `decision_taken=executed` para esse `enrichment_run_id` → retornar log existente.
3. **Anti-baixa-qualidade**: se `quality_label ∈ {low_confidence, insufficient}` → log `skipped_low_quality` e sair.
4. **Anti-duplicação**: se `prospect.matched_account_id` já tem oportunidade aberta (`status NOT IN ('won','lost')`, `deleted_at IS NULL`) → log `skipped_duplicate`.
5. **Match de regras**: SELECT ativas da organização ordenadas por `priority ASC, min_score DESC`. Filtra: `score BETWEEN min_score AND max_score`, `confidence >= min_confidence`. Pega a primeira.
6. **Sem regra** → log `skipped_no_rule`.
7. **Executar ações** em ordem (todas idempotentes, dentro de try/catch individual):
   - `assignOwner()` — round-robin via `owner_queue` (lock + update `last_assigned_at`) ou `fixed_owner_user_id`.
   - `createOpportunity()` — usa `account_id` se prospect tem `matched_account_id`; senão cria account a partir do prospect (CNPJ/razão social/website). Título em MAIÚSCULAS (regra do projeto). `priority_score`, `pipeline_id`, `stage_id`, `owner_user_id`, `prospect_id`, `playbook_run_id`, `source_metadata`.
   - `createTask()` — insere em `activities` (visível ao SDR) + espelha em `outbound_tasks`. Usa `task_template` da regra com placeholders (`{{company_name}}`, `{{summary}}`).
   - `enrollSequence()` — insere em `sequence_enrollments` se `sequence_id` definido na regra.
8. **Salvar `decision_logs`** com tudo que foi feito (e ids gerados).
9. **Response**: `{ decision_taken, actions_executed, rule_applied, log_id }`.

`dry_run: true` faz tudo menos persistir — útil para o frontend de "Preview de regra".

`verify_jwt = false` no config.toml, validação manual em código (padrão do projeto).

## 3. Bootstrap: 3 regras default por organização

Migration popula via trigger `on_organization_created` ou função RPC `seed_default_decision_rules(org_id)`:
- **Hot Lead** — `min_score=220`, `min_confidence=70`, todas as 4 ações `true`, `priority_label=hot`, `priority=10`.
- **Warm Lead** — `min_score=180`, `max_score=219`, oportunidade+owner+task (sem sequência), `priority_label=warm`, `priority=20`.
- **Cold Lead** — `max_score=179`, todas as ações `false` (apenas log), `priority_label=cold`, `priority=30`.

## 4. Integração com Enrichment

No final de `run-enrichment/index.ts`, após o INSERT em `enrichment_runs`:
```ts
if (qualityLabel === "high_confidence" || qualityLabel === "usable") {
  // fire-and-forget — não bloqueia resposta do enrichment
  supabase.functions.invoke("run-decision-engine", {
    body: { prospect_id, enrichment_run_id: runId, organization_id }
  }).catch(err => console.error("decision engine trigger failed", err));
}
```
Sem await. Erros em decision engine não devem quebrar enrichment.

## 5. Frontend

### Nova página: `Settings → NOID Intelligence → Decision Rules`
Caminho: `src/pages/settings/noid-intelligence/DecisionRulesPage.tsx`.
- Tabela de regras com toggle ativo/inativo, edit/delete.
- Modal de criação/edição com todos os campos da regra.
- Botão "Testar regra" → chama `run-decision-engine` com `dry_run=true` em prospect selecionado.

### Componente: `DecisionBadge` em `LeadResultsTable` e `ProspectDetailDrawer`
Lê última `decision_logs` do prospect:
- 🔥 **Auto Executado** (verde) — `decision_taken=executed`, `priority_label=hot`
- ⚡ **Em Fila SDR** (amarelo) — `executed` + `warm`
- ❄️ **Ignorado** (cinza) — `skipped_*` ou `cold`

### Drawer: nova aba "Decisão" em `ProspectDetailDrawer`
Mostra:
- Regra aplicada + score/confiança no momento.
- Ações executadas com links (oportunidade criada, owner atribuído, task criada).
- Botão "Reprocessar decisão" (re-invoca edge function).

### Activity Feed (existente)
Os logs já são visíveis via `activities` (task automática) e `opportunity_stage_history` (oportunidade criada). Adicionar entrada no `audit-log` do projeto: "Caramelo criou oportunidade automaticamente para X, atribuída a Y".

### Hook: `src/hooks/useDecisionEngine.ts`
- `useDecisionRules(orgId)` — list/create/update/delete.
- `useDecisionLog(prospectId)` — última decisão.
- `useRunDecision(prospectId)` — mutation manual (re-trigger).

## 6. Proteções (críticas)

| Proteção | Implementação |
|---|---|
| Anti-duplicação | Check de oportunidade aberta para o `account_id`/`prospect_id` antes de criar. |
| Anti-loop | UNIQUE constraint em `(prospect_id, enrichment_run_id, decision_taken='executed')` parcial. |
| Rate limit | Counter em memória da edge function por organização (max 30/min). Configurável via `decision_rules` futuramente. |
| Idempotência | Cada ação verifica existência antes de criar (busca por `source_metadata->>'decision_log_id'`). |
| Falha parcial | Se uma ação falha, demais continuam; log marca `decision_taken=failed` com `error_message` mas grava `actions_executed` parciais. |

## 7. Testes

Plano de teste manual após deploy:
- **Caso 1** (score 250, confiança 80): cria oportunidade + owner + task + sequência. Decision log = `executed`/hot.
- **Caso 2** (score 190, confiança 60): cria oportunidade + owner + task. Sem sequência. Log = `executed`/warm.
- **Caso 3** (score 120): nenhuma ação. Log = `executed`/cold (regra cold roda mas não executa nada).
- **Caso 4** (re-rodar enrichment do mesmo prospect): segundo run NÃO duplica oportunidade — `skipped_duplicate`.
- **Caso 5** (`quality_label=insufficient`): `skipped_low_quality`, sem ações.

## Arquivos impactados

**Novos:**
- Migration: `decision_rules`, `decision_logs`, `outbound_tasks`, `owner_queue` + RLS + função `seed_default_decision_rules`.
- `supabase/functions/run-decision-engine/index.ts`.
- `src/pages/settings/noid-intelligence/DecisionRulesPage.tsx`.
- `src/components/decision-engine/DecisionRuleForm.tsx`.
- `src/components/decision-engine/DecisionRulesTable.tsx`.
- `src/components/decision-engine/DecisionBadge.tsx`.
- `src/components/decision-engine/DecisionDetailPanel.tsx` (aba do drawer).
- `src/hooks/useDecisionEngine.ts`.
- `src/services/decision-engine/decisionService.ts`.

**Editados:**
- `supabase/functions/run-enrichment/index.ts` (hook fire-and-forget no fim).
- `src/components/playbook/ProspectDetailDrawer.tsx` (nova aba "Decisão").
- `src/components/playbook/LeadResultsTable.tsx` (coluna `DecisionBadge`).
- `src/pages/settings/noid-intelligence/NoidIntelligenceHub.tsx` (entry para Decision Rules).
- App router (rota nova).

## Riscos

- **Account creation cascata**: ao criar oportunidade para prospect sem `matched_account_id`, vamos criar account novo. Precisa respeitar a regra do projeto de "semantic duplicate prevention" — vamos reusar a função `find_or_create_account` se existir; caso contrário, fallback simples por CNPJ/normalized_domain.
- **Round-robin race condition**: usar `SELECT ... FOR UPDATE SKIP LOCKED` no `owner_queue` para evitar atribuir mesmo owner duas vezes em chamadas concorrentes.
- **Hook em enrichment**: fire-and-forget pode perder execuções se a edge function reiniciar. Aceitável na Sprint B; Sprint C pode adicionar `enrichment_runs.decision_status` + cron de retry.
- **Permissões**: regras default precisam ser criadas em organizações existentes (one-shot na migration via SELECT em todas as orgs ativas).

## Próximos passos pós-aprovação

1. Migration (decision_rules + decision_logs + outbound_tasks + owner_queue + seed default + popular orgs existentes).
2. Edge function `run-decision-engine` + deploy.
3. Hook em `run-enrichment` + redeploy.
4. Frontend (página de regras + badge + aba do drawer).
5. Smoke test com 3 prospects (hot/warm/cold).
