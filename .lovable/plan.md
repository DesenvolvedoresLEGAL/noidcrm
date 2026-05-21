## P0 — Parar clone de propostas na duplicação de oportunidade (Comercial → Operacional)

### Diagnóstico

Encontrado **um único ponto** que está clonando propostas no fluxo Ganhou → Operacional:

`supabase/functions/execute-workflow/index.ts` — action `duplicate` (linhas 576–685), bloco "Copy proposals and proposal items from source to new opportunity". Para cada proposta da oportunidade origem, ele insere uma nova linha em `proposals` com `status = 'draft'`, mais clones em `proposal_items` e `proposal_payment_terms`.

Não há outro lugar que copia propostas automaticamente em duplicação/won/handoff:
- `duplicateProposal` em `src/services/supabase/proposals.ts` é um botão manual da aba Propostas (não disparado por workflow); fica fora desta correção.
- `notify-deal-won` e demais edge functions não criam propostas.
- A coluna `opportunities.source_opportunity_id` já existe. **`opportunities.accepted_proposal_id` NÃO existe** no schema base (só aparece como coluna derivada na view `v_opportunity_amounts_v2`). Precisa ser criada.

PRICE AUDIT já tem `audit_scope_status` com valores como `out_of_scope_duplicate`; vamos somar `out_of_scope_clone_error` e o tipo de divergência `OPERATIONAL_PROPOSAL_CLONE_SHOULD_NOT_EXIST`.

---

### Plano

#### 1. Schema — vincular oportunidade operacional à proposta aprovada original
Migration:
- `opportunities.accepted_proposal_id uuid null` + FK para `proposals(id)` ON DELETE SET NULL + index.
- `proposals.superseded_by_proposal_id uuid null` (auto-referência) + index — usado para marcar clones que apontam para a proposta válida.
- `proposals.clone_status text null check in ('clone_error','superseded','active')` default null + index parcial.
- Trigger `trg_block_operational_proposal_clone`: BEFORE INSERT em `proposals`. Se a oportunidade alvo tem `source_opportunity_id` NOT NULL **e** o pipeline alvo é do tipo `onboarding` / `operational` / `cs` (via join em `pipelines.pipeline_type`) **e** já existe uma `proposals` com `accepted_at IS NOT NULL` na oportunidade origem, **levanta exceção** `OPERATIONAL_PROPOSAL_CLONE_BLOCKED`. Esse trigger é a salvaguarda no banco, independente do código de edge.
- Extender CHECK de `proposal_financial_audit_items.audit_scope_status` para incluir `out_of_scope_clone_error`.

#### 2. Edge function `execute-workflow` — remover clone de propostas
Em `supabase/functions/execute-workflow/index.ts`, na action `duplicate` (linhas 576–685):
- Remover por completo o bloco "Copy proposals and proposal items from source to new opportunity" (incluindo `proposal_items` e `proposal_payment_terms`).
- Substituir por: localizar na origem a proposta válida — `proposals.opportunity_id = origem AND accepted_at IS NOT NULL` (tie-break por `accepted_at` mais recente; fallback para `status='accepted'`); se encontrada, gravar `accepted_proposal_id = <id>` na nova oportunidade via `UPDATE opportunities`.
- Registrar em `system_events` evento `operational_handoff_proposal_link` com `source_opportunity_id`, `operational_opportunity_id`, `accepted_proposal_id`. Se não houver proposta aprovada, registrar `operational_handoff_no_accepted_proposal` e deixar `accepted_proposal_id = null` (a aba Propostas tratará o estado vazio).

#### 3. UI — aba Propostas da oportunidade operacional
`src/components/opportunity/OpportunityProposalsTab.tsx`:
- Quando a oportunidade tiver `source_opportunity_id` (ou pipeline tipo operacional/cs) e `accepted_proposal_id`, mudar para modo **read-only herdado**: buscar a proposta original por `accepted_proposal_id` e exibir 1 card com badge "Proposta aprovada herdada do comercial" + link "Ver no funil comercial". Esconder botões "Nova proposta", "Duplicar", "Editar como nova".
- Se `accepted_proposal_id IS NULL` em oportunidade operacional: mostrar empty state explicando que a comercial ainda não tem proposta aprovada vinculada (sem botão de criar).
- Sem mudanças em oportunidades comerciais — a aba continua igual.

