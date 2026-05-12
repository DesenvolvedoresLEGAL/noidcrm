# PRICE UX 1.0.4 — Data de referência comercial na tabela dinâmica

Hoje a tabela dinâmica calcula sempre com `now()`. Esta sprint permite que a **condição de pagamento** defina qual data ancora a faixa vigente (à vista, vencimento, customizada ou aprovação congelada).

## 1. Banco de dados

**Migration A — `proposal_payment_terms`**
- `dynamic_pricing_reference_type text not null default 'current_date'`
  - check: `('current_date','payment_due_date','custom_date','approval_date')`
- `dynamic_pricing_reference_date date null`
- `freeze_price_on_approval boolean not null default false`
- `requires_commercial_approval boolean not null default false`
- Estender check `payment_condition` para incluir `net_7`, `net_15`, `net_30`, `net_35`, `invoiced`.

**Migration B — `proposals` (snapshot)**
- `dynamic_pricing_reference_type text null`
- `dynamic_pricing_reference_date timestamptz null`
- `price_frozen_on_approval boolean not null default false`
- `price_frozen_at timestamptz null`

## 2. Funções SQL

**Nova:** `resolve_dynamic_pricing_reference_date(p_proposal_id uuid) returns table(reference_type text, reference_at timestamptz)`
- Lê `proposal_payment_terms` + proposta.
- Defaults por `payment_condition`:
  - `upfront` → `current_date` → `now()`
  - `split_50_50` + `freeze_price_on_approval` → `approval_date` → `coalesce(approved_at, now())`
  - `net_7|net_15|net_30|net_35|invoiced|installments` → `payment_due_date` → primeira data do cronograma (`first_payment_date`, `entry_date + payment_due_days`, ou `now() + interval`)
  - `custom_date` → `dynamic_pricing_reference_date`
- Tipo explícito em `dynamic_pricing_reference_type` sempre prevalece sobre o default por condição.

**Alterar:** `calculate_proposal_dynamic_price(p_proposal_id uuid, p_reference_at timestamptz default null)`
- Se `p_reference_at` nulo → chama `resolve_dynamic_pricing_reference_date`.
- Compara faixas usando essa referência.
- Snapshot de retorno carrega `reference_type`, `reference_date`.

**Alterar:** `apply_dynamic_price_to_proposal(p_proposal_id, p_reference_at default null)`
- Persiste em `proposals`: `current_amount`, `current_tier_*`, `dynamic_pricing_reference_type`, `dynamic_pricing_reference_date`.
- Se condição é `split_50_50` + `freeze_price_on_approval` e proposta foi aceita: marca `price_frozen_on_approval=true` e `price_frozen_at=now()`. Após congelado, recálculos são no-op para o saldo.

**Alterar:** `generate_event_antecedence_pricing_for_proposal`
- Mantém geração de faixas pela validade.
- Marca a faixa "vigente" usando referência resolvida (não `now()`).

**Alterar:** `create_proposal_payment_intent`
- Quando `reference_type = payment_due_date`, usa data de vencimento da cobrança como referência e `expected_amount` = valor calculado nessa data.

**Alterar:** `orchestrate_proposal_financials` para passar referência resolvida em todas as etapas.

## 3. Backend (TS)

`src/services/proposals/proposalDynamicPricing.ts`
- `calculateDynamicPrice(proposalId, referenceAt?)` aceita override opcional.
- Novo helper `resolveDynamicPricingReference(proposalId)` (RPC wrapper).

`src/services/supabase/proposal-payment-terms.ts`
- Schema Zod ganha os 4 campos novos; persistência em create/update.

## 4. Frontend

**`ProposalPaymentTerms.tsx`** (bloco de pagamento)
- Novo combobox **"Precificação baseada em"**:
  - Pagamento imediato (`current_date`)
  - Vencimento da cobrança (`payment_due_date`)
  - Data personalizada (`custom_date` + date picker)
  - Condição especial aprovada (`approval_date` + toggle `freeze_price_on_approval`)
- Defaults automáticos por `payment_condition` (regra do item 13).
- Nova condição **"Faturado em 35 dias"** (`net_35`, `payment_due_days=35`, ref=`payment_due_date`).
- Toggle `requires_commercial_approval` quando aplicável.

**`ProposalDynamicPricingPanel.tsx`**
- Mostrar cabeçalho com: data de referência, tipo, faixa aplicada, ajuste, valor calculado.
- Recalcular ao trocar condição/ref-date.

**`PublicProposalDynamicPricingBanner.tsx` + `PublicProposalPaymentBlock.tsx`**
- Quando `reference_type ≠ current_date`: exibir aviso "Esta condição foi calculada com base na data prevista de pagamento" + data + faixa + ajuste.

**Cronograma (`PublicProposalPaymentBlock` / `ProposalDynamicPaymentPanel`)**
- Linha "Pagamento faturado — Vencimento: dd/mm/aaaa — Valor: R$ X".
- Para `split_50_50` congelado: mostrar "Valor aprovado congelado na aprovação" + entrada/saldo, sem recálculo no saldo.

**`PublicProposalApprovedScreen.tsx`**
- Exibir reference_type, reference_date, condição aprovada, congelamento sim/não.

**`PdfDynamicPricingSection.tsx` / preview PDF**
- Bloco financeiro: data de referência, faixa, critério usado + parágrafo legal do item 20.

## 5. Aceite

- À vista usa `now()`; net_35 usa hoje+35d; faixa pós-validade aplicada quando vencimento ultrapassa `valid_until`.
- Cronograma, link público, PDF e tela pós-aprovação refletem a data de referência.
- `split_50_50` + freeze trava preço; saldo não é recalculado.
- `payment_intent.expected_amount` igual ao valor da faixa na referência.
- Tabela dinâmica atual (sem novos campos) continua funcionando: defaults retrocompatíveis (`current_date`, freeze=false).
- Build + typecheck passam.

## Riscos

- Funções SQL são compartilhadas com orquestrador e ERP bridge — manter assinatura com default null garante retrocompatibilidade.
- Snapshot na proposta cresce; cuidado com triggers que reescrevem `current_amount`.
- Public link: RLS já permite leitura via token; novos campos seguem a mesma policy.

## Arquivos impactados

```
supabase/migrations/<novas 2 migrations>
src/services/proposals/proposalDynamicPricing.ts
src/services/proposals/proposalOrchestrator.ts
src/services/supabase/proposal-payment-terms.ts
src/lib/proposals/dynamicPricing.ts
src/lib/proposals/proposalPayments.ts
src/components/proposals/ProposalPaymentTerms.tsx
src/components/proposals/ProposalDynamicPricingPanel.tsx
src/components/proposals/ProposalDynamicPaymentPanel.tsx
src/components/proposals/PublicProposalDynamicPricingBanner.tsx
src/components/proposals/PublicProposalPaymentBlock.tsx
src/components/proposals/PublicProposalApprovedScreen.tsx
src/components/proposals/PdfDynamicPricingSection.tsx
src/hooks/proposals/useProposalDynamicPricing.ts
src/integrations/supabase/types.ts (auto)
```
