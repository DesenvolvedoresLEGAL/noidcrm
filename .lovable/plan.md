## Sprint Resultados OTE 1.2 — Visão Geral executiva + 3 modos de remuneração

Objetivo: o módulo Resultados deve se adaptar ao modo escolhido pela organização (Metas Simples, Comissão Padrão, Sistema OTE Completo) com cards, tabelas, labels, abas e Excel próprios para cada modo. Sem mexer no cálculo OTE por item já corrigido, sem tocar em Vendas Realizadas nem em `commercial_won_revenue_view`.

### 1. Schema (mínimo, retrocompatível)

Migration:
- `ALTER TABLE public.organizations` — drop CHECK antigo de `goal_system_mode` e recriar com 3 valores: `ote`, `simple`, `standard_commission`. Default continua `ote`.
- Atualizar comentário da coluna.
- Atualizar `src/hooks/useCurrentOrganization.ts` (`Organization.goal_system_mode: 'ote' | 'simple' | 'standard_commission'`).

Nenhuma mudança em tabelas OTE, em views de receita ou em RLS.

### 2. Helper central de modo

Criar `src/lib/results/resultsMode.ts`:
- `type ResultsMode = 'simple_goals' | 'standard_commission' | 'full_ote'`
- `getResultsMode(org)` lê `goal_system_mode` e mapeia (`ote → full_ote`, `simple → simple_goals`, `standard_commission → standard_commission`).
- Helpers `isSimpleGoalsMode`, `isStandardCommissionMode`, `isFullOteMode`.
- `getResultsCopy(mode)` devolve `{ pageTitle, pageSubtitle }` para o `PageHeader`.

Hook `src/hooks/useResultsMode.ts` empacota `useCurrentOrganization` + helper.

### 3. `OTEReport.tsx` — roteamento por modo

- Usar `useResultsMode()` em vez do booleano `isOTEMode`.
- Aplicar título/subtítulo do helper (Relatório OTE / Relatório de Comissões / Relatório de Metas).
- Renderizar os componentes corretos por aba:
  - `full_ote` → `OTEOverviewTab` / `OTESellerDetailTab` / `OTEHistoryTab` (já existentes, refinados no item 4).
  - `standard_commission` → `CommissionOverviewTab` / `CommissionSellerDetailTab` / `CommissionHistoryTab` (novos).
  - `simple_goals` → `SimpleGoalsOverviewTab` / `SimpleGoalsSellerDetailTab` / `SimpleGoalsHistoryTab` (novos).
- `handleExportExcel` chama `buildResultsWorkbook({ mode, … })` (novo dispatcher) que delega para os builders por modo.

### 4. Refino do modo `full_ote` (sem tocar no cálculo por item)

`OTEOverviewTab.tsx`:
- Cards (grid 5):
  1. **Total a pagar** = `Σ final_variable_amount`.
  2. **Comissão elegível comercial** = `validCommercialRevenue` (já vem de `aggregateEligible.ssotTotal`). Subtexto "Fonte: Vendas Realizadas".
  3. **Receita elegível OTE** = `eligibleOTERevenue` (já existe). Subtexto "Após excluir itens fora da meta".
  4. **Itens fora da meta** = `validCommercialRevenue − eligibleOTERevenue`. Subtexto "Produtos, serviços, logística, taxas e itens não comissionáveis".
  5. **Vendedores no cálculo** = `individualResults.length`. Subtexto "Closers, pré-vendas e funções configuradas".
- Remover card "Média % Meta (Closers)" do topo. Levar a métrica para dentro da seção Closers (linha pequena acima da tabela).
- Adicionar faixa de reconciliação: `Comissão elegível comercial − Itens fora da meta = Receita elegível OTE`, com alerta destrutivo quando `|comercial − fora − elegível| > R$ 0,01` ou quando `Receita elegível OTE > Comissão elegível comercial`.
- Flags: trocar labels para **Alta performance / Zona de atenção / Abaixo do mínimo** (cores e ícones permanecem). Tooltip mantém o nome legado para retrocompatibilidade.
- Tabela Closers: renomear coluna "Vendas" → "Receita elegível OTE" (usar `eligibleTotal` por vendedor calculado a partir de `records`). Adicionar coluna "Comissão elegível comercial" (oculta abaixo de `lg`, disponível em tooltip do nome do vendedor).

`OTESellerDetailTab.tsx`:
- Já não mostra bloco SSoT/Fonte — manter.
- Renomear labels visuais ("Elegível p/ meta" → "Receita elegível OTE").

### 5. Novo modo `standard_commission`

Componentes novos em `src/components/results/commission/`:
- `CommissionOverviewTab.tsx` com 5 cards: Comissão a pagar, Receita comissionável, Receita não comissionável, Vendas com comissão, Vendedores com comissão. Tabela principal: Vendedor / Receita comissionável / Receita não comissionável / % Comissão média / Comissão gerada / Comissão paga / Comissão pendente / Status.
- `CommissionSellerDetailTab.tsx`: collapsible por vendedor com Receita comissionável, Comissão calculada/paga/pendente, regras aplicadas, drill-down de vendas (`OTESellerSalesDrilldown` reaproveitado com header customizado) sem meta/multiplicador/OTE.
- `CommissionHistoryTab.tsx`: Período / Receita comissionável / Comissão gerada / Comissão paga / Comissão pendente / Qtde vendedores / Status.

