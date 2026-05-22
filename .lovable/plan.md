## Problemas identificados

### 1. OTE mostra valores em R$ para vendedores com meta de leads qualificados
No print, **Ana Paula (Hunter)** e **Bruno (Scout)** têm `goal_type = 'leads'`, mas a UI exibe a meta como "R$ 50,00 / Vendas R$ 9,00" — deveria ser "50 leads / 9 leads".

Pontos onde o currency aparece indevidamente quando `goal_type === 'leads'`:

- `src/components/ote/OTESellerDetailTab.tsx`
  - Bloco "Vendas e Meta" → `formatCurrency(result.goal_amount)` e `formatCurrency(result.total_sales)` (linhas 133 e 137).
  - Header colapsado: "Variável Final R$ 0,00" deve **permanecer em R$** (é comissão paga), mas o subtítulo "Variável Base" / "Ajuste Final" / "Variável Final" continuam em R$ pois são valores monetários reais — manter.
- `src/components/ote/OTEOverviewTab.tsx` — verificar e ajustar os cards/listas que mostram "Meta" e "Total de Vendas" usando currency.
- `src/components/ote/export/buildOTEWorkbook.ts` — colunas "Meta" e "Vendas" no Excel também devem ser formatadas como inteiros + "leads" (ou número puro com header "Leads qualificados") quando `goal_type='leads'`.

Regra: usar um helper `formatGoalValue(value, goalType)` que retorna `"X leads"` quando `goalType === 'leads'` e `formatCurrency(value)` quando `'revenue'`. Já existe padrão equivalente em `RepKPICards.tsx` / `RepPACECard.tsx` — reaproveitar a mesma convenção.

### 2. Roleplay sempre exibe `- 0%` (não puxa nada)
Bug no edge function `supabase/functions/calculate-ote/index.ts` (linha ~315):

```ts
const { data: roleplaySessions } = await supabase
  .from('roleplay_sessions')
  .select('score_overall, passed')
  .eq('seller_id', config.user_id)
  .gte('started_at', startDate)
  .lte('started_at', endDate)
  .eq('status', 'completed');   // ❌ coluna 'status' não existe em roleplay_sessions
```

A tabela `roleplay_sessions` **não tem coluna `status`** (confirmado via information_schema). PostgREST rejeita o filtro e devolve array vazio → `roleplayScore` sempre `null` e `roleplay_accelerator = 0`.

Existem dados reais (ex.: 39 sessões para um seller com média 6.65 em maio/26), portanto basta corrigir o filtro.

Correção:
- Trocar `.eq('status', 'completed')` por `.not('finished_at', 'is', null)` (sessão concluída).
- Adicional: filtrar por `organization_id = organizationId` (segurança multi-tenant).
- Considerar somente sessões com `score_overall IS NOT NULL` para a média.

### 3. Amarrar média de roleplay à UI/Excel
Após o fix acima:
- `OTESellerDetailTab.tsx` já lê `result.roleplay_score` — vai passar a popular.
- Verificar `buildOTEWorkbook.ts` para garantir que a aba "Performance" exibe `roleplay_score`, contagem de treinos e `roleplay_accelerator` por vendedor (transparência).

## Plano de execução

1. **Edge function `calculate-ote`** — corrigir o query de `roleplay_sessions`:
   - Remover `.eq('status', 'completed')`.
   - Adicionar `.not('finished_at', 'is', null)` e `.eq('organization_id', organizationId)`.
   - Logar `roleplaySessions.length` e `avgScore` para auditoria.

2. **Helper de formatação por tipo de meta** — criar `src/components/ote/lib/formatGoal.ts` exportando `formatGoalValue(value, goalType)` e `formatGoalUnit(goalType)`. Reutilizado em todos os componentes OTE.

3. **`OTESellerDetailTab.tsx`**:
   - Substituir `formatCurrency(goal_amount)` e `formatCurrency(total_sales)` por `formatGoalValue(..., result.goal_type)`.
   - Trocar label "Vendas" por "Leads qualificados" quando `goal_type='leads'`.
   - Manter Variável Base / Ajuste Final / Variável Final em R$.

4. **`OTEOverviewTab.tsx`** — mesmo tratamento: meta agregada deve diferenciar revenue vs leads (ou separar em duas colunas/cards quando o time é misto).

5. **`buildOTEWorkbook.ts`** — nas abas "Closers", "Pré-vendas" e "Resumo":
   - Header dinâmico ("Meta (R$)" vs "Meta (leads)").
   - Não somar valores de revenue e leads no mesmo total.
   - Aba "Performance" deve mostrar `Roleplay (média)`, `Nº treinos`, `Acelerador roleplay %`.

6. **Deploy** do edge function e instrução: o usuário precisa clicar em **Calcular** novamente em OTE para repopular `roleplay_score`.

## Riscos
- A correção do filtro pode trazer scores que antes eram `null` → aceleradores podem mudar o `final_variable_amount`. Esperado e desejado (essa é a regra de negócio).
- Excel precisa preservar fórmulas existentes que esperam coluna numérica em R$; ao mudar para "leads" como texto, ajustar somatórios para não quebrar.

## Out of scope
- Não mexer em regras de acelerador/desacelerador.
- Não mexer no fluxo de aprovação/pagamento de comissão.
- Não criar nova fonte de roleplay (continua `roleplay_sessions.score_overall`).