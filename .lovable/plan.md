
# PRICE CORE 2.0 — Proposal Pricing Ledger (Revisado)

Fonte única da verdade financeira da proposta. Nenhum componente calcula valor monetário sozinho. Todos consomem `pricing_breakdown_snapshot`. O único cálculo autorizado é a RPC `recalculate_proposal_pricing_ledger`.

Execução faseada em **3 sub-sprints** independentes e deployáveis.

---

## FASE 2.0A — Banco + RPC + Backfill

### A.1 Migração de schema

Adicionar em `public.proposals` (defaults seguros):

- `pricing_subtotal_items numeric default 0`
- `pricing_manual_discount_percent numeric default 0`
- `pricing_manual_discount_amount numeric default 0`
- `pricing_inventory_adjustment_amount numeric default 0`
- `pricing_base_amount numeric default 0`
- `pricing_dynamic_adjustment_percent numeric default 0`
- `pricing_dynamic_adjustment_amount numeric default 0`
- `pricing_effective_amount numeric default 0`
- `pricing_payment_schedule_total numeric default 0`
- `pricing_erp_amount numeric default 0`
- `pricing_approval_amount numeric default 0`
- `pricing_breakdown_snapshot jsonb not null default '{}'::jsonb`
- `pricing_last_calculated_at timestamptz`
- `pricing_has_divergence boolean not null default false`
- `pricing_divergence_details jsonb not null default '{}'::jsonb`
- **`pricing_needs_recalculation boolean not null default false`** ← flag de "sujo"

### A.2 RPC `recalculate_proposal_pricing_ledger(p_proposal_id uuid)`

`SECURITY DEFINER`, `search_path = public`. Única função autorizada a calcular valores. Substitui internamente a lógica espalhada em `orchestrate_proposal_financials`, `calculate_dynamic_price`, `apply_dynamic_price` e nos `useMemo` de UI.

**Guarda de congelamento (item 3 do feedback):**
```text
IF status = 'accepted' AND price_frozen_on_approval = true:
    -- NÃO sobrescrever approved_amount, approval_snapshot, approved_payment_schedule
    -- NÃO sobrescrever campos pricing_* exibidos publicamente
    -- Apenas recalcular um "shadow snapshot" interno em pricing_divergence_details
    -- Atualizar pricing_has_divergence se shadow != approved
    -- pricing_needs_recalculation = false
    RETURN approval_snapshot
```

**Fluxo normal** (ordem oficial — item 6 do feedback):
```text
subtotal_items   = SUM(proposal_items.total) WHERE deleted_at IS NULL
manual_discount% = resolve_manual_discount(p_proposal_id)   -- item 5
manual_discount$ = round(subtotal_items * pct / 100, 2)
inventory_adj$   = SUM(proposal_items.inventory_adjustment_amount)
base_amount      = subtotal_items - manual_discount$ + inventory_adj$

IF dynamic_pricing_enabled AND applicability='automatic':
    tier      = resolve_active_tier(reference_date)
    dyn_adj%  = tier.adjustment_percent
    dyn_adj$  = round(base_amount * dyn_adj% / 100, 2)
ELSE dyn_adj% = 0; dyn_adj$ = 0

effective_amount = base_amount + dyn_adj$

-- Cronograma com arredondamento controlado (item 4 do feedback)
schedule         = regenerate_schedule(effective_amount, payment_terms)
-- regra: parcelas arredondadas para 2 casas; ÚLTIMA PARCELA absorve resíduo
-- => SUM(schedule) === effective_amount sempre que diff ≤ R$ 0,01
schedule_total   = SUM(schedule.amount)

erp_amount       = schedule_total
approval_amount  = effective_amount
```

**Divergência (item 4):**
- `has_divergence = ABS(effective_amount - schedule_total) > 0.01`
- OR (status='accepted' AND shadow_effective ≠ approved_amount)
- Detalhes em `pricing_divergence_details`.

**Espelhos em UMA transação:**
- Todos os campos `pricing_*`
- `dynamic_pricing_current_amount = effective_amount`
- `payment_expected_amount = erp_amount`
- `pricing_needs_recalculation = false`
- `pricing_last_calculated_at = now()`
- `pricing_breakdown_snapshot` completo: subtotal, descontos, inventário, base, ajuste dinâmico (% + $ + tier_id + reference_date + próximo tier + valor anterior expirado), effective, schedule (linhas + total), erp, approval, warnings[], pricing_status, raw_items_summary.

Retorno: snapshot completo.

### A.3 Helper SQL `resolve_manual_discount(p_proposal_id)`

Item 5 do feedback:
- Fonte canônica: `proposal_payment_terms.discount_percent` (do payment_term ativo)
- Fallback legacy: `(proposals.discount_amount / NULLIF(subtotal_items,0)) * 100`
- Se ambos > 0 e divergentes → usa `payment_terms` e empurra `{warning: "manual_discount_double_source", payment_terms_pct, legacy_pct}` para o snapshot.

### A.4 Triggers de marcação (NÃO recálculo direto — item 2 do feedback)