Hook `src/hooks/useStandardCommissionResults.ts`:
- Reaproveita `useOTEMonthlyResults` + `useOTESalesRecords` como base (os mesmos `ote_results` representam o período); a métrica "Comissão calculada" usa `final_variable_amount` ou `base_variable` (quando multiplicador = 1) e "Receita comissionável" = `eligibleTotal`. Status pago/pendente via campos já existentes em `ote_monthly_results.status`. Nenhuma nova tabela.
- Documentar em comentário que regras avançadas de comissão por produto/categoria/pipeline são consumidas via configuração existente quando disponível; senão fallback no resultado OTE.

### 6. Novo modo `simple_goals`

Componentes novos em `src/components/results/simple/`:
- `SimpleGoalsOverviewTab.tsx`: 5 cards: Receita realizada, Meta do período, Atingimento, Vendedores acima da meta, Vendedores abaixo da meta. Tabela: Vendedor / Meta / Receita realizada / % Meta / Status (Meta batida / Em ritmo / Abaixo do ritmo / Sem meta configurada) / Gap para meta.
- `SimpleGoalsSellerDetailTab.tsx`: collapsible com Meta, Receita realizada, % Meta, Gap, drill-down de vendas — sem comissão/OTE/multiplicador.
- `SimpleGoalsHistoryTab.tsx`: Período / Meta total / Receita realizada / % Atingimento / Qtde vendedores / Status.

Sem mexer em backend: continua lendo `ote_monthly_results` + `ote_sales_records`, ignorando colunas de variável/multiplicador/aceleradores na UI.

### 7. Configurações > Vendas (`GoalSystemModeSelector.tsx`)

- Grid passa a ter 3 cards (`ote`, `simple`, `standard_commission`). Card novo "Comissão Padrão" com bullets: comissão por venda, por produto/serviço, por vendedor/função, controle pago/pendente, sem multiplicadores.
- `handleModeChange` aceita os 3 valores e invalida as mesmas queries.

### 8. Excel adaptativo

Refatorar `src/components/ote/export/buildOTEWorkbook.ts` em:
- `src/components/results/export/buildResultsWorkbook.ts` (dispatcher por modo).
- `buildOTEWorkbook` (existente, ajustar abas Resumo OTE / Vendedores / Vendas / Itens conforme spec — colunas: Comissão elegível comercial, Receita elegível OTE, Itens fora da meta etc.).
- `buildCommissionWorkbook` (Resumo Comissão / Vendedores / Vendas / Itens com regra aplicada e comissão por item).
- `buildSimpleGoalsWorkbook` (Resumo Metas / Vendedores / Vendas).
- `OTEReport.handleExportExcel` passa `mode` e os dados.

### 9. Validações e copy

- Labels proibidos: substituir todas as ocorrências de "Vendas", "Receita válida", "Média geral", "Valor total" no módulo Resultados pelos labels explícitos do modo.
- Alertas visuais nos 3 modos (faixa abaixo dos cards) conforme spec (divergência OTE; item comissionável vs não comissionável; "Sem meta configurada").
- `Tooltip` nas flags renomeadas explicando faixas e que limiares são configuráveis em Configurações > Vendas > Flags.

### 10. Testes / verificação

- `npx tsc --noEmit` deve passar.
- Smoke manual nos 3 modos: trocar `goal_system_mode` da organização, clicar Calcular, verificar cards/tabelas/Excel.
- Conferir cenários: Segredos da Audiência (R$ 2.397,00 elegível) e Notorious Nutrition (R$ 2.526,70 elegível) batendo entre linha principal e detalhe.

### Arquivos impactados (resumo)

Novos:
- `supabase/migrations/<ts>_add_standard_commission_mode.sql`
- `src/lib/results/resultsMode.ts`
- `src/hooks/useResultsMode.ts`
- `src/hooks/useStandardCommissionResults.ts`
- `src/components/results/commission/{CommissionOverviewTab,CommissionSellerDetailTab,CommissionHistoryTab}.tsx`
- `src/components/results/simple/{SimpleGoalsOverviewTab,SimpleGoalsSellerDetailTab,SimpleGoalsHistoryTab}.tsx`
- `src/components/results/export/{buildResultsWorkbook,buildCommissionWorkbook,buildSimpleGoalsWorkbook}.ts`

Modificados:
- `src/pages/OTEReport.tsx`
- `src/components/ote/OTEOverviewTab.tsx`
- `src/components/ote/OTESellerDetailTab.tsx`
- `src/components/ote/OTEHistoryTab.tsx` (colunas)
- `src/components/ote/export/buildOTEWorkbook.ts`
- `src/components/ote/GoalSystemModeSelector.tsx`
- `src/hooks/useCurrentOrganization.ts`

Não tocar:
- `commercial_won_revenue_view`, `commission_eligibility_view`, edge `calculate-ote`, lógica em `oteEligibility.ts`, módulo Vendas Realizadas.

### Riscos
- Mudar o CHECK de `goal_system_mode` exige drop + recreate; rollout precisa garantir que nenhum valor inválido exista (default permanece `ote`).
- Reaproveitar `ote_monthly_results` para o modo Comissão Padrão é uma simplificação de UI: regras finas de comissão por produto continuam dependendo de configuração futura — documentar no hook.
- Refatorar o builder de Excel pode quebrar import paths existentes; manter re-export em `src/components/ote/export/buildOTEWorkbook.ts` para retrocompatibilidade.
