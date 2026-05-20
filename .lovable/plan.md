## PRICE AUDIT MAY 2026 — Plano final (com ajustes obrigatórios)

Auditoria retroativa read-only por padrão. Pix/Provider/Banco/ERP real **fora de escopo**. Primeira execução será **somente dry-run de maio/2026**.

### Ajustes incorporados

- `proposals.total_amount` é **legado/evidência**. Apply nunca prioriza esse campo.
- `canonical_source = 'erp_payload'` **nunca** aplica em modo safe → força `needs_review`.
- Slack é **evidência, nunca fonte contábil**. Sem parsing frágil de texto.
- `reconstructed_ledger_amount` é apenas diagnóstico, nunca vira canonical automático.
- Validação obrigatória: PROP-2026-00755 deve aparecer como `divergent` com todos os valores conflitantes.

---

### 1. Migration — Schema

**`proposal_financial_audit_runs`**: id, organization_id, period_start/end, status (`running|completed|failed`), `dry_run boolean default true`, total_proposals, ok_count, divergent_count, needs_review_count, total_approved_amount, total_detected_delta, created_by, created_at, completed_at, metadata jsonb. RLS: org members SELECT; mutação via RPC.

**`proposal_financial_audit_items`**: todos os campos do briefing, mais:
- `reconstructed_ledger_amount numeric` — diagnóstico para propostas sem ledger/snapshot.
- `raw_values jsonb` inclui `raw_slack_payload`, `raw_slack_message`, `raw_erp_payload`, `raw_payment_intent`, `raw_approval_snapshot`.
- CHECK constraints para enums `audit_status` (`ok|divergent|needs_review|fixed|ignored`) e `canonical_source` (`approval_snapshot|approved_amount|approved_payment_schedule|pricing_breakdown_snapshot|payment_intent|erp_payload|manual_review`).
- Índices: `(audit_run_id)`, `(proposal_id)`, `(organization_id, audit_status)`.

**Flags em `proposals` (ADD COLUMN IF NOT EXISTS)**: `financial_audit_status text`, `financial_audit_last_run_id uuid`, `financial_audit_delta numeric`, `erp_sync_needs_review boolean default false`, `slack_notification_needs_correction boolean default false`.

### 2. RPC `run_proposal_financial_audit(p_period_start, p_period_end, p_dry_run default true)`

SECURITY DEFINER, `search_path = public`, gate `has_role` admin/owner.

1. Cria run com `status = 'running'`.
2. Seleciona propostas da org no período via `approved_at`/`accepted_at`/oportunidade ganha (`closed_at`)/existência de `proposal_erp_sync_logs`.
3. Para cada proposta coleta:
   - `slack_amount`: **somente** se `notification_delivery_logs` tem campo estruturado (`payload->>'amount'` numérico). Caso contrário fica NULL e o payload bruto vai em `raw_values.raw_slack_payload`/`raw_slack_message`. Sem regex sobre texto.
   - `deal_amount`: `opportunities.value`.
   - `proposal_total_amount`: legado, só evidência.
   - `ledger_effective_amount`, `ledger_erp_amount`: de `pricing_breakdown_snapshot`.
   - `approved_amount`, `approval_snapshot_amount` (`approval_snapshot->>'amount'`), `payment_schedule_total` (soma de `approved_payment_schedule`).
   - `payment_intent_expected_amount`: último `proposal_payment_intents`.
   - `erp_sent_amount`: último payload em `proposal_erp_sync_logs`.
   - `reconstructed_ledger_amount`: se faltam ledger e approval_snapshot, recomputa via itens + descontos atuais para diagnóstico (marca `divergence_types += SEM_LEDGER`/`SEM_APPROVAL_SNAPSHOT`). Nunca usado como canonical automático.
4. `max_delta` = maior diferença par-a-par entre valores não-nulos contábeis (Slack excluído do cálculo de divergência contábil; gera apenas flag `DIVERGENCIA_SLACK` se diferir).
5. Classifica `divergence_types`: `DIVERGENCIA_HEADER`, `DIVERGENCIA_DEAL`, `DIVERGENCIA_PAYMENT_SCHEDULE`, `DIVERGENCIA_SLACK`, `DIVERGENCIA_ERP`, `DIVERGENCIA_APPROVAL_SNAPSHOT`, `SEM_LEDGER`, `SEM_APPROVAL_SNAPSHOT`, `VALOR_APROVADO_INDETERMINADO`.
6. `canonical_amount` na ordem: `approval_snapshot` → `approved_amount` → `approved_payment_schedule` → `pricing_breakdown_snapshot` → `payment_intent` → `erp_payload` (apenas como rótulo) → `manual_review`.
7. `recommended_action`:
   - `apply_safe` somente quando `canonical_source ∈ {approval_snapshot, approved_amount, approved_payment_schedule, pricing_breakdown_snapshot}`.
   - `manual_review` quando `canonical_source ∈ {payment_intent, erp_payload, manual_review}` ou divergências contábeis sem fonte confiável.
   - `mark_erp_review` quando há `DIVERGENCIA_ERP`.
   - `mark_slack_correction` quando há `DIVERGENCIA_SLACK`.
8. `audit_status`: `ok` se `max_delta <= 0.01` e sem flags `SEM_*`/`INDETERMINADO`; senão `divergent` ou `needs_review` (quando fonte canônica não é confiável).
9. Insere itens; atualiza run com totais; **não muda nada nas propostas em dry-run**.
10. Se `p_dry_run = false`, atualiza apenas as flags de auditoria em `proposals` (`financial_audit_status`, `financial_audit_last_run_id`, `financial_audit_delta`). Nunca toca valores aprovados nem `total_amount` aqui.

