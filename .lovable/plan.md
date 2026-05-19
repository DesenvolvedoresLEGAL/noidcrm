## Objetivo
Garantir que qualquer envio para ERP/API/fatura use sempre o valor aprovado vigente da proposta (`R$ 1.686,10` no caso CONNECT FUN), nunca o total bruto/base dos itens (`R$ 1.297,00`).

## Diagnóstico
- A proposta aceita correta está gravada com:
  - `approved_amount = 1686.10`
  - `payment_expected_amount = 1686.10`
  - `dynamic_pricing_current_amount = 1686.10`
  - `total_amount = 1297.00` (base dos itens, legado)
- O envio direto `notify-deal-won` já tem proteção parcial: manda campos de topo com valor líquido e escala os produtos.
- A API `api-deals`, usada por integrações/ERP para buscar deals, ainda retorna `products[].total_price` com o valor bruto dos itens e não inclui `approved_amount` / `amount_source`. Se o ERP soma produtos ou lê campo legado, ele recebe `1297`.

## Plano de correção segura
1. **Unificar o resolvedor de valor aprovado na API de deals**
   - Importar e usar `resolveApprovedProposalAmount` em `supabase/functions/api-deals/index.ts`.
   - Incluir no select da proposta os campos necessários: `approved_amount`, `dynamic_pricing_enabled`, `dynamic_pricing_status`, `dynamic_pricing_snapshot`.
   - Prioridade final: `approved_amount` → `payment_expected_amount` → dinâmica vigente → `total_amount` → `value`.

2. **Blindar todos os campos monetários enviados ao ERP**
   - Em `api-deals`, preencher os campos principais com o valor líquido aprovado:
     - `amount`
     - `net_total`
     - `final_amount`
     - `valor_liquido`
     - `total_with_discount`
     - `total_negotiated`
     - `contract_total`
   - Adicionar metadados claros:
     - `approved_amount`
     - `amount_source`
     - `base_amount`
     - `dynamic_pricing_*`

3. **Corrigir o array de produtos para não induzir o ERP ao erro**
   - Escalar `products[].total_price` para que a soma dos produtos bata exatamente com o valor aprovado líquido.
   - Preservar auditoria com `original_total_price` e `net_total_price`, sem alterar `unit_price`/`quantity`.
   - Esse padrão já existe no `notify-deal-won`; vou replicar na `api-deals` para consistência.

4. **Corrigir o contrato/fatura/termos quando campo legado vier zerado**
   - Ajustar `contract_total` dentro de `payment_terms` para cair no valor líquido aprovado quando o termo estiver `0`/nulo.
   - Evita ERP ler `contract_total = 0` ou voltar para item bruto.

5. **Criar uma proteção no banco para propostas aceitas**
   - Migration pequena para reforçar a função `orchestrate_proposal_financials`: proposta aceita mantém `approved_amount` realinhado ao valor comercial canônico.
   - Backfill específico para propostas aceitas/dinâmicas garantindo `approved_amount`, `payment_expected_amount` e `opportunities.valor_previsto` consistentes.
   - Sem mexer em RLS, sem abrir dados entre organizações.

6. **Validar antes de concluir**
   - Reconsultar a proposta CONNECT FUN e confirmar valor aprovado `1686.10`.
   - Testar/inspecionar payload da `api-deals` para confirmar:
     - `amount = 1686.10`
     - `products[].total_price` somando `1686.10`
     - nenhum campo monetário principal retornando `1297` como valor final.

## Arquivos impactados
- `supabase/functions/api-deals/index.ts`
- Nova migration em `supabase/migrations/...sql`

## Riscos
- Baixo risco: a mudança é localizada na saída de integração e em função financeira já existente.
- Não altera RLS, autenticação, UI de propostas nem criação de itens.
- A única mudança comportamental intencional é impedir que integrações usem o valor bruto/base como valor final aprovado.