Triggers `AFTER INSERT/UPDATE/DELETE` que apenas setam `pricing_needs_recalculation = true` (e NÃO chamam a RPC, evitando custo em mudanças globais):

- `proposal_items` (qty, unit_price, discount_percent, inventory_adjustment_amount, deleted_at) → marca a proposta dona
- `proposal_payment_terms` (discount_percent, payment_condition, installments, datas, freeze_price_on_approval) → marca a proposta dona
- `proposals` (`expires_at`, `valid_until`, `dynamic_pricing_enabled`, `dynamic_pricing_applicability`, `dynamic_pricing_mode`, `discount_amount`) → marca a si mesma
- **`proposal_dynamic_pricing_rules` / `_tiers`** → trigger marca **apenas propostas da organização** que usam `applicability='automatic'`, em batch UPDATE. **Não chama RPC em loop.**

Guarda anti-recursão: trigger pula se já estiver dentro de `recalculate_proposal_pricing_ledger` (flag `pg_temp.skip_ledger_dirty`).

**Recálculo sob demanda** (item 2): RPC é chamada quando:
1. Abrir proposta (se `pricing_needs_recalculation=true`)
2. Salvar editor
3. Gerar PDF
4. Criar payment intent
5. Enviar ao ERP
6. Aprovar proposta

Propostas com `status IN ('accepted','declined','expired')` AND `price_frozen_on_approval=true` → trigger ainda marca `pricing_needs_recalculation=true` mas a RPC respeita o congelamento.

### A.5 Backfill

Rodar `recalculate_proposal_pricing_ledger` para todas as propostas em `('draft','sent','viewed','pending_approval')`. Propostas aprovadas/declinadas/expiradas: derivar snapshot a partir de `approval_snapshot` quando existir, senão de `total_amount`.

### A.6 Cenário crítico validado em SQL (item 9)

Script de validação executado pós-backfill em uma proposta de teste:
```text
subtotal_items                = 1994.00
manual_discount% / amount     = 5  / 99.70
base_amount                   = 1894.30
dynamic_adjustment% / amount  = 30 / 568.29
effective_amount              = 2462.59
schedule_total                = 2462.59
erp_amount                    = 2462.59
approval_amount               = 2462.59
has_divergence                = false
```

---

## FASE 2.0B — Frontend lendo o snapshot

### B.1 Helper único (read-only)

`src/lib/proposals/pricingLedger.ts`:
```ts
export interface ProposalPricingSummary { /* todos os campos + warnings + pricingStatus */ }
export function getProposalPricingSummary(proposal): ProposalPricingSummary
// só lê pricing_breakdown_snapshot; NÃO recalcula
```

### B.2 Hook único

`src/hooks/proposals/useProposalPricingLedger.ts`:
- `useProposalPricingLedger(id)` — query do snapshot, dispara recálculo se `pricing_needs_recalculation=true` ao abrir a proposta.
- `useRecalculateProposalPricingLedger(id)` — mutation que chama a RPC + invalida:
  `proposal`, `proposal-dynamic-pricing-snapshot`, `proposal-payment-intents`, `proposal-mismatch-row`, `proposal-payment-events`, `public-proposal-bundle`.

### B.3 Componente único

`src/components/proposals/ProposalPricingBreakdown.tsx`

Props: `proposal`, `audience: 'public' | 'internal'`, `compact?: boolean`.

**Audience `public`**: Subtotal • Desconto comercial (se >0) • Base comercial • Ajuste por antecedência (se ≠0) • **Total vigente hoje**.

**Audience `internal`**: público + Valor ERP, Valor cronograma, Valor aprovado, badge de divergência e botão "Recalcular".

### B.4 Edge functions de leitura

- `get-public-proposal-bundle`: passa a retornar `pricing_breakdown_snapshot` pronto. Se `pricing_needs_recalculation=true`, chama RPC antes de servir.
- `generate-proposal-pdf`: idem — chama RPC se sujo, renderiza a partir do snapshot.

### B.5 UI pública reorganizada

`PublicProposalView`:
- **Header**: apenas `pricing_effective_amount` com label "Valor vigente hoje".
- **Itens**: lista + subtotal bruto.
- **Resumo comercial**: `ProposalPricingBreakdown audience="public"`.
- **Condição comercial vigente**: faixa + próxima atualização + valor anterior expirado, do snapshot.
- **Condições de pagamento**: cronograma sobre `pricing_effective_amount` (ou `approved_amount` se aprovado), sem repetir total.
- Remover blocos duplicados de "valor vigente".

Componente da proposta aprovada (item 3): lê **exclusivamente** de `approval_snapshot` / `approved_amount`; ignora o ledger ao vivo.

---

## FASE 2.0C — Travas e remoção de cálculos duplicados

### C.1 Auditoria — remover `useMemo`/somas locais e substituir por `getProposalPricingSummary`

