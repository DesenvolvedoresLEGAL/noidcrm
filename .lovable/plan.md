
Diagnóstico forense feito:

- O problema não é falta de dados no backend. A organização `OPERADORA LEGAL` tem dados reais suficientes para o módulo:
  - `215` registros em `win_loss_records`
  - `310` oportunidades fechadas (`won/lost`)
- O comportamento da tela confirma isso: alguns blocos independentes conseguem renderizar dados, enquanto o núcleo do PRIME fica eternamente em skeleton.
- A causa principal está no frontend, no fluxo `WinLossHub -> useWinLossData`.

Causa raiz identificada:

1. Em `src/pages/intelligence/WinLossHub.tsx`, o `dateRange` é recalculado em todo render:
   - `getDateRangeFromPreset(timeframe)` usa `new Date()`
   - isso gera um `to` diferente a cada render
2. Em `src/hooks/useWinLossData.ts`, o `queryKey` inclui:
   - `dateRange.from.toISOString()`
   - `dateRange.to.toISOString()`
3. Resultado:
   - cada render cria uma chave nova no React Query
   - cada chave nova dispara uma nova busca
   - a query nunca “estabiliza”
   - a UI fica em loading infinito

Isso explica exatamente o sintoma de “carregando, carregando, carregando” sem apresentar os dados.

Correção definitiva que vou aplicar quando você aprovar:

1. Estabilizar o período no `WinLossHub`
   - usar `useMemo` para congelar o `dateRange` enquanto o `timeframe` não mudar
   - assim o período só muda quando o usuário trocar Mês/Trimestre/Semestre/Ano

2. Blindar a chave da query em `useWinLossData`
   - manter o `queryKey` baseado em valores estáveis
   - evitar churn de cache por timestamp recalculado em loop

3. Endurecer o tratamento de erro do hook
   - hoje `recordsErr` só faz `console.error` e o fluxo continua
   - vou transformar erros reais em erro de query visível, para nunca mais mascarar falhas
   - isso também evita que um erro secundário fique escondido atrás do loading infinito

4. Ajustar o gatilho da query
   - garantir que a busca só rode quando organização e contexto base estiverem prontos
   - revisar o fluxo para não haver refetch acidental em cascata

5. Verificação final em todas as abas
   - Visão Geral
   - Competitivo
   - Vendedores
   - Revenue Impact
   - Recomendações
   - validar troca de pipeline + troca de período sem voltar ao skeleton infinito

Possíveis ajustes complementares que vou checar na mesma passada:
- Se restar algum `400` isolado no console após estabilizar a query principal, vou revisar os selects relacionados das abas auxiliares
- O erro visível no screenshot parece muito mais ligado ao canal realtime/notificações do que ao core do Win/Loss, então ele não é o principal bloqueador do módulo

Arquivos a corrigir:
- `src/pages/intelligence/WinLossHub.tsx`
- `src/hooks/useWinLossData.ts`

Resultado esperado após a correção:
- os KPIs deixam de ficar eternamente em skeleton
- os dados carregam na primeira renderização
- trocar período ou pipeline refaz a consulta uma vez, corretamente
- se houver erro real de consulta, ele aparece explicitamente em vez de travar em loading infinito
