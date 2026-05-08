# Sprint PRICE 1.1 — Pix Dinâmico, ERP e Cobrança Complementar

## Objetivo
Conectar a tabela de preço dinâmica (PRICE 1.0) ao ciclo financeiro: cliente só quita pelo valor vigente; pagamento manual abaixo do vigente vira pagamento parcial com cobrança complementar automática.

---

## 1. Banco de Dados (1 migração)

### Novas tabelas
- **`proposal_payment_intents`** — intenções de cobrança ligadas à proposta e ao tier dinâmico vigente
  - Vincula `proposal_id`, `dynamic_pricing_rule_id`, `dynamic_pricing_tier_id`
  - Campos financeiros: `expected_amount`, `paid_amount`, `difference_amount`, `currency`
  - Status: `pending`, `paid_exact`, `paid_partial`, `paid_over`, `expired`, `cancelled`, `complementary_pending`, `complementary_paid`, `manual_review`
  - Origem: `proposal_link`, `crm_manual`, `erp_manual`, `complementary_charge`, `agent`
  - Método: `pix`, `bank_transfer`, `boleto`, `credit_card`, `manual`
  - Snapshots JSONB: `dynamic_pricing_snapshot`, `payment_gateway_snapshot`
  - Campos ERP/Pix: `erp_invoice_id`, `erp_charge_id`, `pix_qr_code`, `pix_copy_paste`, `expires_at`, `paid_at`

- **`proposal_payment_events`** — auditoria financeira
  - Tipos: `payment_intent_created`, `pix_generated`, `payment_received`, `payment_validated`, `payment_partial`, `payment_overpaid`, `payment_exact`, `complementary_charge_created`, `payment_expired`, `manual_review_required`, `cancelled`

### Alterações em `proposals`
Novos campos: `payment_validation_status`, `payment_expected_amount`, `payment_paid_amount`, `payment_difference_amount`, `latest_payment_intent_id`, `payment_snapshot` (JSONB).

### RLS
- `SELECT`: membros da organização (via `get_user_organization_id`).
- `INSERT/UPDATE` cobrança: comercial autorizado.
- Validação, cancelamento, ajuste e revisão manual: financeiro/admin/owner (via `has_role`).
- Eventos: insert por sistema/RPC; select por organização.

### RPCs (security definer, `search_path = public`)
1. **`create_proposal_payment_intent(p_proposal_id, p_source)`** — chama `calculate_proposal_dynamic_price`, bloqueia se `requires_requote`/`expired`/`disabled`, cria intent com `expected_amount = current_amount`, salva snapshot, registra `payment_intent_created`.
2. **`validate_proposal_payment_amount(p_payment_intent_id, p_paid_amount, p_paid_at, p_payment_reference)`** — recalcula valor devido na data efetiva, classifica em `paid_exact`/`paid_partial`/`paid_over`, atualiza intent + proposta, registra evento, marca `complementary_pending` se houver diferença positiva.
3. **`create_complementary_payment_intent(p_original_payment_intent_id)`** — cria nova intent com `source = complementary_charge` e `expected_amount = difference_amount`, registra `complementary_charge_created`.
4. **`expire_old_payment_intents()`** — marca intents pendentes vencidas como `expired`, registra `payment_expired`.

---

## 2. Backend TS

### `src/lib/proposals/proposalPayments.ts`
Schemas Zod, tipos, labels de status, helpers `formatBRL`, classificação de diferença, badge variants.

### `src/services/proposals/proposalPaymentsService.ts`
- `getPaymentIntents(proposalId)`, `getLatestIntent(proposalId)`
- `createPaymentIntent(proposalId, source)` (RPC 1)
- `validatePaymentManually(intentId, paidAmount, paidAt, reference, notes)` (RPC 2)
- `createComplementaryIntent(originalIntentId)` (RPC 3)
- `expireOldIntents()` (RPC 4)
- `listPaymentEvents(proposalId)`

### `src/services/proposals/erpBillingBridgeService.ts` (mock-ready)
- `createPixChargeFromPaymentIntent(intentId)` — gera payload Pix; se sem gateway, salva snapshot e marca `pix_generated`
- `getChargeStatus(erpChargeId)`
- `syncPaymentStatus(intentId)`
- `createComplementaryCharge(intentId)`

### `src/hooks/proposals/useProposalPayments.ts`
- `useProposalPaymentIntents`, `useLatestPaymentIntent`, `useProposalPaymentEvents`
- Mutations: `useCreatePaymentIntent`, `useValidateManualPayment`, `useCreateComplementaryIntent`, `useGeneratePixCharge`, `useSyncErpStatus`
- Invalida `['proposal', id]`, `['proposal-dynamic-pricing', id]`, novas keys de pagamento.

