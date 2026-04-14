

# Win Rate Unificado — Fonte Única da Verdade

## Diagnóstico

Três telas mostram Win Rates diferentes porque cada uma usa filtros e períodos diferentes:

| Tela | Pipeline | Período | Resultado |
|------|----------|---------|-----------|
| Dashboard CEO (43%) | `pipeline_type = 'sales'` | Ano, via `updated_at` | Quase correto, mas usa `updated_at` em vez de `closed_at` |
| Forecast (52%) | `is_primary = true` | Mês atual | Pipeline correto, mas período menor = amostra enviesada |
| Win/Loss Hub (36%) | **TODOS os pipelines** | Ano | Inclui qualification, onboarding, CS — dilui o resultado |

## Regra Única

Win Rate = `won / (won + lost)` calculado exclusivamente:
- **Pipelines**: apenas `pipeline_type = 'sales'`
- **Data**: `closed_at` como fonte de verdade (fallback `updated_at`)
- **Excluir**: soft-deleted (`deleted_at IS NOT NULL`)
- **Período**: respeitado pelo filtro da tela (mês, trimestre, ano, etc.)

A fórmula é a mesma em TODAS as telas. O que muda é apenas o período selecionado pelo usuário.

## Correções

### 1. `src/hooks/useWinLossData.ts`
- Quando nenhum pipeline específico é selecionado, filtrar apenas `pipeline_type IN ('sales')` em vez de buscar TODOS os pipelines da org
- Garantir uso de `closed_at` para filtragem de data (já faz isso parcialmente)
- Excluir soft-deleted

### 2. `src/pages/gtm/CEODashboard.tsx`
- Substituir `.gte('updated_at', ...)` por lógica baseada em `closed_at` (com fallback `updated_at`) para won e lost counts
- Já filtra corretamente por `pipeline_type = 'sales'`

### 3. `src/hooks/useForecastData.ts`
- Forecast usa `is_primary = true` que normalmente é o pipeline de vendas — manter assim (pipeline primário é vendas)
- Win Rate do forecast já usa `closed_at` com fallback — OK
- Nenhuma mudança necessária (pipeline primário = vendas por definição)

### 4. Memória do projeto
- Salvar regra: Win Rate sempre filtra `pipeline_type = 'sales'`, usa `closed_at`, exclui soft-deleted

## Resultado Esperado

Todas as telas mostrarão o mesmo Win Rate para o mesmo período, divergindo apenas quando o período selecionado é diferente (mês vs ano).

