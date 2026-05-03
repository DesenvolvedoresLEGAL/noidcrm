## Sprint NRHS 1.5 — Pente fino do Revenue Hygiene

Objetivo: deixar a aba apresentável e confiável — escopo comercial correto, nomes reais (conta/owner/estágio/pipeline), filtros saudáveis, NRHS calibrado, detalhe da oportunidade sem crash, e card NRHS do detalhe consistente com a aba.

### Diagnóstico (auditoria já feita)

Schema real confirmado:
- `pipelines.pipeline_type` existe: `sales`, `qualification`, `onboarding`, `renewal`.
- `stages` (não `pipeline_stages`) é a tabela ligada a `opportunities.stage_id` via FK.
- `accounts` tem `nome_fantasia` / `razao_social` (sem `name`/`trade_name`).
- Usuários ativos: `crm_active_users_view` (já é fonte oficial — Core memory).
- Opportunities tem campos NRHS reais (`nrhs_score`, `nrhs_tier`, `nrhs_metadata`, `nrhs_blockers`, `nrhs_gaps`, pilares individuais).
- Activities tem `opportunity_id`, `deleted_at`, `scheduled_date`, `completed_at`, `status`.

Causas dos sintomas:
1. RPC mínima 1.4.5 não enriquece nomes (placeholders UUID) e não filtra escopo comercial → tudo aparece, inclusive operacional.
2. Filtros do topo leem owners/stages dos placeholders.
3. Calculadora client (`calculateNRHSClient`) faz join com `stages(name)` errado (`stage:stages(name)` deveria funcionar, mas auto-cálculo dispara para toda opp aberta sem score, gerando 400 por RLS/relationship em algum estágio) e a fórmula é severa.
4. `NRHSBreakdown` espera `breakdown.pillars.integrity` etc., mas o `nrhs_breakdown` salvo vem como `nrhs_metadata` ou em formato diferente — `breakdown.pillars[...]` é `undefined` → `Cannot read properties of undefined (reading 'integrity')`.
5. Card sidebar usa `useNRHS` (calculadora client antiga) enquanto a aba usa `nrhs_score` persistido vindo da edge `calculate-nrhs` → divergência 0/1 vs valor real.

### Mudanças

#### 1. Migration única — recriar `get_nrhs_analytics` com joins seguros e escopo comercial

Mantém assinatura `get_nrhs_analytics(uuid, uuid, boolean, uuid)`. Internamente:

- LEFT JOIN explícito (SQL puro, sem nested select PostgREST):
  - `accounts a ON a.id = o.account_id AND a.organization_id = o.organization_id`
  - `pipelines p ON p.id = o.pipeline_id AND p.organization_id = o.organization_id`
  - `stages s ON s.id = o.stage_id AND s.organization_id = o.organization_id`
  - `crm_active_users_view u ON u.user_id = o.owner_user_id AND u.tenant_id = o.organization_id`
- **Escopo padrão comercial**: `p.pipeline_type IN ('sales','qualification')`.
- **Status padrão**: `o.status NOT IN ('won','lost','disqualified')` AND `o.deleted_at IS NULL`.
- Sem aliases internos chamados `value` (segue trava 1.4.5). Chave JSON `"value"` só em `jsonb_build_object`.
- Owner: `COALESCE(NULLIF(u.full_name,''), NULLIF(u.email,''), 'Sem responsável')`. Flag `is_inactive` = `u.user_id IS NULL AND o.owner_user_id IS NOT NULL`.
- Conta: `COALESCE(NULLIF(a.nome_fantasia,''), NULLIF(a.razao_social,''), 'Conta sem nome')`.
- Estágio: `COALESCE(NULLIF(s.name,''), 'Estágio não informado')`.
- Pipeline: `p.name` + `p.pipeline_type`.
- Tier derivado por `CASE` no SQL (Elite ≥90, Saudável 75-89, Em Risco 50-74, Crítico 25-49, Insalubre <25).
- **Valor em risco**: soma `valor_previsto` apenas para tiers `risk|critical|insalubrious`.
- Acrescenta no JSON retornado:
  ```json
  "filters": {
    "pipeline_options":[{id,name,pipeline_type}],
    "owner_options":[{user_id,full_name,is_inactive}],
    "stage_options":[{id,name,pipeline_id}],
    "applied_scope":"commercial",
    "included_pipeline_types":["sales","qualification"],
    "excluded_pipeline_types":["onboarding","renewal"]
  }
  ```
  Estas listas só incluem owners/stages/pipelines presentes no escopo aplicado, owners ativos por padrão (inativos só se ainda dono de deal aberto, marcados `is_inactive:true`).
