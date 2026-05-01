# Sprint F2.9 — Forecast V2 Activation, Fixes e Estabilização Final

Objetivo: tirar o Forecast V2 do estado "ainda não pronto" para uso real em produção. Sem mudar a fórmula da Engine V2 (F2.3), sem alterar pesos NRHS oficiais, sem refatorar layout. Foco: ativação, correção de erros e textos legados.

## Diagnóstico (já validado no banco)

- `feature_flags` tem UNIQUE em `(organization_id, flag_key)` → suporta `ON CONFLICT` com upsert.
- Causa raiz do erro `operator does not exist: text = uuid`: a coluna `forecast_calculation_items.pipeline_id` é **text**, enquanto `forecast_calculation_runs.pipeline_id` e o parâmetro `p_pipeline_id` são **uuid**. Comparações diretas em joins/filtros das RPCs de acurácia quebram.
- 12 RPCs `*_v2` já existem; o problema não é "faltar função", é cast de tipo + ausência de run/snapshot inicial após ativar a flag.

## Mudanças (escopo fechado)

### 1. Migration (1 arquivo)

**`supabase/migrations/<timestamp>_forecast_v2_f29_stabilization.sql`**

- **1.1 Normalizar tipo de `forecast_calculation_items.pipeline_id`** para `uuid` (USING `nullif(pipeline_id,'')::uuid`). Atualiza índices envolvidos. Esta é a correção definitiva do `text = uuid`.
- **1.2 RPC `activate_forecast_v2_engine(p_organization_id uuid)`** — `SECURITY DEFINER`, `search_path = public`. Valida que o caller é `admin`/`owner`/`manager`/`platform_admin` da org, executa o upsert canônico:
  ```
  INSERT INTO feature_flags(organization_id, flag_key, enabled)
  VALUES (p_organization_id, 'forecast_v2_engine_enabled', true)
  ON CONFLICT (organization_id, flag_key)
  DO UPDATE SET enabled = true, updated_at = now();
  ```
  Retorna a linha resultante. Loga em `forecast_v2_health_logs`.
- **1.3 Recriar 4 RPCs com cast seguro de `p_seller_id`** (`uuid` opcional) e qualquer outro `text vs uuid`:
  - `calculate_forecast_accuracy_v2`
  - `get_forecast_seller_accuracy_v2`
  - `get_forecast_actual_closed_amount_v2`
  - `get_forecast_snapshots_v2`
  
  Padrão aplicado: `(p_seller_id IS NULL OR seller_id = p_seller_id)` para colunas uuid; `(p_seller_id IS NULL OR seller_id::text = p_seller_id::text)` quando lado for `text`. Nunca cast cego sem `nullif` em parâmetros opcionais. Assinatura, retorno e regra de negócio preservados — só hardening de tipos.
- **1.4 Health check (`get_forecast_v2_health_check`)** ganha 5 status diferenciados: `not_ready` (flag off / sem run), `attention` (flag on, run ok, <5 snapshots), `healthy` (tudo pronto), `critical` (erro de RPC/RLS/inconsistência), `forbidden`. Mensagens reaproveitam `data_consistency` existente.

Nada nas fórmulas da Engine V2 ou pesos NRHS é tocado.

### 2. Hooks (`src/hooks/forecast/`)

- **`useForecastV2Health.ts`** ganha duas mutations:
  - `useActivateForecastV2()` → chama RPC `activate_forecast_v2_engine`. Invalida `forecast-v2-health` e `is_feature_enabled`.
  - `useBootstrapForecastV2()` → executa em sequência, com try/catch independente em cada passo: `calculate_forecast_audit_v2` → `create_forecast_daily_snapshot_v2` → `calculate_forecast_accuracy_v2` → `get_forecast_intelligence_v2` → `get_forecast_risk_center_v2` → `get_forecast_v2_health_check`. Retorna relatório `{step, ok, error?}[]`. Toast final agregado.
- `useForecastAccuracy.ts`: tratar erro de RPC retornando `{accuracy: null, sellerAccuracy: []}` em vez de throw, para a UI cair no estado "em formação" em vez de Alert vermelho. Erro técnico real continua propagando — só reclassificamos códigos `42883`/`42P01` quando vierem após bootstrap (mensagem amigável).

### 3. UI

**`src/components/forecast/health/ForecastV2HealthPanel.tsx`**
- Banner amarelo (flag desligada) ganha botão **"Ativar Forecast Engine V2"** chamando `useActivateForecastV2`. Bloco `<pre>` com SQL passa a ser collapsible secundário ("Ver SQL manual").
- Quando flag estiver ligada mas sem run, exibir card de bootstrap com botão **"Inicializar Forecast V2 agora"** (`useBootstrapForecastV2`). Renderiza checklist do resultado por etapa.
- Visibilidade já restrita a `admin/owner/manager/platform_admin`.

