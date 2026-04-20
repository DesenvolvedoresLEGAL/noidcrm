

# Plano: Refinar a tela Forecast (6 correções)

## 1. HUMANOID Forecast Intelligence travado "girando"

**Diagnóstico:** O painel é 100% calculado no frontend a partir de regras `if/else` sobre KPIs já carregados. O botão de refresh só faz `setIsAnalyzing(true)` e **nunca volta para `false`** — não existe chamada de IA real, só uma animação infinita.

**Correção:**
- Conectar o painel ao edge function `generate-forecast-prediction` (já migrado para OpenAI) que retorna fatores positivos, riscos e recomendações **gerados por IA** com base nas oportunidades reais.
- Estado do painel: `idle | loading | success | error`.
- Cache via React Query (`['forecast-ai-insights', orgId, periodStart, periodEnd, pipelineId]`), `staleTime: 10min`.
- Manter o cálculo determinístico atual como **fallback** caso a IA falhe (evita tela vazia).
- Botão refresh chama `refetch()` da query e desativa enquanto `isFetching`.

## 2. "Próximo Passo" — explicar o que é

**Diagnóstico:** O termo aparece em `ForecastDataQuality` e `AIForecastInsightsPanel` sem definição clara. Internamente `has_next_step = true` quando a oportunidade tem **uma atividade pendente ou agendada (não completada e não cancelada)**.

**Correção:**
- Adicionar `Tooltip` no rótulo "Com Próximo Passo" (ForecastDataQuality) e na recomendação "Ausência de próximo passo impacta…" (AIForecastInsightsPanel) explicando: *"Próximo passo = atividade agendada (call, e-mail, reunião, follow-up) com data futura e status pendente. Oportunidades sem próximo passo costumam estagnar."*
- Adicionar uma legenda inline curta abaixo do título da seção Qualidade.

## 3. Erros `ipapi.co/ERR_NAME_NOT_RESOLVED`

**Diagnóstico:** `PostHogProvider.tsx` faz `fetch('https://ipapi.co/{ip}/json/')` em cada `track()`. O domínio é bloqueado (ad-blocker / DNS) e gera erro a cada page_view. **Não consome memória significativa**, mas polui o console e adiciona latência por causa de timeouts repetidos.

**Correção:**
- Cachear o resultado de `getGeoLocation` em `sessionStorage` (`ph_geo`) — chamar **uma vez por sessão**, não por evento.
- Trocar `ipapi.co` por endpoint mais estável e gratuito sem rate limit agressivo: `https://ipwho.is/{ip}` (não bloqueado por adblockers comuns) com fallback silencioso.
- Wrap em `try/catch` com log apenas em dev (`if (import.meta.env.DEV)`), evitando ruído em produção.
- Adicionar `AbortController` com timeout de 3s.

## 4. Aba Acurácia "morta" (0%, 0%, 0%)

**Diagnóstico:** Hook `useForecastAccuracyMetrics` lê de `forecast_accuracy_metrics` que está vazio. Não existe job que materialize previsões vs resultados reais. Hoje a aba só mostraria dados se alguém populasse a tabela manualmente.

**Correção (UX honesta + setup):**
- **Curto prazo (UX):** Substituir "0.0%" por estado vazio explicativo: *"Aguardando histórico de previsões. Esta aba começa a mostrar dados após 30 dias de oportunidades fechadas (won/lost) com previsão registrada."* + CTA "Como funciona Acurácia" com tooltip.
- **Funcional:** Criar job (edge function `compute-forecast-accuracy`) que roda diariamente:
  - Para cada oportunidade fechada nos últimos 90 dias, comparar `nrhs_score` snapshot vs `outcome` (won/lost).
  - Calcular MAE, accuracy IA (modelo NRHS) vs accuracy humana (probabilidade manual do vendedor).
  - Inserir em `forecast_accuracy_metrics` agrupado por mês/pipeline/usuário.
- Trigger inicial: rodar uma vez no deploy para popular histórico existente.

## 5. Aba Riscos — não dá pra ver "+47 mais", "+1 mais", "+5 mais"

