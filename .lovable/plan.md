
# Corrigir Contabilização de Leads Qualificados em Todos os Relatórios e Dashboards

## Problema
Vendedores de pré-vendas (goal_type = 'leads') não têm seus leads qualificados contabilizados corretamente. Os leads qualificados são oportunidades ganhas (status = 'won') em pipelines do tipo 'qualification'. Atualmente, três locais críticos calculam errado:

1. **`calculate-ote` (Edge Function)** — soma valor monetário (`commission_value`/`valor_previsto`) para TODOS os vendedores, inclusive os de leads. Para leads, deveria contar o **número** de oportunidades ganhas, não somar valores. Além disso, não filtra por `pipeline_type`, então pode contar oportunidades de pipelines errados.

2. **`usePACEData.ts` (Manager PACE)** — não diferencia por `goal_type`. Sempre soma receita. Para SDRs com meta de leads, deveria contar oportunidades ganhas em pipelines de qualificação.

3. **`useRepPACE.ts` (Rep PACE)** — este JÁ está correto. Já filtra por `pipeline_type` e conta leads quando `goalType === 'leads'`.

## Alterações

### 1. `supabase/functions/calculate-ote/index.ts`
**Problema**: Linha 221 sempre soma valor monetário. Linhas 204-218 não filtram por pipeline_type.

**Correção**:
- Após determinar `goalType` (linha 229), recalcular `totalSales`:
  - Se `goalType === 'leads'`: buscar pipelines com `pipeline_type = 'qualification'` da organização, filtrar oportunidades apenas desses pipelines, e usar `opportunities.length` (contagem) ao invés de soma de valores
  - Se `goalType === 'revenue'`: manter lógica atual (soma de `commission_value`/`valor_previsto`) filtrado por pipelines de vendas
- Mover a query de oportunidades individuais para DEPOIS de saber o `goalType`, adicionando filtro de `pipeline_id` baseado no tipo
- Para team targets com goal_type leads: mesma lógica aplicada aos membros do time

### 2. `src/hooks/usePACEData.ts` (Manager PACE Tracker)
**Problema**: Não considera `goal_type`. Sempre soma receita para todos os membros.

**Correção**:
- Buscar os `ote_seller_config` + `ote_levels` para cada membro do time
- Para membros com `goal_type === 'leads'`:
  - Meta mensal = `monthly_goal` do nível (em leads, não em R$)
  - Achieved = contagem de oportunidades ganhas em pipelines de `qualification`
- Para membros com `goal_type === 'revenue'`: manter lógica atual
- Separar métricas no PACE Tracker entre SDRs (leads) e Closers (revenue) para evitar misturar unidades

### 3. `src/components/dashboards/manager/PACETracker.tsx`
**Correção visual**:
- Adicionar coluna "Tipo" ou agrupar visualmente SDRs vs Closers
- Formatar valores corretamente: leads mostram "X leads" ao invés de "R$ X"

### Deploy
- Redeploy da edge function `calculate-ote`

## Resultado Esperado
- Thiago (SDR/Sniper) com 2 leads qualificados aparecerá com "2" no PACE e "2" no OTE
- Relatório OTE mostrará "2 leads" na coluna "Leads Qualificados" da seção Pré-vendas
- PACE do gestor mostrará corretamente a contagem de leads para SDRs
