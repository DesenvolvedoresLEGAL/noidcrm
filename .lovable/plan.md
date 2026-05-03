
# HOTFIX SCORING 1.4.2 — Aba Revenue Hygiene via RPC explícita

## Causa raiz confirmada

`src/services/crm/nrhs-analytics.ts` (linha 149-197) executa:
```
.from('opportunities').select(`..., accounts(...), stage:stages(name), profiles!opportunities_owner_user_id_fkey(full_name)`)
```
- Não existe FK formal `opportunities_owner_user_id_fkey` apontando para `profiles` (o vínculo lógico é `profiles.user_id = opportunities.owner_user_id`, mas a FK real, se houver, vai para `auth.users`). PostgREST devolve `PGRST200`.
- O erro "pipeline_stages" anterior era variação do mesmo padrão; a tabela correta no schema é `stages` (já corrigida), mas o nested select ainda quebra por `profiles`.
- `opportunities.stage_id` e `pipeline_id` são `text` (não uuid).

## Estratégia

Mover toda a leitura do dashboard NRHS para uma RPC `public.get_nrhs_analytics` que faz LEFT JOIN explícito (sem depender do PostgREST schema cache), retorna JSONB único com tudo que a tela precisa, e cai em fallback de owner se o profile não existir. Frontend deixa de fazer `.from('opportunities').select(...)` para alimentar a tela NRHS.

## Mudanças

### 1. Migração SQL

Criar `public.get_nrhs_analytics(p_org_id uuid, p_owner_id uuid default null, p_only_privileged boolean default true, p_caller_user_id uuid default null)` retornando `jsonb`:

- `SECURITY DEFINER`, `SET search_path = public`.
- Validação: `auth.uid()` precisa pertencer a `organization_members` ativo de `p_org_id`. Se não for privilegiado, força `owner_user_id = p_caller_user_id`.
- Base CTE `deals` com:
  ```
  opportunities o
  left join accounts a on a.id = o.account_id and a.organization_id = o.organization_id
  left join stages s   on s.id = o.stage_id  and s.organization_id = o.organization_id
  left join profiles p on p.user_id = o.owner_user_id and p.organization_id = o.organization_id
  where o.organization_id = p_org_id
    and o.deleted_at is null
    and o.status not in ('won','lost','disqualified')
  ```
- `owner_name` resolvido com fallback:
  ```
  coalesce(
    nullif(p.full_name,''),
    case when o.owner_user_id is null then 'Sem responsável'
         else 'Usuário ' || substring(o.owner_user_id::text,1,8)
    end
  )
  ```
  Nunca retorna NULL. Se `owner_user_id` é NULL → `'Sem responsável'`.
- `account_name` = `coalesce(nullif(a.nome_fantasia,''), nullif(a.razao_social,''), 'Sem empresa')`.
- `stage_name` = `coalesce(s.name, 'Sem estágio')`.
- Limite 500 deals (mesmo do código atual).
- Retorno JSONB com chaves: `summary`, `distribution`, `pillars`, `deals`, `owners`, `generated_at`. Insights/correlations continuam calculados no cliente (já são puros, dependem só de `deals`).

Estrutura de cada item em `deals` espelha `NRHSDeal` (id, title, account_name, owner_name, owner_user_id, value, stage_name, stage_id, opportunity_score, nrhs_score, nrhs_tier, nrhs_status, nrhs_issues_count, nrhs_blockers, pillar scores, last_reviewed_at, created_at).

`summary` calcula totalizadores e `value_at_risk` (NRHS<60) direto em SQL para baratear o frontend e bater com a primeira fila de cards. `distribution` é array por tier. `pillars` é objeto com média 0-100 normalizada por peso (mesma fórmula de `calculatePillarAverages`).

GRANT EXECUTE para `authenticated`. Sem GRANT para `anon`.

Criar também `public.enqueue_nrhs_recalc_for_filters(p_org_id uuid, p_owner_id uuid default null)` retornando `jsonb {enqueued, skipped}`:
- Itera as mesmas opportunities (sem nested select), insere em `nrhs_recalc_queue` respeitando o anti-duplicação de 2min já presente no trigger.
- `SECURITY DEFINER`, mesma validação de membership.