- `summary/distribution/pillars/owners/deals` permanecem com mesma forma (mais campos: `account_name`, `owner_name`, `stage_name`, `pipeline_name`, `pipeline_type`, `is_inactive_owner`).
- `SECURITY DEFINER`, `SET search_path = public`, `GRANT EXECUTE ... TO authenticated`, membership check via `organization_members` quando `p_only_privileged=false` ou usuário não-admin.

#### 2. Migration — ajustar `enqueue_nrhs_recalc_for_filters` para escopo comercial

- Quando chamada da aba (sem owner específico além do filtro), enfileirar apenas opps com `pipelines.pipeline_type IN ('sales','qualification')`, status aberto, `deleted_at IS NULL`.
- Toast da aba: "NRHS em atualização para oportunidades comerciais abertas."

#### 3. Frontend — `RevenueHygieneDashboard`

- Adicionar barra de filtros acima da KPI:
  - Pipeline (multi): default = comerciais; opção "Incluir operacional".
  - Owner (lista vinda de `payload.filters.owner_options`, badge "Inativo").
  - Estágio (lista vinda de `payload.filters.stage_options`).
  - Faixa NRHS, Status (Abertas default; toggles para incluir Ganhas/Perdidas/Desqualificadas).
- Estado de filtros propagado para a RPC via parâmetros já existentes + filtragem client-side dos `deals` quando o filtro é apenas visual (tier/owner/stage/status). RPC retorna sempre o universo comercial; ampliações operacionais re-disparam RPC.

#### 4. Frontend — `useNRHSAnalytics` / `nrhs-analytics.ts`

- `mapRpcDeal`: passa a ler `account_name`, `owner_name`, `stage_name`, `pipeline_name`, `pipeline_type`, `is_inactive_owner`.
- Adiciona `pipelineName`, `pipelineType`, `isInactiveOwner` em `NRHSDeal`.
- Expor `filterOptions` no hook (vindo de `payload.filters`) consumido pela barra de filtros.

#### 5. Frontend — `NRHSDealsTable` e `NRHSByOwner`

- `NRHSDealsTable`: usar `accountName`/`ownerName`/`stageName` reais (sem prefixos "Conta XXX"). Badge "Inativo" quando `isInactiveOwner`.
- `NRHSByOwner`: renomear título para **"Higiene Comercial por Responsável"**. Esconder inativos por padrão; toggle "Mostrar inativos" no header.

#### 6. Calibragem v1.1 — `nrhs-calculator.ts`

Reescrever os 5 pilares com os pesos novos (Integridade 30, Cadência 25, Stakeholders 20, WinLoss 15, Aderência 10), regras dadas no brief, e:
- Não zerar pilar inteiro quando uma fonte falha (ex.: activities). Aplicar fallback `updated_at`.
- Decisor ausente em estágio inicial → **gap**, não blocker.
- Penalidades como descritas, mas piso por pilar = 0 (não negativo) e somente penalidades aplicadas conforme contexto do estágio.
- Separar saída em `blockers[]` e `gaps[]` distintos. Persistir em `opportunities.nrhs_blockers` (blockers reais) e `opportunities.nrhs_gaps`.
- Edge function `calculate-nrhs` usa a mesma calculadora (já é o caso) — ajustar lá também.

#### 7. Detalhe da oportunidade — fix do crash `metadata.integrity`

Criar `src/lib/scoring/normalizeNRHSMetadata.ts`:

```ts
export function normalizeNRHSMetadata(opp: any) {
  const m = opp?.nrhs_metadata ?? opp?.nrhs_breakdown ?? {};
  const p = m?.pillars ?? m ?? {};
  const pillar = (k: string, fallback?: string) => p?.[k] ?? (fallback ? p?.[fallback] : undefined) ?? { score: 0, issues: [], passed: [] };
  return {
    pillars: {
      integrity:        pillar('integrity', 'data_integrity'),
      cadence:          pillar('cadence'),
      stakeholders:     pillar('stakeholders'),
      winloss:          pillar('winloss', 'win_loss'),
      adherence:        pillar('adherence', 'process_adherence'),
      evidence:         pillar('evidence'),
    },
    blockers: opp?.nrhs_blockers ?? [],
    gaps: opp?.nrhs_gaps ?? [],
    recommendations: opp?.nrhs_recommendations ?? [],
    required_actions: m?.required_actions ?? [],
  };
}
```

- `NRHSSidebarCard` passa a ler `breakdown = normalizeNRHSMetadata(opportunity)` e nunca acessa `.integrity` direto.
- `NRHSBreakdown` usa o objeto normalizado.

#### 8. Detalhe — fix do erro 400 em `/activities`

Localizar o componente que dispara `from('activities').select('opportunity_id...')` no detalhe. Adicionar:
- Filtro `.is('deleted_at', null)`.
- Wrapping em try/catch + estado vazio.
- Sem propagar erro para o ErrorBoundary (retornar `[]` em falha).

#### 9. Card NRHS no detalhe = mesma fonte da aba

- Remover auto-cálculo client `calculateNRHSClient` no `useNRHS` (que estava sobrescrevendo `nrhs_score` com lógica antiga e gerando 1/0).
- Botão "Recalcular" do card chama `supabase.functions.invoke('calculate-nrhs', { body: { opportunity_id, organization_id }})` — mesma função usada pela edge oficial.
- Após recalcular: `invalidateOpportunity` + `queryClient.invalidateQueries({ queryKey: ['nrhs-analytics'] })`.

#### 10. Insights

- `generateNRHSInsights`: só emite quando há sinal real. Frase de "continue mantendo" só se `eliteCount + healthyCount` ≥ 60% do total.

### Arquivos impactados (pré-aprovação)

Migrations (2):
- `supabase/migrations/...recreate_get_nrhs_analytics_v15.sql`
- `supabase/migrations/...enqueue_nrhs_commercial_scope.sql`

Frontend:
- `src/services/crm/nrhs-analytics.ts` (mapper + tipos + filterOptions)
- `src/hooks/useNRHSAnalytics.ts` (expor filterOptions)
- `src/components/scoring/nrhs/RevenueHygieneDashboard.tsx` (barra filtros, toast)
- `src/components/scoring/nrhs/NRHSDealsTable.tsx` (nomes reais, badge inativo)
- `src/components/scoring/nrhs/NRHSByOwner.tsx` (rename + toggle inativos)
- `src/components/scoring/nrhs/NRHSInsightsPanel.tsx` (insights condicionais)
- `src/lib/scoring/normalizeNRHSMetadata.ts` (novo)
- `src/components/nrhs/NRHSSidebarCard.tsx` (usa normalizer + recalc via edge)
- `src/components/nrhs/NRHSBreakdown.tsx` (consome normalizado, pesos novos)
- `src/hooks/useNRHS.ts` (remover auto-cálculo client; recalc chama edge)
- `src/services/crm/nrhs-calculator.ts` (calibragem v1.1; blockers vs gaps)
- `supabase/functions/calculate-nrhs/index.ts` (alinhar fórmula v1.1; popular `nrhs_gaps`)
- Componente do detalhe que faz query `from('activities')` — corrigir filtro + try/catch (será localizado durante a execução).

### Travas mantidas

- Sem nested select PostgREST.
- Sem alias interno chamado `value` em CTE.
- Assinatura da RPC inalterada.
- `crm_active_users_view` é fonte única de usuários (Core memory).
- RLS multi-tenant respeitado em todos os JOINs (`organization_id` em cada lado).
- Não toca Lead Score, Opportunity Score, AI Win, Forecast, OTE, layout estrutural.

### Critérios de aceite

Os 30 itens da seção "Critérios de aceite" do brief, com foco em:
- Console limpo (sem ErrorBoundary `metadata undefined`, sem 400 de activities).
- Default = Pré-Vendas + Vendas abertas.
- Nomes reais em deals/owners/estágios.
- NRHS do card == NRHS da aba para a mesma opp.
- Botão "Atualizar NRHS" reprocessa apenas escopo comercial.