- `src/components/proposals/PublicProposalView.tsx` + subcomponentes
- `src/components/proposals/ProposalEditor.tsx`
- `src/components/proposals/ProposalPaymentTerms*.tsx`
- `src/components/proposals/ProposalDynamicPricingPanel.tsx`
- `src/components/proposals/ProposalItemsSummary.tsx`
- `src/components/proposals/DynamicPricingMismatchAlert.tsx` → refator para `ProposalPricingDivergenceAlert` lendo `pricing_has_divergence` + `pricing_divergence_details`
- `src/hooks/proposals/useProposalDynamicPricing.ts` (mantém API mas chama ledger por baixo)
- `src/services/proposals/proposalPaymentsService.ts`
- `src/services/proposals/erpBillingBridgeService.ts`

### C.2 Travas (item 7)

Padrão: **toda ação financeira chama `recalculate_proposal_pricing_ledger` antes; se `pricing_has_divergence=true`, bloqueia.**

- **`create_proposal_payment_intent`** (RPC): chama recalc; se divergência → `{ok:false, reason:'divergence'}`. `expected_amount = pricing_erp_amount`.
- **ERP bridge** (`createPixChargeFromPaymentIntent` + Umma/Human sync): recalc → se divergência, bloqueia com "Não foi possível enviar ao ERP. Existem valores divergentes na proposta. Recalcule a proposta antes de continuar." Sempre envia `pricing_erp_amount`.
- **Aprovação** (`accept-proposal` edge): recalc → se divergência, bloqueia com "Não foi possível aprovar a proposta. Existem valores divergentes." Senão grava:
  - `approved_amount = pricing_approval_amount`
  - `approved_payment_schedule = snapshot.payment_schedule`
  - `approved_dynamic_pricing_tier_id = snapshot.tier_id`
  - `approval_snapshot = pricing_breakdown_snapshot`
  - `price_frozen_on_approval = true`

Após aprovação, RPC respeita congelamento (item 3). UI mostra `ProposalPricingDivergenceAlert` interno se shadow ≠ approved.

### C.3 Botões desabilitados

"Enviar ao ERP", "Gerar cobrança", "Aprovar" → `disabled` quando `pricing_has_divergence=true`, com tooltip.

---

## Critérios de aceite

1. Cenário crítico do item 9 reproduzido em ambiente real: 1.994 → desconto 5% → base 1.894,30 → +30% → vigente 2.462,59. Header público, link público, PDF, cronograma, `approval_snapshot` e ERP exibem o mesmo valor.
2. Proposta sem desconto + sem tabela dinâmica → `effective = subtotal_items`.
3. Proposta recorrente → ajuste dinâmico = 0.
4. Editar item dispara `pricing_needs_recalculation=true`; abrir a proposta recalcula automaticamente.
5. Mudar regra global de pricing marca propostas da org como `needs_recalc`, sem recálculo em massa.
6. Aprovação congela: recalc posterior não altera `approved_*`, apenas atualiza shadow divergence.
7. Cronograma soma exatamente `effective_amount` (última parcela absorve centavos).
8. Divergência simulada (UPDATE manual em `payment_expected_amount`) → alerta interno + bloqueio de ERP/aprovação.
9. Typecheck + build verdes.
10. Nenhuma proposta PRICE 1.1 quebra (backfill cobre).

---

## Arquivos impactados

**Banco** (Fase A — 1 migração):
- ALTER TABLE `proposals` + RPC `recalculate_proposal_pricing_ledger` + helper `resolve_manual_discount` + triggers de marcação + backfill.

**Edge functions** (Fases B + C):
- `generate-proposal-pdf`, `get-public-proposal-bundle`, `accept-proposal`, sync Umma/Human de proposta.

**Frontend novos** (Fase B):
- `src/lib/proposals/pricingLedger.ts`
- `src/hooks/proposals/useProposalPricingLedger.ts`
- `src/components/proposals/ProposalPricingBreakdown.tsx`
- `src/components/proposals/ProposalPricingDivergenceAlert.tsx`

**Frontend editados** (Fase C):
- `PublicProposalView` + subcomponentes, `ProposalEditor`, `ProposalItemsSummary`, `ProposalPaymentTerms*`, `ProposalDynamicPricingPanel`, `DynamicPricingMismatchAlert`, `useProposalDynamicPricing`, `proposalPaymentsService`, `erpBillingBridgeService`.

---

## Riscos / Mitigações

- **Recursão de trigger**: guarda `pg_temp.skip_ledger_dirty`.
- **Custo em mudança de regra global**: triggers só marcam `needs_recalc`, recálculo é lazy.
- **Propostas legadas com desconto duplo**: helper canoniza + warning no snapshot.
- **Propostas aprovadas**: congelamento explícito na RPC.
- **PDF em cache**: invalidar `pdf_url` quando snapshot mudar antes de aprovação.
- **Arredondamento**: última parcela absorve centavos → garante `schedule_total === effective_amount`.

---

## Plano de rollout

1. **Fase 2.0A** — migração + RPC + triggers de marcação + backfill + validação do cenário crítico em SQL.
2. **Fase 2.0B** — helper + hook + componente + edge functions de leitura + UI pública reorganizada.
3. **Fase 2.0C** — remover cálculos duplicados, ativar travas de ERP/aprovação, alerta de divergência.
4. Typecheck + build em cada fase.
5. Validação E2E do cenário 1.994 → 2.462,59 em header, público, PDF, cronograma, approval, ERP.
