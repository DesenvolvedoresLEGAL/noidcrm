
# Plano — Congelamento real da proposta após aprovação

## Diagnóstico

Para a proposta `EVENTARE — 08/06/2026 15:39 UTC`:

- `approved_payment_schedule` está **corretamente congelado** no banco como `{"schedule":[{"due_date":"2026-06-03","amount":895.50}]}`, e `price_frozen_on_approval = true`.
- O problema **não é o freeze no banco** — é a **renderização**. O link público recalcula tudo em tempo real:
  1. `ProposalPublicView.tsx` (linha ~1044), `ProposalPaymentTerms.tsx` (linha 443) e `ProposalPreview.tsx` (linha 453) chamam `calculateInstallments(paymentTerm, …)` mesmo quando `status === 'accepted'`. Isso usa o `paymentTerm.first_installment_date` **atual** (editável), não o que foi congelado.
  2. `resolvePaymentDueDate.ts` (linha 67-72) procura `approved_payment_schedule.payment_schedule[0]`, mas o RPC `freeze_proposal_approval` grava em `approved_payment_schedule.schedule[0]` → o resolver nunca acha o congelado e cai para o `paymentTerm`.
  3. O banner "CONDIÇÃO COMERCIAL VIGENTE" (`PublicProposalDynamicPricingBanner`) é renderizado a partir do snapshot **vivo** de pricing dinâmico, não do `approval_snapshot` congelado — então qualquer alteração de tier/regra muda o que o cliente vê.

Resultado prático: se alguém editar o `payment_term`, mudar tier dinâmico, ou apenas o tempo passar (mudando o tier vigente), o cliente vê valores e datas diferentes do que aprovou — exatamente a queixa.

## Princípio

**Após `status='accepted'` (ou `approved`) com `price_frozen_on_approval = true`, o link público lê 100% do snapshot congelado e nunca recalcula.** Edições subsequentes em `proposal_payment_terms`, `proposal_items` ou tiers dinâmicos não afetam a visualização do link aprovado.

## Mudanças

### 1. `src/lib/proposals/resolvePaymentDueDate.ts`
Corrigir leitura do shape real do snapshot:
```ts
const sched: any = proposal?.approved_payment_schedule;
const list =
  Array.isArray(sched?.schedule) ? sched.schedule :         // shape atual (RPC)
  Array.isArray(sched?.payment_schedule) ? sched.payment_schedule :
  Array.isArray(sched) ? sched : null;
const first = list?.[0];
```
Aplicar no bloco "frozen on approval" (linhas 66-77) e no guard de `dynamicPricingEndForInstallments` (linha 147).

### 2. Renderização do cronograma — usar snapshot, não recalcular
Em **`ProposalPublicView.tsx`**, **`ProposalPaymentTerms.tsx`** e **`ProposalPreview.tsx`**, quando `proposal.status === 'accepted'` e existir `approved_payment_schedule.schedule`:
- **Não chamar** `calculateInstallments` — mapear diretamente os itens do schedule congelado para o tipo `Installment` (`due_date`, `amount`, `index`, `label`).
- Total do "Pagamento à vista / parcelado" = soma do schedule congelado (= `approved_amount`).
- Forma de pagamento exibida = `approval_snapshot.payment_method` (congelar também — ver item 4).

Helper novo: `src/lib/proposals/frozenSchedule.ts` com `readFrozenSchedule(proposal): Installment[] | null` para centralizar a leitura nos 3 pontos.

### 3. Banner "Condição comercial vigente" — virar "Condição comercial aprovada"
Em **`PublicProposalDynamicPricingBanner.tsx`**, quando `proposal.status === 'accepted'`:
- Renderizar a partir de `proposal.approval_snapshot` (já persistido pelo freeze), não do snapshot vivo.
- Mudar título para "**Condição comercial aprovada em DD/MM/AAAA**" e remover "Próxima atualização" / "Valor anterior expirado" — não fazem sentido pós-aceite.
- Mostrar: data de referência usada, valor base, ajuste aplicado (+50%), valor final aprovado.
- Texto da cláusula: "Estes valores foram congelados na aprovação. Qualquer ajuste depende de renegociação formal."

Em `ProposalPublicView.tsx`, ao chamar o banner, passar uma `variant="frozen"` quando aceito.

