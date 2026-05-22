## Diagnóstico

A causa raiz é **um único bug SQL** em `public.recalculate_proposal_pricing_ledger(p_proposal_id)`. Quando a faixa dinâmica atual (`is_current=true`) tem `starts_at IS NULL` (típico da primeira faixa "30 dias ou mais antes do evento"), o filtro:

```sql
WHERE starts_at <= v_reference_date
  AND (ends_at IS NULL OR ends_at > v_reference_date)
```

avalia `NULL <= …` como NULL, e nenhuma faixa é selecionada. Resultado: `dynamic_adjustment.amount = 0`, `base_amount = effective_amount = subtotal_items` no snapshot.

Como `pricing_breakdown_snapshot` é a Single Source of Truth do PRICE CORE 2.0, todos os blocos que leem do ledger mostram R$ 1.994,00:
- "Composição do valor" (editor)
- Header do link público (R$ 1.994,00)
- "Condições de Pagamento → Pagamento Avulso" no link público

Os blocos que leem **direto** de `proposal_dynamic_pricing_tiers` ou do cálculo live (cronograma do editor, Tabela de Preço Dinâmica, "Total Vigente Hoje", PDF) seguem corretos com R$ 1.794,60 — daí a inconsistência aparente.

Confirmação via DB para PROP-2026-00783:
- Tier atual: `starts_at=null`, `ends_at=2026-06-16`, `adjustment_value=-10`, `final_amount=1794.60`, `is_current=true`
- Snapshot atual: `base_amount=1994`, `dynamic.amount=0`, `effective_amount=1994`, `payment_schedule[0].amount=1994` com `due_date=2026-05-22` (também errado — deveria ser 16/06)

## O que vou fazer

### 1. Migration — corrigir `recalculate_proposal_pricing_ledger`
Trocar a cláusula que seleciona a faixa vigente para tolerar `starts_at` nulo:

```sql
WHERE proposal_id = p_proposal_id
  AND (starts_at IS NULL OR starts_at <= v_reference_date)
  AND (ends_at IS NULL OR ends_at > v_reference_date)
ORDER BY tier_order DESC
LIMIT 1;
```

Mantém o resto da função intacto. Sem alterar contrato/colunas/JSON do snapshot.

### 2. Backfill seguro
No mesmo migration, rodar `recalculate_proposal_pricing_ledger(id)` para todas as propostas:
- com `dynamic_pricing_enabled = true`
- não `cancelled`/`declined`
- não `price_frozen_on_approval = true` (congeladas mantêm snapshot da aprovação)
- que tenham alguma tier com `starts_at IS NULL`

Isso normaliza retroativamente todos os ledgers afetados sem mexer em propostas congeladas/ganhas.

### 3. Validação
- Reler snapshot de PROP-2026-00783 e confirmar: `base_amount=1994`, `dynamic.amount=-199.40`, `effective_amount=1794.60`, `payment_schedule[0].amount=1794.60`, `payment_schedule[0].due_date=2026-06-16` (vem de `first_installment_date`, que já está correto após o backfill — vou validar).
- Abrir link público e editor para confirmar que "Composição do valor", header e "Pagamento Avulso" agora batem em R$ 1.794,60.

## Fora de escopo
- Não alterar React/TS: a UI já está correta lendo do ledger; o bug é 100% backend.
- Não alterar lógica de propostas frozen/aprovadas — ledger delas não é recalculado.
- Não tocar em `ensure_proposal_pricing_ready` (o guard continua válido — só passa a ver o snapshot correto).

## Riscos
- **Baixo.** A mudança é uma única linha que adiciona tolerância a NULL; não muda o ordering nem o cálculo. Propostas sem faixa "starts_at NULL" continuam idênticas.
- Backfill é idempotente e exclui propostas congeladas.