**`src/components/forecast/ForecastAccuracyPanel.tsx`**
- Distinguir `error` real de "RPC retornou vazio". Se `snapshots < 5` **e** `error == null`, manter card "Acurácia em formação" (já existe).
- Se `error` existir, usar mensagem amigável (`FORECAST_RPC_FAILURE_MESSAGE` de `shared/ForecastEmptyState.tsx`) em vez de mostrar `error.message`.

**`src/components/forecast/ForecastScenariosCard.tsx`**
- Substituir badges fixos `90% / 60% / 40% / 20%` por labels `Fechado / Engine V2 / Cenário expandido / Teto comercial` quando flag V2 ativa (ler via `useFeatureFlag('forecast_v2_engine_enabled')`).
- Substituir legenda inferior:
  - Pessimista: "Somente receita fechada no período"
  - Realista: "Fechado + deals elegíveis ajustados por probabilidade, NRHS, tempo, atividade, próximo passo, estágio e risco"
  - Otimista: "Inclui deals com boa chance, mas com pendências operacionais"
  - Melhor Caso: "Teto comercial do pipeline (não é previsão)"
- Atualizar `scenarioConfig.optimistic.description/formula` removendo "Weighted × 1.2".
- Quando flag V2 desligada, manter textos antigos (compatibilidade).

**`src/components/forecast/ForecastDataQuality.tsx`** (linhas 359–364)
- Substituir bloco "Como o NRHS afeta o Forecast" pela tabela oficial F2.3:
  - NRHS ≥ 80: fator 1.00
  - NRHS 70–79: fator 0.90
  - NRHS 60–69: fator 0.75
  - NRHS 40–59: fator 0.50
  - NRHS < 40: excluído do forecast
- Ajustar thresholds visuais (`avgNRHS >= 75` etc.) para refletir o novo corte de 80, sem alterar regra de cálculo (apenas texto/cores).

### 4. Tipos

- `src/types/forecast-health.ts`: adicionar campos `engine_active` e `bootstrap_required` ao `ForecastV2HealthCheck` para o Panel decidir qual CTA mostrar.

## O que NÃO está no escopo

- Não alterar fórmula nem pesos da Engine V2.
- Não criar nova aba, não refazer layout.
- Não mexer em Risk Center, AI Intelligence ou Seller Performance além de garantir que recebem cast seguro de `p_seller_id` (já cobertos pelo item 1.3 onde aplicável).
- Não usar service role no frontend; toda ativação passa pela RPC `SECURITY DEFINER` com checagem de role.
- Saúde V2 permanece restrita; vendedor comum não vê nada novo.

## Critérios de aceite

1. Owner clica em "Ativar Forecast Engine V2" → flag fica `true` (independente de já existir linha).
2. Owner clica em "Inicializar Forecast V2 agora" → run + snapshot + acurácia + AI + risk center + health rodam em sequência, com relatório por etapa.
3. Aba Acurácia não mostra mais `operator does not exist: text = uuid`. Com <5 snapshots, mostra "em formação" sem alerta vermelho.
4. AI, Riscos e Vendedor saem de "em formação" assim que existir run válido para o período.
5. Cenários sem badges fixos `90/60/40/20%` quando V2 ativa; legenda nova.
6. Bloco NRHS exibe os 5 fatores oficiais da F2.3.
7. Health Check distingue `not_ready / attention / healthy / critical / forbidden`.
8. Build passa, RLS preservado, multi-tenant intacto.

## Arquivos impactados

- **Migration nova**: `supabase/migrations/<ts>_forecast_v2_f29_stabilization.sql`
- **Editados**: `src/hooks/forecast/useForecastV2Health.ts`, `src/hooks/forecast/useForecastAccuracy.ts`, `src/components/forecast/health/ForecastV2HealthPanel.tsx`, `src/components/forecast/ForecastAccuracyPanel.tsx`, `src/components/forecast/ForecastScenariosCard.tsx`, `src/components/forecast/ForecastDataQuality.tsx`, `src/types/forecast-health.ts`

## Riscos

- Conversão `pipeline_id` text → uuid: se houver linhas com strings inválidas em `forecast_calculation_items`, a migration falha. Mitigação: `DELETE FROM forecast_calculation_items WHERE pipeline_id IS NOT NULL AND nullif(pipeline_id,'') !~* '^[0-9a-f-]{36}$'` antes do `ALTER TYPE` (linhas órfãs de runs antigos podem ser descartadas — serão regeradas no próximo bootstrap).
- Recriar RPCs preserva assinatura (mesmos parâmetros e retorno) para não quebrar chamadas existentes.