### 4. Garantir que `approval_snapshot` carregue tudo que a UI precisa
Verificar o conteúdo de `pricing_breakdown_snapshot` gravado em `approval_snapshot` pelo RPC `freeze_proposal_approval`. Hoje guarda `dynamic_adjustment.tier_*`, valor base e final. Confirmar presença de:
- `payment_method` (pix/boleto/etc.)
- `payment_condition` (upfront/installments)
- `reference_type` / `reference_date` da condição dinâmica

Se algum estiver faltando, **uma migration** ajusta o RPC para incluí-los na composição do snapshot (sem reescrever lógica de freeze — só enriquece o payload). Não há mudança em propostas já aprovadas; para a proposta atual reportada, usar os dados já existentes em `approval_snapshot` + fallback para `proposal.dynamic_pricing_*` somente para campos não-monetários (método de pagamento), apenas como compat. Backfill não é necessário porque `payment_method` ainda é estável no `payment_term` (não muda em edição comum), mas a fonte canônica passa a ser o snapshot.

### 5. Bloqueio defensivo no backend (paralelo, sem mudar UX)
Adicionar trigger `BEFORE UPDATE` em `proposal_payment_terms` que bloqueia qualquer UPDATE quando a `proposal` correspondente tem `price_frozen_on_approval = true` e o `status` é `accepted`. Exceções: campos de auditoria (`updated_at`). Isso impede regressões futuras onde algum fluxo edite termos pós-aceite. Mensagem: "Proposta aprovada e congelada — termos de pagamento não podem ser alterados."

### 6. Teste rápido
Atualizar `resolvePaymentDueDate.test.ts` com caso `approved_payment_schedule = {schedule: [...]}` e adicionar `frozenSchedule.test.ts` cobrindo:
- shape `{schedule:[]}` (atual)
- shape `{payment_schedule:[]}` (legado)
- shape array puro (legado mais antigo)
- ausência → null

## Arquivos impactados

- `src/lib/proposals/resolvePaymentDueDate.ts` — corrigir shape
- `src/lib/proposals/frozenSchedule.ts` — **novo** helper
- `src/components/proposals/PublicProposalDynamicPricingBanner.tsx` — modo "aprovado"
- `src/components/proposals/ProposalPaymentTerms.tsx` — usar schedule congelado se aceito
- `src/components/proposals/ProposalPreview.tsx` — idem
- `src/pages/ProposalPublicView.tsx` — idem + passar variant ao banner
- `src/lib/proposals/resolvePaymentDueDate.test.ts` + `frozenSchedule.test.ts`
- **Migration**: enriquecer `freeze_proposal_approval` para incluir `payment_method`/`payment_condition`/`reference_*` no `approval_snapshot`; trigger guard em `proposal_payment_terms`.

## Riscos

- **Propostas já aprovadas antes desta correção**: o `approved_payment_schedule.schedule` já existe (validei na do EVENTARE). O frozen schedule passa a ser respeitado — pode mudar o que está sendo exibido hoje para essas propostas (na prática, vai mostrar o que de fato foi congelado). É o comportamento correto e o que o cliente espera.
- A trigger guard pode bloquear edições legítimas de organizações que estavam usando "editar termo após aceite" como fluxo informal. Aceitável — é o objetivo.
- `PublicProposalApprovedScreen.tsx` já lê `approved_payment_schedule.schedule` corretamente; nenhuma mudança ali, só fica consistente com o resto.

## Validação

1. Reabrir o link público da proposta `3ee2e4fc-…` (EVENTARE): deve mostrar "Pagamento à vista 03/06/2026 — R$ 895,50" lendo do snapshot, com banner "Condição comercial aprovada em 08/06/2026" no topo.
2. Editar manualmente `proposal_payment_terms.first_installment_date` para outra data → recarregar link público → a data exibida **não pode** mudar.
3. Editar tier dinâmico → recarregar → valores no link aprovado **não podem** mudar.
4. Trigger SQL: tentar `UPDATE proposal_payment_terms SET first_installment_date='2026-01-01' WHERE proposal_id='3ee2e4fc-…'` → deve falhar com a mensagem do guard.
5. `npx vitest run resolvePaymentDueDate frozenSchedule` verde.

## Próximos passos (fora deste sprint)

- UI administrativa "Reabrir proposta para renegociação" que limpa `price_frozen_on_approval` (já existe via reset em `reopenProposal`), com auditoria explícita.
- Histórico de versões aprovadas (cada freeze gera uma `proposal_approval_revision` imutável) — útil quando houver renegociação repetida.