**Diagnóstico:** `ForecastRisksPanel` hardcoda `.items.slice(0, 5)` e mostra "+N mais..." apenas como texto **estático, não clicável**.

**Correção:**
- Transformar `+N mais...` em botão "Ver todos os {N+5} deals".
- Ao clicar, abrir um `Sheet` (drawer lateral) com a lista completa daquela categoria, mostrando: título, vendedor, valor, close date, dias sem atividade, link para a oportunidade.
- Suporte a busca/filtro dentro do sheet (input simples) e ordenação por valor/data.
- Cada linha clica e leva para `/app/pipeline?opp={id}` (mesmo padrão de outras telas).

## 6. Botão de atualizar (filtros) "não funciona"

**Diagnóstico:** Tecnicamente funciona — chama `refetch()` que dispara as 4 queries. Mas:
- Sem feedback visual (toast / spinner some rápido demais).
- React Query devolve dados do cache instantaneamente, então parece que "nada aconteceu".
- `staleTime` alto faz a query ignorar refetch quando os dados são considerados frescos.

**Correção:**
- No `refetch()` do hook, forçar `queryClient.invalidateQueries({ queryKey: ['forecast'] })` e também invalidar a query de IA insights (item 1).
- Adicionar `toast.success('Forecast atualizado')` após sucesso e `toast.error(...)` em falha.
- Mudar o ícone para spinner enquanto `isFetching` (não só `isLoading`) — `isLoading` só é `true` na primeira carga.
- Mostrar timestamp "Atualizado há X" ao lado do botão.

## Arquivos afetados

- `src/components/forecast/AIForecastInsightsPanel.tsx` — conectar à IA real (item 1)
- `src/hooks/useForecastAIInsights.ts` — **novo** (item 1)
- `supabase/functions/generate-forecast-prediction/index.ts` — ajustar contrato de retorno se necessário (item 1)
- `src/components/forecast/ForecastDataQuality.tsx` — tooltip "próximo passo" (item 2)
- `src/components/PostHogProvider.tsx` — cache geo + fallback silencioso (item 3)
- `src/components/forecast/AccuracyDashboard.tsx` — estado vazio explicativo (item 4)
- `supabase/functions/compute-forecast-accuracy/index.ts` — **novo** (item 4)
- `supabase/migrations/...` — agendar cron diário do compute (item 4)
- `src/components/forecast/ForecastRisksPanel.tsx` — botão "ver todos" + Sheet (item 5)
- `src/components/forecast/ForecastRiskDetailSheet.tsx` — **novo** (item 5)
- `src/components/forecast/ForecastFilters.tsx` — toast + spinner correto + timestamp (item 6)
- `src/hooks/useForecastData.ts` — `refetch` invalida queries explicitamente (item 6)

## Detalhes técnicos

- **Item 1:** o edge function precisa receber `{organizationId, periodStart, periodEnd, pipelineId, userId}` e retornar `{positiveFactors[], riskFactors[], recommendations[], confidenceScore}`. Usar `gpt-5-mini` com `response_format: json_object`.
- **Item 4:** definir snapshot de NRHS no momento da projeção via tabela `forecast_predictions_snapshot` (criar se não existir) — sem isso, não há "previsão histórica" pra comparar com o resultado.
- **Item 5:** Sheet usa `vaul`/`@/components/ui/sheet` já no projeto. Reaproveitar `OpportunityListItem` se existir.
- **Item 6:** `refetch` retorna `Promise<void>` — encadear `.then(() => toast(...))`.

## Validação após deploy

1. Aba "AI" carrega dados reais em <5s e botão refresh para de girar quando termina.
2. Hover em "Próximo Passo" mostra tooltip explicativo.
3. Console limpo (sem erros ipapi.co repetidos).
4. Aba "Acurácia" mostra mensagem clara em vez de "0.0%".
5. Clicar "+47 mais" abre sheet com 52 deals navegáveis.
6. Clicar refresh dos filtros mostra toast e timestamp atualizado.

