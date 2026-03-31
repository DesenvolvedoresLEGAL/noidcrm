

# Plano: Diferenciar tipo de meta nos Níveis OTE (Leads vs R$)

## Problema
Os 3 primeiros níveis (Scout, Hunter, Sniper) têm meta de **leads qualificados** (quantidade), mas a tabela e UI tratam tudo como R$ (formatCurrency). Os níveis Closer+ têm meta em R$.

## Alterações

### 1. Migration — adicionar coluna `goal_type` em `ote_levels`
```sql
ALTER TABLE ote_levels ADD COLUMN goal_type text NOT NULL DEFAULT 'revenue';
-- Atualizar BDRs para 'leads'
UPDATE ote_levels SET goal_type = 'leads' WHERE level_code IN ('BDR1','BDR2','BDR3');
```
Valores possíveis: `'revenue'` (R$) ou `'leads'` (quantidade).

### 2. `src/hooks/useOTEData.ts` — adicionar `goal_type` ao tipo `OTELevel`
Adicionar `goal_type: 'revenue' | 'leads'` na interface e incluir no formData dos mutations.

### 3. `src/components/ote/config/OTELevelsConfig.tsx`
- **Tabela**: coluna "Meta Mensal" formata conforme `goal_type`:
  - `'revenue'` → `formatCurrency(value)` (R$ 60.000,00)
  - `'leads'` → `${value} leads`
- **Dialog de edição**: adicionar seletor de "Tipo de Meta" (Select com opções "Valor em R$" / "Leads qualificados") que define `goal_type`
- O label "Meta Mensal" muda dinamicamente: "Meta Mensal (R$)" ou "Meta Mensal (leads)"

### 4. Demais hooks que usam `monthly_goal` (impacto mínimo)
- `useForecastData.ts`: já filtra por `is_team_target=false` e soma como R$ — precisa filtrar também por `goal_type='revenue'` para não somar leads como R$
- `useRepPACE.ts`: usa o `monthly_goal` do nível — precisa considerar `goal_type` para exibir corretamente no KPI card
- `useOwnerDashboard.ts` e `useManagerDashboard.ts`: usam `profiles.monthly_goal` (não `ote_levels`), sem impacto direto

### Arquivos modificados
1. 1 migration SQL (coluna `goal_type`)
2. `src/hooks/useOTEData.ts`
3. `src/components/ote/config/OTELevelsConfig.tsx`
4. `src/hooks/useForecastData.ts` (filtrar `goal_type='revenue'` na soma)
5. `src/hooks/useRepPACE.ts` (exibição condicional)
6. `src/components/dashboards/rep/RepKPICards.tsx` (formatação condicional da meta)

