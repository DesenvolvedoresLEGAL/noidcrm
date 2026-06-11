# Sprint REL V2.11 — Qualidade de Qualificação SDR → Proposta → Venda

## Objetivo
Medir qualidade real do pré-vendas (não só volume): quantos SQLs viraram proposta, foram ganhos, perdidos ou morreram sem proposta. Corrigir transversalmente o problema de "Desconhecido" em SDR, Handoff, Closer e Performance.

## Entregas

### 1. Backend — Views V2 (migration)

**`public.v_user_display_resolver_v2`** — Resolução canônica de nomes
- Une `profiles` (ativos) + snapshots históricos disponíveis (`opportunity_owner_history`, `opportunity_qualification_history`, `auth_audit_log`) para recuperar nome de usuários removidos.
- Campos: `user_id, display_name, user_status, is_active, is_deleted, resolved_from`.
- Regras: ativo → nome; removido com histórico → "Nome (removido)"; removido sem histórico → "Usuário removido"; null real → "Sem responsável". Nunca retorna "Desconhecido".

**`public.v_report_qualification_quality_v2`** — Unidade = SQL (oportunidade qualificada)
- Base: `v_reporting_opportunities_v2` + `v_opportunity_first_qualification_v2` + `v_opportunity_amounts_v2` + `v_loss_classification_v2` + `proposals` + `commercial_won_revenue_view`.
- Regras:
  - SQL qualificado = `first_qualification_at IS NOT NULL` OR `qualified_by_user_id IS NOT NULL`.
  - Com proposta = existe proposta vinculada (incluindo cadeia de duplicação/herdada).
  - Ganho/Perdido = status oficial V2.
  - Receita = `valid_revenue_amount` da `commercial_won_revenue_view` (líquido, sem cancelamentos).
- Campos: `organization_id, sdr_user_id, sdr_name, sdr_status, qualified_count, with_proposal_count, without_proposal_count, won_count, lost_count, open_count, valid_revenue_amount, sql_to_proposal_rate, proposal_to_won_rate, sql_to_won_rate, post_qualification_loss_rate, avg_hours_qualification_to_proposal, avg_days_qualification_to_close`.
- Grants: SELECT para `authenticated`; ALL para `service_role`. Security invoker para herdar RLS das views base.

### 2. Edge Function — `report-qualification-quality-v2`
Input: `organizationId, dateRange, sdrUserIds[], closerUserIds[], status[], proposalStatus[], includeRemovedUsers, teamVisibility`.
Output: `{ summary, rows[], drilldown?, meta, confidence }`.
- `confidence`: `trusted | partial | warning` baseado em consistência de `qualified_at`, links de proposta e resolver.
- Filtros aplicados em SQL parametrizado sobre a view; drilldown lista oportunidades (cliente, oportunidade, datas, SDR, closer, proposta, status, motivo perda, receita válida, dias desde qualificação).

### 3. Frontend

**Nova subaba** em `Relatórios > Desempenho > Handoff` (`ReportTabs.tsx`): adicionar entry `qualification-quality` rotulada "Qualidade de Qualificação".

**Componentes novos:**
- `src/components/reports/qualification/QualificationQualityReportV2.tsx` — Cards (SQLs, com proposta, sem proposta, ganhos, perdidos, receita válida, taxa SQL→Proposta, taxa SQL→Venda) + tabela por SDR + filtros.
- `src/components/reports/qualification/QualificationDrilldownDialog.tsx` — Drilldown ao clicar SDR.
- `src/components/reports/qualification/QualificationFilters.tsx` — período, SDR, closer, status, proposta sim/não, ganho/perdido/aberto, usuário ativo/removido, origem, pipeline.
- `src/hooks/reports/useQualificationQualityV2.ts` — invoca edge function com React Query.

**Helper compartilhado de display:**
- `src/lib/userDisplay.ts` + `src/hooks/useUserDisplayResolver.ts` consumindo `v_user_display_resolver_v2`. Badge `<RemovedUserBadge />`.

**Correções nas telas existentes (mínimas, sem deletar):**
- SDR Report: trocar fallback "Desconhecido" pelo resolver; receita atribuída via `commercial_won_revenue_view`; não esconder leads sem proposta.
- Handoff Report: pares SDR→Closer via resolver; "Sem closer atribuído" quando null.
- Closer Report: resolver + filtrar usuários removidos do ranking por default; filtro "incluir removidos".
- Performance Report: resolver para receita histórica.

### 4. Memória
Atualizar `mem://index.md` com regras: (a) unidade SQL para qualidade de qualificação; (b) `v_user_display_resolver_v2` é fonte única de nome — proibir fallback "Desconhecido".

## Critérios de aceite
1-10 conforme spec do usuário. Cenário de teste: SDR com 10 qualificados (2 proposta, 6 perdidos, 2 sem proposta) → 20% SQL→Proposta, 60% perda pós-qualificação.

## Regressões protegidas
- Vendas Realizadas continua em receita válida.
- Cancelamentos não entram como receita.
- Período usa fim do dia.

## Arquivos impactados (resumo)
**Novos:** 1 migration, 1 edge function, 5 arquivos frontend (report + drilldown + filters + hook + helper), 1 memória.
**Editados:** `ReportTabs.tsx`, SDR/Handoff/Closer/Performance reports (apenas troca de label/fallback).

## Riscos
- Snapshot histórico de nome depende de tabelas com dados parciais — confidence sinaliza isso.
- View pode ficar pesada; planejo `WHERE organization_id = $1` empurrado e índices existentes em `opportunities(qualified_by_user_id, first_qualification_at)` (validar via linter pós-migration).
- Resolver alterando telas existentes pode mudar visualização para usuários que hoje aparecem como "Desconhecido" — comportamento esperado.

## Próximos passos
1. Aprovar plano.
2. Migration (resolver + view + grants).
3. Edge function + hook + tela nova.
4. Patches leves SDR/Handoff/Closer/Performance.
5. Validar cenário de teste com dados reais via `supabase--read_query`.