### 2. Frontend

`src/services/crm/nrhs-analytics.ts`
- Remover por completo `.from('opportunities').select(...)` em `fetchNRHSDeals`.
- Reescrever `fetchNRHSDeals` para chamar `supabase.rpc('get_nrhs_analytics', { p_org_id, p_owner_id: isAdmin ? null : userId, p_only_privileged: isAdmin, p_caller_user_id: userId })` e mapear `data.deals` para `NRHSDeal[]`.
- Exportar nova função `fetchNRHSAnalytics` que devolve o payload completo (`summary`, `distribution`, `pillars`, `deals`) para evitar dupla varredura no `useNRHSAnalytics`.
- `calculateNRHSKPIs`, `calculateTierDistribution`, `calculatePillarAverages` continuam existindo como fallback puro a partir de `deals` (caso o consumidor só tenha array). `useNRHSAnalytics` passa a preferir `summary`/`distribution`/`pillars` vindos da RPC quando disponíveis, mantendo o cálculo client-side só como fallback.

`src/hooks/useNRHSAnalytics.ts`
- Substituir `fetchNRHSDeals` por `fetchNRHSAnalytics` e usar diretamente `summary`, `distribution`, `pillars` do payload.
- `useNRHSKPIs` idem (chama RPC e devolve `data.summary`).
- Manter `usePrivateQueryEnabled` e a chave atual `nrhsAnalyticsKeys`.

`src/components/scoring/nrhs/RevenueHygieneDashboard.tsx`
- `handleRecalcAll` passa a chamar `supabase.rpc('enqueue_nrhs_recalc_for_filters', { p_org_id: organization.id, p_owner_id: filters.ownerId ?? null })` em vez de `insert` direto na fila. Mantém o disparo best-effort de `process-nrhs-queue`.
- Mensagem de erro vs vazio já está separada (bloco `error` + estado vazio nos componentes filhos); adicionar texto explícito "Nenhuma oportunidade aberta encontrada para os filtros atuais." quando `!error && deals.length === 0`.

`src/services/crm/nrhs-calculator.ts`
- Linhas 311-318 (`calculateNRHSClient`) e 446-456 (`saveNRHSResult`): permanecem. NÃO fazem nested select problemático; `stage:stages(name)` é o único join e usa relação real `opportunities.stage_id text → stages.id text`. Se o schema cache também rejeitar essa relação após a mudança, removeremos o join e buscaremos `stages` em query separada por `stage_id`. (Verificação será feita ao executar.)

### 3. Realtime

`useNRHSAnalyticsRealtime` continua igual — invalida `['nrhs-analytics']` e `['nrhs-kpis']`, que agora reexecutam a RPC.

### 4. Fora de escopo (intocado)

Lead Score, Opportunity Score, motor NRHS (cálculo individual de pilares), Forecast, OTE, layout, fórmulas de score.

## Critérios de aceite (espelham o pedido)

- Console sem `Could not find a relationship between 'opportunities' and 'profiles'`.
- Console sem GET `/rest/v1/opportunities?select=...profiles...` ao abrir aba NRHS.
- Cards superiores, distribuição, pilares, tabela de deals, owner ranking carregam via RPC.
- Owner sem profile aparece como "Usuário XXXXXXXX"; sem owner aparece como "Sem responsável".
- Estado de erro (alerta vermelho + Tentar novamente) ≠ estado vazio (mensagem neutra).
- Botão "Atualizar NRHS" usa RPC `enqueue_nrhs_recalc_for_filters`, sem nested select.
- RLS multi-tenant respeitado via validação de membership na RPC.

## Riscos

- Se houver opportunities com `owner_user_id` apontando para usuários sem `profiles` na mesma `organization_id`, fallback "Usuário XXXXXXXX" será exibido (esperado).
- A migração precisa garantir `pg_get_functiondef` idempotente (`CREATE OR REPLACE`).
- `calculateNRHSClient` ainda usa `stage:stages(name)`. Se aparecer PGRST sobre essa relação ao recalcular um deal individual, faremos query em duas etapas. Sem mudança preventiva agora para manter o hotfix focado.