#### 4. PRICE AUDIT — detectar clones operacionais legados
- Estender a RPC `run_proposal_financial_audit` (v4): para cada `proposals` cuja `opportunity` tem `source_opportunity_id IS NOT NULL` e pipeline tipo operacional/cs, e cuja origem possui proposta com `accepted_at`, marcar:
  - `audit_scope_status = 'out_of_scope_clone_error'`
  - acrescentar `OPERATIONAL_PROPOSAL_CLONE_SHOULD_NOT_EXIST` em `divergence_types`
  - `recommended_action = 'mark_clone_error_and_link_original'`
  - preencher `source_proposal_id` com a proposta aprovada da origem
- Atualizar contadores em `proposal_financial_audit_runs` (`out_of_scope_count` e novo `clone_error_count`).
- Service `proposalFinancialAuditService.ts` + UI `PriceAuditPage.tsx`: novo KPI "Clones operacionais", novo filtro `scopeMode = 'only_clone_errors'` e badge dedicado na coluna Escopo. Apply continua bloqueado para qualquer item ≠ `in_scope`.

#### 5. Correção retroativa (dry-run only, sem deletar)
Nova RPC `dry_run_detect_operational_proposal_clones(p_period_start, p_period_end)`:
- Retorna linhas com `clone_proposal_id`, `original_approved_proposal_id`, `source_opportunity_id`, `operational_opportunity_id`, `client`, `value_clone`, `value_original`, `created_at`, `reason_detected`.
- Não escreve em `proposals` nem deleta nada. Apenas registra um evento por run em `system_events` (`operational_clone_dry_run`).
- Nova RPC manual `mark_operational_proposal_clone(p_clone_proposal_id, p_original_proposal_id)` (SECURITY DEFINER, exige role admin):
  - `UPDATE proposals SET clone_status='clone_error', superseded_by_proposal_id=p_original_proposal_id` no clone
  - `UPDATE opportunities SET accepted_proposal_id=p_original_proposal_id` na operacional
  - Insere `system_events` com before/after. Nada é deletado.
- UI: botão "Marcar como clone operacional" no drawer do PRICE AUDIT quando `divergence_types` contém `OPERATIONAL_PROPOSAL_CLONE_SHOULD_NOT_EXIST`. Confirmação dupla.

#### 6. Casos NETSEEDS / ORGÂNICA
Após deploy, rodar `dry_run_detect_operational_proposal_clones('2026-05-01','2026-05-31')` e validar manualmente:
- NETSEEDS: PROP-2026-00739 = original aprovada; PROP-2026-00758 = candidata a clone_error.
- ORGÂNICA: PROP-2026-00717 = original aprovada; PROP-2026-00732 = candidata a clone_error.
Marcar via UI somente após confirmação do usuário (nada automático).

#### 7. Critérios de aceite
- Workflow `duplicate` não cria mais linhas em `proposals` / `proposal_items` / `proposal_payment_terms`.
- Oportunidade operacional gravada com `accepted_proposal_id` apontando para a proposta aprovada da comercial.
- Aba Propostas da operacional mostra a proposta original com badge herdado, sem botão de criar/duplicar.
- Trigger DB rejeita qualquer INSERT em `proposals` que tente clonar para pipeline operacional quando há proposta aprovada na origem.
- PRICE AUDIT classifica clones legados como `out_of_scope_clone_error`, sem afetar `in_scope_delta`.
- Dry-run lista NETSEEDS-00758 e ORGÂNICA-00732 como clones candidatos; nenhuma alteração automática.
- Nada deletado. Tudo auditado em `system_events`.
- Typecheck e build passam.

---

### Fora de escopo
- `duplicateProposal` manual (botão da aba) — mantido.
- ERP, Pix, provider bancário, Slack: sem mudanças neste passo.
- Recalcular comissão/forecast retroativamente: virá em passo separado após marcação manual dos clones.

### Arquivos afetados
- `supabase/migrations/<nova>_block_operational_proposal_clone.sql`
- `supabase/functions/execute-workflow/index.ts`
- `src/components/opportunity/OpportunityProposalsTab.tsx`
- `src/services/proposals/proposalFinancialAuditService.ts`
- `src/pages/settings/system/PriceAuditPage.tsx`
- `src/integrations/supabase/types.ts` (auto)

### Riscos
- Workflows ativos que dependiam do clone de proposta vão parar de criar drafts no operacional. Comportamento intencional; comunicado pela badge "herdada".
- Trigger DB pode bloquear scripts manuais antigos; mitigado por mensagem clara `OPERATIONAL_PROPOSAL_CLONE_BLOCKED` e exceção apenas quando há `accepted_at` na origem.