### 3. RPC `apply_proposal_financial_audit_item(p_audit_item_id, p_apply_mode default 'safe')`

SECURITY DEFINER, apenas admin/owner. Captura `metadata.before` (proposta + opp + flags) e `metadata.after`.

Regras de modo `safe`:
1. **Rejeita** quando `canonical_source ∈ {erp_payload, payment_intent, manual_review}` → vira `needs_review` automaticamente (sem tocar dados).
2. **Não atualiza `proposals.total_amount` como primeira opção.** Ordem de atualização:
   - Atualiza `opportunities.value` se `DIVERGENCIA_DEAL`.
   - Atualiza campos de base de forecast/comissão (se colunas dedicadas existirem na proposta/oportunidade).
   - Atualiza flags de auditoria na proposta.
3. `proposals.total_amount` só é atualizado se `p_apply_mode = 'mirror_legacy_total'` (modo separado). Nesse caso registra before/after e adiciona `metadata.mirrored_legacy_total = true`.
4. Marca `erp_sync_needs_review = true` se `DIVERGENCIA_ERP`.
5. Marca `slack_notification_needs_correction = true` se `DIVERGENCIA_SLACK`.
6. **Nunca sobrescreve `approval_snapshot`**. Caso a inconsistência exija (raro), exige `p_apply_mode = 'force_with_snapshot'` e guarda original em `metadata.previous_approval_snapshot`.
7. Insere `system_events` (`price_audit.applied`) com before/after e modo aplicado.
8. Atualiza item: `audit_status = 'fixed'`, `applied_at`, `applied_by`, `applied_mode`, `notes`.
9. Retorna JSON `{ before, after, applied_fields[], mode }`.

RPCs auxiliares:
- `ignore_proposal_financial_audit_item(p_audit_item_id, p_note)` → `audit_status='ignored'`.
- `mark_proposal_financial_audit_item_review(p_audit_item_id, p_note)` → `audit_status='needs_review'`.

### 4. Serviço + Hook

`src/services/proposals/proposalFinancialAuditService.ts`: runAudit, listAuditRuns, listAuditItems, getAuditItemDetail, applyAuditItem(mode), ignoreAuditItem, markNeedsReview.

`src/hooks/proposals/useProposalFinancialAudit.ts`: React Query com invalidação cruzada (proposta, opp, forecast).

### 5. UI Admin

Rota: `/settings/system/auditoria-financeira-propostas` (registrada em `SettingsLayout`).

Página `src/pages/settings/system/PriceAuditPage.tsx` envolta em `SettingsGate requiredLevel="full"`.

- Botão **Rodar auditoria** (modal: período, `dry-run` on/off, default ON e bloqueado para a primeira execução).
- Filtros: período, status, vendedor, com divergência, fonte canônica, cliente, busca por proposta.
- KPIs: Total auditado, OK, Com divergência, Necessitam revisão, Delta financeiro total, Comissões afetadas.
- Tabela com colunas do briefing + coluna **Reconstruído** (quando aplicável) e ação por linha.
- Ações por linha:
  - **Ver detalhes** (drawer).
  - **Aplicar correção segura** — desabilitada e com tooltip quando `recommended_action != 'apply_safe'`.
  - **Espelhar total legado** (oculta em padrão; visível só para owner em item já fixed).
  - **Ignorar** / **Marcar revisão manual**.
- Drawer de detalhe:
  - Todos os valores lado a lado (Slack, Deal, Proposal total, Ledger effective, Ledger ERP, Approved, Approval snapshot, Payment schedule, Payment intent, ERP sent, **Reconstructed ledger** quando houver).
  - Badge explicando fonte canônica e por que Slack/ERP são evidência.
  - Diff antes/depois (preview do apply).
  - Eventos (aprovação, ERP, Slack — payload bruto quando sem campo estruturado).

Componentes: `PriceAuditKpis`, `PriceAuditFilters`, `PriceAuditTable`, `PriceAuditItemDrawer`, `PriceAuditRunDialog`. Reusa `formatLedgerBRL`.

### 6. Segurança

- Todas RPCs `SECURITY DEFINER` + `SET search_path = public` + gate `has_role`.
- Dry-run default + confirmação textual no apply.
- Nenhuma chamada a ERP/Pix/banco.
- `approval_snapshot` imutável salvo modo forçado com snapshot guardado.
- Logs em `system_events` + `metadata.before/after` por item.

### 7. Validação obrigatória

1. Migration aplicada.
2. Dry-run da org de OGGI para `2026-05-01..2026-05-31`.
3. **Checagem mandatória**: PROP-2026-00755 listada como `divergent`, com Slack 2991.00, Deal 2542.35, Header 2203.37, Itens 2991.00, Pagamento 2203.37, Cronograma 2127.10, ERP 2991.00 — todos visíveis no drawer.
4. Nenhuma alteração em propostas após dry-run.
5. `tsc --noEmit` + build limpos.

### 8. Fora de escopo

- Pix, provider, banco, ERP real, novas cobranças.
- Recálculo automático sem dry-run.
- Uso de `total_amount` como fonte canônica.
- Parsing de texto Slack.

---

### Ordem de execução
1. Migration (tabelas + flags + RPCs run/apply/ignore/mark_review).
2. Tipos Supabase regenerados.
3. Serviço + hook.
4. Página + componentes + rota.
5. Dry-run maio/2026 + validação OGGI.
