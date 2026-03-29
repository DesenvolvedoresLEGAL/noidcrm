

## Correção: Forecast usando commission_value em vez de valor real

### Problema
O KPI "Fechado" no Forecast mostra **R$ 7.941** em vez de **R$ 9.029** porque usa `commission_value` (que exclui produtos com `contabiliza_na_meta = false`). O campo `contabiliza_na_meta` é para metas de **vendedores**, não para o forecast da empresa. O Forecast deve exibir a receita real fechada.

### Causa raiz
Linha 530 de `src/hooks/useForecastData.ts`:
```ts
const closedRevenue = closedOpps.reduce((sum, o) => sum + ((o as any).commission_value ?? o.valor_previsto ?? 0), 0);
```

### Correção
Trocar para usar `valor_previsto` (receita real total da oportunidade):
```ts
const closedRevenue = closedOpps.reduce((sum, o) => sum + (o.valor_previsto ?? 0), 0);
```

Isso corrige automaticamente todos os indicadores derivados: Commit, Best Case, cenários, cobertura, velocidade — pois todos dependem de `closedRevenue`.

### Arquivo impactado
- `src/hooks/useForecastData.ts` — uma linha (530)

