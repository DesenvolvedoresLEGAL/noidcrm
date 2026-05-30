# Patch: Atribuição Histórica no OTE

## Causa raiz confirmada

`commercial_won_revenue_view.seller_id = opportunities.owner_user_id` (dono atual). Em maio/2026, 10 das 84 oportunidades atribuídas ao Wagner eram do Leandro André antes do `closed_at` (transferidas após o ganho). É isso que infla Wagner para R$ 506.722,07.

`opportunity_owner_history` cobre 100% das oportunidades do período — temos como resolver vendedor histórico sem snapshot novo nem backfill.

## Princípios

- **Não alterar** `commercial_won_revenue_view` nem o Relatório de Vendas Realizadas.
- **Não alterar** a regra item a item (`aggregateEligible`).
- Toda mudança fica numa camada nova de "atribuição histórica" reaproveitando `opportunity_owner_history` e `opportunity_qualification_history`.

## Escopo

### 1. Banco (migration única, sem destrutivo)

1. Função SQL `public.resolve_historical_seller_at(p_opportunity_id uuid, p_at timestamptz) returns uuid` — retorna `to_owner_user_id` da última linha de `opportunity_owner_history` com `changed_at <= p_at`; fallback: primeiro `from_owner_user_id` da história; fallback final: `opportunities.owner_user_id`. `STABLE`, `SECURITY DEFINER`, `search_path = public`.
2. View `public.commercial_won_revenue_historical_view` — `SELECT * EXCLUDE (seller_id, seller_name), resolve_historical_seller_at(opportunity_id, won_at) AS seller_id, prof.full_name AS seller_name, original_seller_id (= seller_id da view base), attribution_source ('owner_history' | 'fallback_current_owner'), attribution_confidence ('high' | 'low')` por cima de `commercial_won_revenue_view`. GRANT SELECT para `authenticated` e `service_role`. (Nenhuma alteração na view base.)
3. Função SQL `public.resolve_historical_qualifier(p_opportunity_id uuid) returns uuid` — `qualified_by_user_id` mais antigo em `opportunity_qualification_history`; fallback: `opportunities.owner_user_id`.

### 2. Serviço e hooks de receita

- `src/services/revenue/revenueSsotService.ts`:
  - Adicionar `getHistoricalRevenueBySeller(p)` lendo `commercial_won_revenue_historical_view` (mesma assinatura do `getRevenueBySeller`).
  - Não modificar funções existentes.
- `src/hooks/revenue/useRevenueSsot.ts`:
  - Novo `useHistoricalRevenueBySeller(p)`.

### 3. Helper central de atribuição

- Novo `src/lib/results/historicalAttribution.ts`:
  - `getHistoricalSellerId(row)` / `getHistoricalSellerName(row)` lendo a view histórica.
  - `isUserInactiveOrDeleted(profile)` — usa `crm_active_users_view` (já é fonte oficial) para marcar histórico.
  - `buildClosersRowsHistorical({ oteResults, historicalGroups, activeUsers })` — produz linhas mescladas: cada vendedor histórico do período aparece, com badge "Inativo"/"Excluído" quando aplicável, mesmo sem `ote_monthly_results`.

### 4. UI — Tabela Closers (somente OTE Overview)

Em `src/components/ote/OTEOverviewTab.tsx`:
- Substituir `useRevenueBySeller` por `useHistoricalRevenueBySeller` na coluna "Comissão elegível comercial".
- Linhas da tabela passam a ser a união de `revenueResults` ∪ vendedores históricos com receita no período sem `ote_monthly_results`. Sintéticos exibem badge "Inativo" / "Excluído" e zeram somente campos OTE (multiplicador, base, acelerador, variável final) — mantêm `Comissão elegível comercial` e `Receita elegível OTE` reais.
- Subtotal Closers continua = soma SSoT histórica (que já bate com o total comercial do período).
- Card "Comissão elegível comercial" continua puxando do summary SSoT geral (não muda total agregado, só a distribuição por vendedor).

### 5. UI — Tabela Pré-vendas

- `leadsResults` recebe rows sintéticas equivalentes para SDRs históricos com qualificação no período mas sem `ote_monthly_results` (lendo `opportunity_qualification_history` no período, agrupado por `qualified_by_user_id`).
- Novo pequeno serviço `src/services/results/historicalQualifications.ts` que conta leads qualificados por SDR histórico no período (usado apenas para a tabela).

### 6. Transferência operacional na exclusão de usuário

- Localizar a rotina atual de exclusão/transferência e garantir que ela:
  - **NÃO** mexe em `opportunity_owner_history`, `opportunity_qualification_history`, `ote_monthly_results`, `ote_sales_records`.
  - Continua atualizando `opportunities.owner_user_id` apenas para registros operacionais (abertos), nunca para `won`/`lost` retroativamente.
- Acrescentar evento de auditoria `user_transferred_operational_ownership` em `system_events` / `audit_log` com `historical_results_preserved: true`.
- Esta etapa entra como mudança defensiva mínima; o problema histórico já está coberto pela camada de leitura.

### 7. Fora de escopo (explícito)

- `calculate-ote` edge function, `ote_sales_records`, regra item a item, view comercial base, Relatório Vendas Realizadas, Comissão Padrão e Metas Simples (já cobertos por sprints anteriores).

## Testes manuais

1. Wagner em maio/2026: subtotal "Comissão elegível comercial" cai dos R$ 506.722,07 para o valor real dele (esperado: ~R$ 467k, com R$ ~39k indo para Leandro André).
2. Leandro André aparece na tabela Closers com seu valor histórico e badge "Inativo/Excluído".
3. Ana aparece na tabela Pré-vendas com seus leads qualificados; Gustavo não herda.
4. `npx tsc --noEmit` passa limpo.
5. Total agregado de "Comissão elegível comercial" em maio/2026 permanece igual ao Relatório de Vendas Realizadas (apenas a distribuição por vendedor muda).

## Riscos

- View nova adiciona um JOIN lateral em `opportunity_owner_history` por linha — ok dado o índice `idx_ooh_org_opportunity_changed_at`.
- Se houver oportunidades sem `opportunity_owner_history` (não foi o caso na amostra), cai para `owner_user_id` atual marcado como `attribution_confidence='low'`.
- Nada do que muda toca a view base nem o pipeline de comissão/forecast; reversível removendo a view nova.
