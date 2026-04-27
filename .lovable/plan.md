# Sprint B — Decision Engine ✅ ENTREGUE

Score enriquecido vira ação automática no CRM.

## Banco
- `decision_rules`, `decision_logs`, `outbound_tasks`, `owner_queue` criadas com RLS por organização.
- Funções: `seed_default_decision_rules(org_id)` e `claim_next_owner_round_robin(org_id, role)`.
- 3 regras default (Hot/Warm/Cold) populadas em todas as organizações existentes.
- Anti-loop: índice único parcial em `decision_logs(prospect_id, enrichment_run_id) WHERE decision_taken='executed'`.

## Edge Function `run-decision-engine`
- Input: `{ prospect_id, enrichment_run_id?, organization_id, dry_run? }`
- Anti-loop, anti-baixa-qualidade, anti-duplicação de oportunidade aberta
- Match por priority/score/confidence
- Ações idempotentes em try/catch individual: assign owner (round-robin via RPC `FOR UPDATE SKIP LOCKED`), criar account (se necessário), criar oportunidade (título MAIÚSCULO), criar activity + outbound_task, enroll sequence
- Log completo em `decision_logs` com `actions_executed` e `error_message`

## Hook em `run-enrichment`
- Após persistir o run, fire-and-forget para `run-decision-engine` quando `quality_label ∈ {high_confidence, usable}`.
- Falha não bloqueia o enrichment.

## Frontend
- `DecisionRulesPage` em `/app/settings/noid-intelligence/decision-rules` — toggle ativar/inativar e remoção de regras.
- Entry no `NoidIntelligenceHub` com badge "Auto".
- `DecisionBadge` na `LeadResultsTable` (🔥 Auto Executado / ⚡ Em fila SDR / ❄️ Cold / Ignorado / Falhou).
- Aba "Decisão" no `ProspectDetailDrawer` com histórico e botão "Reprocessar".
- Hooks: `useDecisionRules`, `useLatestDecisionLog`, `useDecisionLogs`, `useRunDecisionEngine`.

## Próximas iterações sugeridas (Sprint B+)
- Modal de criação/edição completo de regras (atualmente só toggle/delete).
- Gestão UI da `owner_queue` (admin).
- Rate limit configurável.
- Cron de retry para enrichments cujo decision engine falhou.
