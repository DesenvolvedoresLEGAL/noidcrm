# Fix — Quick View e PDF mostram valor errado após recalcular tabela dinâmica

## Causa raiz

`apply_dynamic_price_to_proposal` (botão "Recalcular e sincronizar agora") grava corretamente o valor R$ 1.477,50 (referência custom_date 17/06, pós-evento +50%) em `proposals.dynamic_pricing_snapshot`/`dynamic_pricing_current_amount`/`payment_expected_amount`.

Porém, `orchestrate_proposal_financials` (chamada em todo "Salvar proposta" e via trigger de `proposal_items`) imediatamente sobrescreve o snapshot:

```
-- linha 158 do migration 20260508232217
v_snapshot := public.calculate_proposal_dynamic_price(p_proposal_id, now());
...
-- linhas 167-175
UPDATE proposals SET
   dynamic_pricing_snapshot = v_snapshot,
   dynamic_pricing_current_amount = v_current_amount,
   payment_expected_amount = v_current_amount
```

`now()` é forçado em vez do `reference_at` resolvido, então o snapshot volta para a faixa "vigente hoje" (R$ 1.280,50, +30%). A view pública e o PDF leem tudo de `dynamic_pricing_snapshot.current_amount` (linhas 1030-1036 de `ProposalPublicView.tsx`), por isso exibem o valor antigo no header, no bloco "Condição Comercial Vigente" e nas Condições de Pagamento.

## O que vai ser feito

### 1. Migration `fix_orchestrator_dynamic_pricing_reference`

Recriar `orchestrate_proposal_financials`:

- **Resolver referência via helper**: chamar `resolve_dynamic_pricing_reference_date(p_proposal_id)` em vez de hard-coded `now()`.
- **Calcular com a referência correta**: `calculate_proposal_dynamic_price(p_proposal_id, v_ref_at)`.
- **Persistir referência junto com snapshot**: incluir `dynamic_pricing_reference_type = v_ref_type` e `dynamic_pricing_reference_date = v_ref_at` no UPDATE, e mergir essas chaves dentro do JSON `dynamic_pricing_snapshot` (igual ao apply faz).
- **Respeitar freeze**: se `price_frozen_on_approval = true`, pular o bloco que sobrescreve `dynamic_pricing_snapshot`/`current_amount`/`payment_expected_amount` (mantém o valor congelado).
- **Não regenerar tiers desnecessariamente**: manter `generate_event_antecedence_pricing_for_proposal(..., true)` apenas quando os tiers ainda não existem ou houve mudança real de validade — não destruir tiers já gerados (mantém comportamento atual de `can_auto_generate_dynamic_pricing`).

### 2. Validar consumo no front

Sem mudanças necessárias: `ProposalPublicView` (header, bloco "Condição Comercial Vigente", "Condições de Pagamento", instalments) e `proposalPdfGenerator` já leem `dynamic_pricing_snapshot.current_amount` / `current_ends_at`. Uma vez que o snapshot deixar de ser sobrescrito, ambas surfaces refletem o valor correto.

### 3. Aceite

- Definir referência custom_date 17/06 → clicar "Recalcular e sincronizar agora" → `current_amount = R$ 1.477,50` no editor.
- Salvar a proposta novamente → snapshot continua R$ 1.477,50 (orquestrador respeita referência).
- Abrir Visualização Rápida → header, "Condição Comercial Vigente" e "Condições de Pagamento" mostram R$ 1.477,50 e indicam que a precificação foi calculada por data personalizada (17/06).
- PDF: mesmo valor + cláusula de referência personalizada (já implementada na 1.0.4).
- Proposta `upfront` sem reference_type override continua funcionando como hoje (resolve_helper devolve `current_date` → `now()`).
- Proposta `split_50_50 + freeze` aprovada: orquestrador não sobrescreve snapshot.

## Arquivos

- `supabase/migrations/<nova migration>.sql` — recria `orchestrate_proposal_financials`.

## Riscos

- A função é chamada por triggers em `proposal_items` e por `Save Items → Save Payment → Totals`. Manter mesma assinatura `(uuid, text)` e mesmo retorno JSONB. Apenas a lógica interna muda.
- `can_auto_generate_dynamic_pricing` continua governando regeneração de tiers; sem alteração nesse caminho.
