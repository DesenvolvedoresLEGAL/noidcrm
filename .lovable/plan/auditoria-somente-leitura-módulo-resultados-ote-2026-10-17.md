# Auditoria (somente leitura) — Módulo Resultados/OTE

Nenhuma alteração será feita. Este documento é o inventário. Aprovar não implementa nada.

## 1. Navegação
- Resultados: `/app/reports/ote` → `src/pages/OTEReport.tsx` (`src/App.tsx:633-641`, `AppSidebar.tsx:97-100`)
- Configurações de Vendas: `/app/settings/sales` → `src/pages/settings/SalesSettings.tsx`
- Página paralela: `/app/settings/sales-config` → `SalesConfigPage.tsx` (Geral, Taxas, Feriados)
- Desempenho: rota existe, oculta do menu (movida para RCC → Pessoas)
- Sem submenu próprio: ranking, histórico e auditoria são abas internas

## 2. Tela Resultados (`OTEReport.tsx`)
- Período: últimos 12 meses (`yyyy-MM`); botões Calcular, Exportar Excel, Configurações
- Abas: Visão Geral, Histórico (mudam conforme o modo), Auditoria (`VendasRealizadasWrapper`)
- OTE: `OTEOverviewTab`, `OTESellerDetailTab`, `OTESellerSalesDrilldown`, `OTESellerQualifiedLeadsDrilldown`, `OTEHistoryTab`; `OTEConfigurationTab` existe mas não é usado
- Metas Simples: `results/simple/SimpleGoals{Overview,SellerDetail,History}Tab`
- Comissão Padrão: `results/commission/Commission{Overview,SellerDetail,History}Tab`
- Exportação: `buildResultsWorkbook` → `buildOTEWorkbook` / `buildCommissionWorkbook` / `buildSimpleGoalsWorkbook`

## 3. Configurações de Vendas (10 cards com painel lateral)
Planejamento: Metas, Funil Reverso, Taxas de Conversão, Headcount.
Sistema: Níveis OTE, Multiplicadores, Regras, Flags, Vendedores, FitScore.
- Metas: mensal (`monthly_revenue_target`), trimestral, semestral e anual são planejamento; o cálculo é sempre mensal
- Funil reverso (`ReverseFunnelTab.tsx:48-102`): vendas = ceil(meta/ticket); por canal × share; propostas = vendas/win rate; MQL = /0,90; leads outbound = /0,79; ligações = /0,30. Valores padrão: ticket R$10.000, shares 23/72/5, win rates 54/58/70

## 4. Modos (`src/lib/results/resultsMode.ts`)
`ote` (padrão) → full_ote; `simple` → simple_goals; `standard_commission`. O seletor (`GoalSystemModeSelector`) grava em `organizations.goal_system_mode`. Comissão Padrão não tem motor próprio: reaproveita os resultados OTE.

## 5. Regras de cálculo exatas
- % Meta: receita elegível OTE / meta (closer) ou leads qualificados / meta (pré-vendas); meta <= 0 dá 0
- Meta: override do vendedor, senão a do nível; time = soma dos membros, senão meta da empresa
- Flags: azul >= limite azul; amarela >= mínimo amarelo; vermelha no restante. **Conflito: o servidor usa 100/70 por padrão e a tela usa 70/50**
- Multiplicador (`src/lib/ote/multiplier.ts`): faixa por min/max e variável base = salário variável × multiplicador; sem faixa = 0
- Elegibilidade: item e produto com `counts_for_commission`; perdida ou cancelada = 0; rateio sobre o valor comercial. A tela confia no valor salvo (sem valor salvo = 0 elegível)
- Variável final = base × gates × (1 + (roleplay + CRM + FitScore)/100); CRM = min(atividades/10×100, 100); bloqueio de aceleração limita o ajuste a <= 0
- Comissão Padrão: gerada = `final_variable_amount`; paga só se status = paid
- Metas Simples: >=100% "Meta batida", >=70% "Em ritmo", abaixo disso "Abaixo do ritmo"

## 6. Atribuição e histórico
- Receita individual: `commercial_won_revenue_historical_view` + `resolve_historical_seller_at`
- Leads: `opportunity_qualification_history` (primeiro qualificador)
- **Divergência: a meta de time usa o dono atual da oportunidade, não o histórico**
- Recalcular: apaga os detalhes antigos e preserva o status "paid"

## 7. Dados
- Tabelas: `ote_levels`, `ote_multipliers`, `ote_seller_config`, `ote_monthly_results`, `ote_sales_records`, `ote_sales_record_items`, `ote_rules`, `performance_gates`, `gate_executions`, `sales_config`, `seller_targets`, `holidays`, `fit_score_config`, `seller_evaluations`, `opportunity_owner_history`, `opportunity_qualification_history`; `accelerator_policies` é legado e não é usado no cálculo
- Views: `commercial_won_revenue_view`, `commercial_won_revenue_historical_view`, `commission_eligibility_view` (todas com `security_invoker`)
- Triggers: `track_opportunity_{stage,owner,qualification}_history` e updated_at nas tabelas OTE
- Função de servidor: `supabase/functions/calculate-ote/index.ts`
- Hooks: `useOTEData`, `useOTESalesRecords`, `useResultsMode`, `useResultsByMode`, `useSalesConfig`, `useSalesMetrics`, `useSellerEvaluations`, `useHistoricalQualifiers`

## 8. Permissões e tenant
- Menu: owner/admin veem tudo; manager e finance veem Resultados e Configurações
- A rota só exige login; o botão Calcular não restringe papel; recalcular no Histórico exige admin/manager
- `calculate-ote` usa service role e exige apenas membro ativo da organização (**sem checagem de papel**)
- RLS: a configuração é lida pela organização e gerenciada por admin; `ote_monthly_results` e `ote_sales_records` têm políticas FOR ALL por organização, o que **anula a leitura "só o próprio"**

## Riscos encontrados (sem correção)
1. Padrões de flag diferentes entre servidor e tela
2. Meta de time sem atribuição histórica
3. Zero vira valor padrão por causa de `||` (overrides, gate, funil)
4. Calcular sem checagem de papel no servidor
5. RLS permite leitura e escrita ampla dos resultados dentro da organização
