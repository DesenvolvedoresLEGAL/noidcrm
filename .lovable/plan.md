
## Diagnóstico

### 1. "Onde seleciono à vista / 50+50 / parcelado / Pix / Boleto?"
Existe sim — está dentro do editor da proposta, na aba **Pagamento → Avulso**. Lá o componente `ProposalPaymentTerms` mostra:

- Linha de chips de **forma de pagamento**: Pix · Boleto · Cartão · Transferência
- Linha de chips de **Condição**: À Vista · 50% + 50% · 30/60/90 · Parcelado

O problema é puramente de UX: hoje os chips aparecem só depois da tabela de itens, sem rótulo de seção forte ("Forma de pagamento", "Como o cliente vai pagar?"), por isso parecem invisíveis. Além disso, o orquestrador da PRICE 1.0.3 cria o `payment_term` default com `payment_method='pix'` e condição `upfront` automaticamente — então o link público mostra "PIX" mesmo sem o usuário ter clicado em nada.

### 2. Bug do vencimento "Pagamento à vista 08/05"
Em `calculateInstallments` (`src/services/supabase/proposal-payment-terms.ts`, linha 154), a data do à vista é:

```
dueDate = term.first_installment_date || term.entry_date || hoje
```

`first_installment_date` é o campo manual "Início". Quando o orquestrador cria o term default, ele preenche `first_installment_date = hoje` (08/05) — por isso o PDF/Link mostra 08/05 em vez de 11/05/2026 (validade da faixa vigente da tabela dinâmica).

Comportamento correto pedido pelo usuário: quando a tabela dinâmica automática está ativa **e** a condição é à vista, o vencimento deve ser **a data-limite da faixa vigente** (`dynamic_pricing_snapshot.current_ends_at`), não a data manual "Início".

### 3. "Não selecionei Pix nem Boleto"
O badge PIX no link aparece porque o orquestrador define silenciosamente. Precisa ficar visualmente claro que o método foi escolhido (e, idealmente, exigir confirmação explícita ou pelo menos rotular como "Padrão da organização" para não parecer um bug).

---

## Plano de execução

### A. UX da seção Pagamento (`ProposalPaymentTerms.tsx`)

Reescrever só o cabeçalho da aba Avulso para ficar óbvio:

```text
┌─ Como o cliente vai pagar? ──────────────────────────────┐
│  Forma de pagamento  [Pix*] [Boleto] [Cartão] [Transf.]  │
│  Condição comercial  [À Vista*] [50% + 50%] [30/60/90]   │
│                      [Parcelado]                         │
└──────────────────────────────────────────────────────────┘
```

- Trocar o `Label` "Condição" minúsculo por um título de seção destacado.
- Adicionar pequeno texto de ajuda: "Selecione a forma e a condição. O cronograma é gerado automaticamente."
- Marcar visualmente o chip ativo com checkmark ✓ e um sutil "Padrão" em cinza quando nenhum clique manual aconteceu ainda (`auto_selected = true`).
- Manter exatamente os mesmos handlers (`updateOneTime`, `handlePresetSelect`) — sem mudança de lógica.

### B. Vencimento do à vista atrelado à tabela dinâmica

Em `calculateInstallments` (e na assinatura de `CalculateInstallmentsOptions`):

1. Aceitar novo campo opcional `dynamicPricingCurrentEndsAt?: string | null`.
2. No ramo `isUpfront`, quando `dynamicPricingCurrentEndsAt` existir, usar:
   ```ts
   dueDate = dynamicPricingCurrentEndsAt.slice(0, 10)
   ```
   em vez de `term.first_installment_date`. Continuar caindo para o fluxo atual quando a tabela dinâmica não estiver ativa.

3. Atualizar os 3 chamadores que precisam passar a snapshot:
   - `ProposalPreview.tsx` (preview interna) — já carrega `dynamic_pricing_snapshot`.
   - `ProposalPublicView.tsx` (link público) — idem.
   - `proposalPdfGenerator.ts` / `proposalPdfBuilder.ts` (PDF) — já recebem `dynamic_pricing_snapshot`.

4. Para o caso `split_50_50` mantemos o que já existe (`after_valid_until` já usa `proposalExpiresAt`). Nenhuma mudança lá.

### C. Rótulo claro do método de pagamento no link e PDF

- No card "Condições de Pagamento" da preview/link/PDF, quando o termo veio do default do orquestrador (`payment_method='pix'` sem alteração manual), mostrar o badge como **PIX (padrão)**. Hoje só mostra "PIX", o que confunde.
- Para detectar "alteração manual", basta um campo `payment_method_source: 'auto' | 'user'` em memória no editor — ao clicar em qualquer chip, vira `'user'` e o "(padrão)" some. Não precisa ir para o banco; serve só de hint visual no editor enquanto a proposta está em rascunho.

### D. Sem mudanças em banco

Tudo o que precisamos já existe:
- `proposal_payment_terms.payment_method` ✓
- `proposal_payment_terms.payment_condition` ✓
- `proposals.dynamic_pricing_snapshot` (com `current_ends_at`) ✓

Nenhuma migration nova.

---

## Arquivos impactados

- `src/components/proposals/ProposalPaymentTerms.tsx` — reorganizar cabeçalho da aba Avulso (rótulos, hint, marca "padrão").
- `src/services/supabase/proposal-payment-terms.ts` — `CalculateInstallmentsOptions.dynamicPricingCurrentEndsAt` + uso no ramo upfront.
- `src/components/proposals/ProposalPreview.tsx` — passar `current_ends_at` para `calculateInstallments`.
- `src/pages/ProposalPublicView.tsx` — idem.
- `src/lib/proposalPdfBuilder.ts` / `src/lib/proposalPdfGenerator.ts` — idem.

---

## Riscos

- Mudar a `dueDate` do à vista pode alterar a data exibida em propostas já aprovadas. Mitigação: só sobrescrever quando `approval_snapshot` **não** existir ainda. Se já existe snapshot, manter o que foi congelado.
- Nada toca `payment_intents` nem RLS nem fluxo de cobrança real.

## Critério de aceite

- Editor: a aba Pagamento → Avulso deixa óbvio onde escolher Pix/Boleto e À vista/50+50/Parcelado.
- Link público e PDF: condição "Pagamento à vista" mostra **vencimento = 11/05/2026 20:59** (data-limite da faixa vigente), não 08/05.
- Badge da forma de pagamento mostra "(padrão)" enquanto o usuário não clicou; some após clique.
- Propostas já aprovadas continuam com a data congelada do `approval_snapshot`.
- Typecheck e build passam.
