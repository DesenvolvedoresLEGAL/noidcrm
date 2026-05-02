# Sprint F2.9.1 — Forecast V2: hotfix de operação 100%

Foco: deixar o Forecast V2 totalmente funcional para o owner. Sem nova inteligência, sem refazer layout, apenas corrigir os bloqueios reais identificados nos prints + nos logs de banco.

## Problemas confirmados

1. **Tabs em duas linhas** — `TabsList` está com `md:grid-cols-7`, mas para owner/admin existem **8 abas** (Geral, Qualidade, Acurácia, Vendedor, Deals, AI, Riscos, Saúde V2). A 8ª quebra para a linha de baixo.
2. **`column a.legal_name does not exist`** — confirmado via `\d accounts`: a coluna correta é `razao_social` (não existe `legal_name`). Isso quebra:
   - `calculate_forecast_audit_v2` (Recalcular Forecast)
   - `create_forecast_daily_snapshot_v2` (Gerar Snapshot + cron 23:50)
   - Logs `forecast_snapshot_job_logs`: `status=failed` em 01/05 e 02/05 (2 dias sem coleta).
3. **Banner "Forecast V2 ativa, mas precisa de dados iniciais" continua aparecendo** mesmo após inicializar — porque o bootstrap falha em 2 passos (audit + snapshot) e `bootstrap_required` segue `true`. Além disso, o banner não considera "já existe pelo menos 1 run + 1 snapshot bem-sucedidos".
4. **Acurácia "calculada", mas aba Acurácia vazia** — a RPC `calculate_forecast_accuracy_v2` roda, mas como nunca houve snapshots (job falhando), `useForecastAccuracyMetrics` (legado, baseado em `forecast_predictions`) não tem dados → empty state. A aba precisa também consumir `forecast_accuracy_v2` quando ele existir.
5. **Toast "Calcular Acurácia" diz sucesso mesmo sem dados** — UX confunde o owner.

## Mudanças

### 1. Banco (migration única)

Recriar as duas RPCs trocando `a.legal_name` por `COALESCE(a.nome_fantasia, a.razao_social)` (alias mantido como `company_name`):

```sql
-- calculate_forecast_audit_v2: trocar a.legal_name por COALESCE(a.nome_fantasia, a.razao_social)
-- create_forecast_daily_snapshot_v2: idem
-- Manter assinatura, retorno e demais filtros idênticos.
```

Reprocessar o último job de snapshot manualmente após o deploy:
- Inserir 1 chamada de `create_forecast_daily_snapshot_v2` para a org do owner para validar fluxo.

### 2. Tabs em uma linha (`src/pages/Forecast.tsx`)

- Trocar `md:grid-cols-7` por `md:grid-cols-8` quando `showHealth` for true; manter `md:grid-cols-7` quando for false.
- Manter `overflow-x-auto` como fallback em viewports muito estreitos.

### 3. Banner de bootstrap (`ForecastV2HealthPanel.tsx`)

- O banner "Forecast V2 ativa, mas precisa de dados iniciais" deve sumir quando `engine_active = true` E `latest_run_at IS NOT NULL` E `latest_snapshot_at IS NOT NULL`. Hoje só esconde por `bootstrap_required`, que fica `true` se qualquer passo falhou.
- Após a correção do `legal_name`, o bootstrap completa todos os 5 passos e o banner desaparece naturalmente.
- Ajustar `useBootstrapForecastV2` para tratar erro de cada etapa de forma idempotente (continuar com os próximos passos e reportar o resumo).

### 4. Aba Acurácia (`AccuracyDashboard.tsx`)

- `ForecastAccuracyPanel` (V2 oficial) já está renderizado no topo. Mover o empty-state legado para depois dele e mostrar o legado **apenas** se `forecast_accuracy_v2` também não tiver dados.
- Quando o V2 traz `summary` válido, esconder o bloco "Aguardando histórico de previsões" para não passar a impressão de tela vazia.

### 5. Toast honesto em "Calcular Acurácia"

- Em `useForecastAccuracy.calculateAccuracy`, se a resposta voltar `null` ou `predictions_with_outcome = 0`, mostrar toast `info` ("Acurácia recalculada — sem deals fechados no período ainda") em vez de `success`.

### 6. Cron snapshot 23:50

- Não há mudança de schedule. Após corrigir a RPC, o próximo run às 23:50 BRT vai gravar com sucesso. O painel "Próxima coleta 23:50 (BRT)" continua correto.

## Arquivos impactados

- `supabase/migrations/<novo>_forecast_v2_fix_legal_name.sql` (novo)
- `src/pages/Forecast.tsx`
- `src/components/forecast/health/ForecastV2HealthPanel.tsx`
- `src/components/forecast/AccuracyDashboard.tsx`
- `src/hooks/forecast/useForecastAccuracy.ts` (toast)
- `src/hooks/forecast/useForecastV2Health.ts` (bootstrap tolerante a erro)

## Riscos

- Recriar as RPCs com `CREATE OR REPLACE` mantém grants/RLS. Risco baixo.
- Mudar grid das tabs não afeta lógica. Risco zero.
- Ajuste de banner é puramente cosmético.

## Resultado esperado

- Tabs em 1 linha para owner.
- Recalcular Forecast, Gerar Snapshot e Bootstrap funcionam sem erro.
- Cron 23:50 volta a coletar snapshot diário.
- Banner "ainda não pronto" desaparece após bootstrap bem-sucedido.
- Aba Acurácia mostra dados V2 reais; só cai em empty-state se realmente não houver fechado.
- Toast de acurácia reflete a realidade (sucesso vs. sem dados).
