## Diagnóstico (confirmado com dados reais)

**Proposta:** `86b2387a-2145-4376-beb3-13a96c042733` (ONFLY – FORUM ECOMMERCE 2026).

**Estado no banco (`proposal_payment_terms`):**
- `payment_condition = upfront`
- `dynamic_pricing_reference_type = 'custom_date'`
- `dynamic_pricing_reference_date = 2026-08-07` ← data personalizada escolhida pelo vendedor
- `first_installment_date = 2026-07-20` ← lixo antigo (data em que o termo foi criado)

**Comportamento:**
- **Editor (Configurar formas de pagamento):** mostra vencimento **07/08/2026** ✅
- **Link público / cliente:** mostra vencimento **20/07/2026** ❌

## Causa raiz

O helper `calculateInstallments` em `src/services/supabase/proposal-payment-terms.ts` decide o vencimento do "Pagamento à vista" nesta ordem:

1. `customAnchor` (data personalizada da tabela dinâmica) — **somente se `!isFrozen`**
2. `dynEnd` (fim do tier vigente) — **somente se `!isFrozen`**
3. `first_installment_date` (fallback)

Onde `isFrozen = options.approvedAmount != null`.

- No **editor** (`ProposalPaymentTerms.tsx`, linha 443) o helper é chamado **sem `approvedAmount`** → `isFrozen=false` → cai no `customAnchor` → 07/08. ✅
- No **link público** (`ProposalPublicView.tsx`, linha 1066) o helper é chamado com `approvedAmount: ledgerOneTimeNet` para **propostas ainda não aceitas** (para não reaplicar desconto sobre a base já líquida do ledger). Isso ativa `isFrozen=true` mesmo em proposta `sent`, então o helper **ignora** `customAnchor` e `dynEnd` e cai no `first_installment_date = 2026-07-20`. ❌

O sinal "base já líquida do ledger" está sendo confundido com "cronograma congelado por aceite". São coisas diferentes.

## Correção (definitiva, mínima e segura)

Separar os dois conceitos no `calculateInstallments`:

- **Base já líquida (não reaplicar desconto):** continua sinalizada por `approvedAmount != null`.
- **Cronograma congelado (ignora âncora personalizada e tier vigente):** passa a exigir sinal explícito — proposta `accepted` + `approved_payment_schedule` presente.

### Passos

1. **`src/services/supabase/proposal-payment-terms.ts`** — em `calculateInstallments`, no ramo `isUpfront`:
   - Adicionar opção nova `frozenSchedule?: boolean` (ou reaproveitar um sinal já existente: `options.isAccepted`).
   - Trocar `const isFrozen = options?.approvedAmount != null` por `const isFrozen = options?.frozenSchedule === true`.
   - Assim, `approvedAmount` continua servindo apenas para evitar reaplicar `discount_percent` sobre a base já líquida (linhas 175-179), mas **não bloqueia mais** `customAnchor`/`dynEnd`.

2. **`src/pages/ProposalPublicView.tsx`** (duas chamadas — cronograma da tela pública em linha 1066 e PDF em linha 322):
   - Passar `frozenSchedule: proposal?.status === 'accepted' && !!proposal?.approved_payment_schedule`.
   - Manter `approvedAmount: ledgerOneTimeNet` (não aceito) / `approved_amount` (aceito) como está.

3. **`src/components/proposals/ProposalPreview.tsx`** e **`src/components/proposals/ProposalPaymentTerms.tsx`**: sem mudança — já não passam `approvedAmount` em rascunho. Só passar `frozenSchedule: true` quando `status === 'accepted'` (para preservar comportamento pós-aceite; o `readFrozenSchedule` já roda antes disso mesmo, então é só cinto-e-suspensório).

4. **Testes:** adicionar caso em `src/lib/proposals/resolvePaymentDueDate.test.ts` **não** cobre esse ponto (esse helper é diferente). Adicionar teste dedicado a `calculateInstallments` cobrindo:
   - proposta `sent` + `custom_date` + `approvedAmount` (ledger) → vencimento = data personalizada.
   - proposta `sent` + tabela dinâmica sem custom_date + `approvedAmount` → vencimento = `current_ends_at`.
   - proposta `accepted` + `frozenSchedule=true` → mantém `first_installment_date` congelado.

5. **Higienização opcional (fora deste fix):** o valor `first_installment_date = 2026-07-20` em DB é resíduo. Não precisa alterar dado — a correção acima já faz a UI ignorar esse campo enquanto houver âncora personalizada ou tier vigente. Nenhuma migração é necessária.

## Escopo

- Somente frontend/UI (regra de cálculo do vencimento exibido).
- Nenhuma alteração de RLS, schema, RPC ou dados existentes.
- Zero efeito em propostas já aceitas (o freeze via `approved_payment_schedule` continua tendo prioridade máxima em `readFrozenSchedule`).

## Riscos

- **Baixo.** A única mudança de comportamento visível é: propostas **não aceitas** com "Data personalizada" ou tabela dinâmica ativa passam a exibir no link público o mesmo vencimento que o editor já mostra hoje — que é justamente o comportamento contratado.
- Propostas aceitas continuam intocadas (frozen schedule tem prioridade absoluta).

## Validação pós-fix

1. Abrir o link público da proposta ONFLY e conferir "Pagamento à vista **07/08/2026**".
2. Baixar o PDF e conferir a mesma data.
3. Editor continua mostrando 07/08 (sem regressão).
4. Simular uma proposta aceita antiga e conferir que o vencimento congelado não muda.