---

## 3. Frontend

### Editor da proposta
**`ProposalDynamicPaymentPanel`** (em `ProposalEditor.tsx` e `ProposalEditorModal.tsx`, abaixo do `ProposalDynamicPricingPanel`):
- Cards: valor vigente, última cobrança (data, valor, status), valor pago, diferença pendente, status financeiro
- Ações: Gerar Pix vigente / Reemitir / Gerar cobrança complementar / Validar pagamento manual / Sincronizar ERP / Ver histórico
- Lista de eventos financeiros (timeline)

**`ManualPaymentValidationDialog`** — campos: valor pago, data, referência, observação → chama `validate_proposal_payment_amount`, exibe resultado (correto / parcial com diferença / acima).

### Link público (`ProposalPublicView.tsx`)
- Botão: **"Pagar valor vigente"** (substitui botão atual quando `dynamic_pricing_enabled`)
- Texto auxiliar: "O Pix será gerado com o valor vigente da condição comercial no momento da emissão da cobrança."
- Se `requires_requote`/`expired`: bloqueia pagamento e mostra "Esta condição comercial expirou. Solicite uma nova cotação."
- Ao clicar: chama `create_proposal_payment_intent` → mostra valor, validade, QR Code/copia-cola se houver, ou estado "Cobrança gerada. Aguardando integração financeira."

**`PublicProposalPaymentBlock`** — componente novo para o link público.

### PDF (`PdfDynamicPricingSection.tsx`)
Acrescentar cláusula:
> "O pagamento da proposta deve ser realizado exclusivamente pelo valor vigente no momento da emissão da cobrança. Pagamentos realizados manualmente com valor inferior ao vigente serão considerados parciais e poderão gerar cobrança complementar."

---

## 4. Integração com PRICE 1.0
- `expected_amount` sempre derivado de `calculate_proposal_dynamic_price` (não fixo).
- Snapshot do tier salvo no momento da intent (auditoria histórica).
- Validação manual recalcula com `p_paid_at` para usar tier vigente na data efetiva.
- Não altera comportamento existente do `ProposalDynamicPricingPanel`.

---

## 5. Detalhes técnicos
- **Triggers**: `update_updated_at_column` em ambas as tabelas; trigger em `proposal_payment_intents` para sincronizar `latest_payment_intent_id` e campos snapshot na `proposals`.
- **Índices**: `(proposal_id)`, `(organization_id, status)`, `(expires_at) WHERE status='pending'`.
- **Tipos Supabase**: regenerados automaticamente após migração.
- **Mock ERP**: `erpBillingBridgeService` retorna payload determinístico até integração real estar disponível; `payment_gateway_snapshot` armazena o payload bruto.

---

## 6. Critérios de aceite
- Tabelas `proposal_payment_intents` e `proposal_payment_events` criadas com RLS.
- Campos financeiros adicionados em `proposals`.
- Link público gera intent pelo valor vigente; bloqueia se requer recotação.
- Editor mostra painel financeiro com ações.
- Validação manual classifica `exact/partial/over` e calcula diferença.
- Cobrança complementar é gerada automaticamente para diferenças.
- Eventos financeiros registrados em todas as transições.
- Payload ERP/Pix preparado (mesmo via mock).
- PDF e link público com a nova cláusula.
- Typecheck e build passam; PRICE 1.0 intacto.

---

## Arquivos
**Criados**
- `supabase/migrations/<ts>_proposal_payment_intents.sql`
- `src/lib/proposals/proposalPayments.ts`
- `src/services/proposals/proposalPaymentsService.ts`
- `src/services/proposals/erpBillingBridgeService.ts`
- `src/hooks/proposals/useProposalPayments.ts`
- `src/components/proposals/ProposalDynamicPaymentPanel.tsx`
- `src/components/proposals/ManualPaymentValidationDialog.tsx`
- `src/components/proposals/PublicProposalPaymentBlock.tsx`

**Editados**
- `src/pages/ProposalEditor.tsx`
- `src/components/proposals/ProposalEditorModal.tsx`
- `src/pages/ProposalPublicView.tsx`
- `src/components/proposals/PdfDynamicPricingSection.tsx`
- `src/integrations/supabase/types.ts` (auto)

---
## Status: implementado
- Migração `proposal_payment_intents` + `proposal_payment_events` + campos em `proposals` aplicada.
- 4 RPCs criadas com `security definer` e `search_path = public`.
- Service, bridge ERP (mock), hooks e componentes (`ProposalDynamicPaymentPanel`, `ManualPaymentValidationDialog`, `PublicProposalPaymentBlock`) integrados ao `ProposalEditor`, `ProposalEditorModal` e `ProposalPublicView`.
- Cláusula PDF atualizada.
