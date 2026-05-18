## Objetivo

Duas correções pontuais na seção **Forma e Prazo de Pagamento → Avulso**, sem mexer em nenhuma outra parte do sistema:

1. **Nova condição comercial "Manual"** — usuário escolhe data + valor (ou %) de cada parcela manualmente (ex.: 50% hoje, 50% daqui 4 dias / 10 dias / pós-evento — qualquer combinação).
2. **Faixa pós-evento da tabela dinâmica** — quando **qualquer parcela** do cronograma vencer **após o início do evento**, o valor vigente passa a ser o da faixa **"Após o início do evento"**, mesmo que parte do pagamento seja antecipada.

Nada mais é alterado: presets atuais (À Vista, 50/50, 30/60/90, Faturado 35d, Parcelado), MRR, tabela dinâmica automática por validade, congelamento de aprovação — tudo permanece igual.

---

## 1) Condição "Manual"

### UI (`ProposalPaymentTerms.tsx`)

- Adicionar novo preset `manual` ao array `PAYMENT_PRESETS` (após "Parcelado"), label **"Manual"**.
- Ao selecionar:
  - `payment_condition = 'custom_schedule'` (valor já existente no enum)
  - Abre bloco "Cronograma Manual" com tabela editável:
    - Colunas: **Data de vencimento** (date picker) · **Tipo** (% do total ou valor R$) · **Valor / %** · ações (excluir / adicionar linha)
    - Botão "+ Adicionar parcela"
    - Validação: soma das % = 100 (ou soma R$ = total da proposta com desconto). Mostra alerta em vermelho se divergir.
- Reaproveita componentes shadcn já em uso (`Input`, `Button`, `Table`).
- Bloco "Cronograma de Pagamento" (preview) passa a renderizar as linhas manuais quando `payment_condition === 'custom_schedule'`.

### Persistência

Novo campo no `proposal_payment_terms`:

```sql
ALTER TABLE public.proposal_payment_terms
  ADD COLUMN manual_schedule jsonb;
-- formato: [{ "due_date":"2026-05-20", "percent":50 }, { "due_date":"2026-06-20", "amount":1196.40 }]
```

### Cálculo (`calculateInstallments` em `proposal-payment-terms.ts`)

- Novo branch: `if (condition === 'custom_schedule' && Array.isArray(term.manual_schedule))` → gera installments diretamente a partir do JSON, aplicando desconto sobre `discountedTotal`.
- Tipo `'installment'`, label `Parcela N`.
- Demais branches (`upfront`, `split_*`, parcelado legado) **não são tocados**.

---

## 2) Faixa pós-evento quando houver parcela após o evento

### Regra

Hoje a tabela dinâmica escolhe a faixa pela **data de referência única** (`current_date` / `payment_due_date` / `custom_date` / `approval_date`). Quando há cronograma com parte pós-evento, queremos que o valor vigente exibido (e usado em totalização) seja o da faixa **"Após o início do evento"** — porque o caixa só entra após a virada.

### Implementação (mínima, isolada)

Em `orchestrate_proposal_financials` (já é o ponto único que recalcula snapshot ao salvar termos):

1. Após carregar o `one_time_term`, calcular `v_max_due_date` = maior `due_date` entre:
   - `manual_schedule` (quando `payment_condition='custom_schedule'`),
   - `second_payment_due_date` (splits),
   - parcelas calculadas para `installments`.
2. Buscar `event_start_date` em `proposal_dynamic_pricing_rules` (já existe).
3. Se `v_max_due_date > event_start_date` **e** `dynamic_pricing_applicability='automatic'`:
   - Forçar `dynamic_pricing_reference_type = 'custom_date'` e `dynamic_pricing_reference_date = v_max_due_date` **apenas dentro do snapshot** (não sobrescreve o termo salvo pelo usuário).
   - A função `resolve_dynamic_pricing_reference_date` já existente resolve a faixa correta — a última (`Após o início do evento`) será selecionada naturalmente porque a data resolvida é > event_start.

Resultado: o card "Valor vigente" mostra R$ 2.991,00 (faixa +50%) e o cronograma usa esse valor como base.

### Indicador na UI

Pequeno badge no card de Tabela Dinâmica:
> "Faixa pós-evento aplicada — uma ou mais parcelas vencem após o início do evento."

Apenas leitura; não muda nenhuma outra lógica.

---

## Arquivos impactados

```text
src/components/proposals/ProposalPaymentTerms.tsx        (preset Manual + tabela de cronograma)
src/services/supabase/proposal-payment-terms.ts          (tipo + calculateInstallments custom_schedule)
supabase/migrations/<timestamp>_manual_schedule.sql      (coluna manual_schedule + ajuste orquestrador)
```

Nenhum outro arquivo é tocado. Presets existentes, MRR, splits, parcelado tradicional e tabela dinâmica automática por validade permanecem idênticos.

## Riscos

- **Baixo**: coluna nova é opcional (nullable); cálculo só entra no novo branch quando `manual_schedule` está populado.
- Orquestrador altera apenas o **snapshot** quando detecta parcela pós-evento — não persiste mudança no termo do usuário, evitando efeitos colaterais em propostas existentes.

## Próximos passos após aprovação

1. Migration `manual_schedule` + patch no `orchestrate_proposal_financials`.
2. Patch no service `calculateInstallments`.
3. UI do preset Manual com validação de soma.
4. Validar visualmente na proposta do print (50% 20/05 + 50% 20/06 → faixa +50%).