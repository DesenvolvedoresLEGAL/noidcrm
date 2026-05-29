## Objetivo

Corrigir o cálculo de elegibilidade do OTE para ser **item a item** (respeitando a flag "Contabiliza na meta" de produto/serviço), limpar a tabela "Vendas no período" e propagar para o Excel.

Não mexer em `commercial_won_revenue_view`, Vendas Realizadas, nem refatorar o módulo.

## Diagnóstico

- A lógica por item **já existe** em `supabase/functions/calculate-ote/index.ts` (linhas 253–419), mas:
  - O fallback ainda eleva o comercial inteiro a elegível quando `rawItems.length === 0`, sem sinalizar como legado.
  - Falta log/telemetria por venda para auditar por que Wagner (mai/26) está com `eligible == commercial` apesar de itens como Fast Delivery (Motoboy) terem `products.counts_for_commission = false`.
- A tabela do drilldown tem colunas duplicadas e ruidosas: "Fora da meta", "Conta p/ meta?" aparece **duas vezes** (col 211 e 288–298 — bug), "Confiança", e badge "Sim · R$ X" redundante.
- `oteEligibility.ts` mantém fallback que vira `eligible = sale` quando não há split persistido, escondendo o problema.

## Mudanças

### 1. Backend — `supabase/functions/calculate-ote/index.ts`

- Manter a estrutura atual (per-item via `proposal_items` + `products.counts_for_commission`), mas:
  - Adicionar `console.log` por oportunidade com: `opportunity_id`, `proposalId`, `items.length`, `eligibleItemsSum`, `commercial`, lista resumida `{product_id, name, itemFlag, productFlag, line_amount}`. Crítico para diagnosticar por que vendas continuam 100% elegíveis.
  - Quando `rawItems.length === 0` e `proposalId != null`, marcar `exclusionReason = 'Itens da proposta não disponíveis — usando fallback legado'` e gravar `revenue_confidence = 'legacy_fallback'` em `ote_sales_records` para sinalizar.
  - Quando `proposalId == null` (sem proposta aceita), idem fallback legado documentado.
  - Persistir `eligible_amount`, `non_eligible_amount`, `counts_toward_goal = eligible > 0`, `exclusion_reason` em `ote_sales_records`; persistir `ote_sales_record_items` com `counts_toward_goal` e `exclusion_reason` por item.

### 2. Helper — `src/components/ote/oteEligibility.ts`

- Remover o fallback `if (r.counts_toward_goal && !r.exclusion_reason) return { eligible: sale, nonEligible: 0 }`.
- Regra nova: **sempre** confiar no que o backend gravou (`eligible_amount`/`non_eligible_amount`). Se ambos forem 0 e `sale_value > 0`, retornar `{ eligible: 0, nonEligible: sale }` (força recálculo pelo botão "Calcular"). Mantém `aggregateEligible` igual.

### 3. UI — `src/components/ote/OTESellerSalesDrilldown.tsx`

- Remover colunas: **Fora da meta**, **Conta p/ meta?** (duas ocorrências — uma é bug duplicado), **Confiança**, badge final "Sim · R$ X".
- Tabela final fica: `▸ | Cliente / Oportunidade | Pipeline | Fechado em | Valor comercial | Elegível p/ meta | Tipo | Ações`.
- Quando `eligible < sale_value`, exibir "Elegível p/ meta" em destaque sutil (ex: `text-amber-600` ou `font-medium`) — discreto, sem badge.
- Linha expansível continua mostrando `ItemsTable` (já tem coluna "Conta p/ meta?" por item) + `exclusion_reason` no topo.
- Atualizar `colSpan` da linha expansível para o novo número de colunas.
- Header de totais: manter "Receita (SSoT)", "Elegível para meta", "Fora da meta" (resumo agregado é OK; o ruim era na tabela).

### 4. Cards — `src/components/ote/OTESellerDetailTab.tsx`

- Nenhuma mudança estrutural — já usa `eligibleTotal` para "Elegível p/ meta" e mostra "Receita total (SSoT)" / "Fora da meta" no bloco tracejado. Sem alterações.

### 5. Excel — `src/components/ote/export/buildOTEWorkbook.ts`

Garantir 3 abas conforme spec:
- **Resumo**: Vendedor, Meta, Valor total vendido (SSoT), Valor elegível, Valor fora, % Meta, Multiplicador, Variável base, Variável final.
- **Vendas**: Cliente/Oportunidade, Proposta, Pipeline, Fechado em, Valor comercial, Valor elegível, Valor fora, Tipo, Status final, Motivo geral.
- **Itens da venda**: Cliente/Oportunidade, Proposta, Produto/Serviço, Valor do item, Contabiliza na meta?, Valor elegível do item, Motivo de exclusão.

### 6. Validação

- `npx tsc --noEmit` deve passar limpo.
- Após deploy, usuário clica em **Calcular** para mai/2026 → Wagner deve mostrar `eligible < commercial` se houver itens não-elegíveis nas propostas.
- Logs da edge function devem revelar caso a caso os itens encontrados (debug-friendly).

## Arquivos impactados

- `supabase/functions/calculate-ote/index.ts` (logs + sinalização de fallback legado)
- `src/components/ote/oteEligibility.ts` (remover fallback otimista)
- `src/components/ote/OTESellerSalesDrilldown.tsx` (limpeza de colunas)
- `src/components/ote/export/buildOTEWorkbook.ts` (3 abas conforme spec)

## Riscos

- Remover fallback otimista do helper pode fazer registros legados (calculados antes da migração de splits) aparecerem como `0` elegível até o usuário rodar "Calcular". Mitigação: cards já têm botão "Calcular" visível.
- Mudança de colunas pode quebrar layout responsivo — testar no viewport 1412×853 atual.

## Fora de escopo

- Vendas Realizadas, `commercial_won_revenue_view`, refactor de hooks, redesign visual.