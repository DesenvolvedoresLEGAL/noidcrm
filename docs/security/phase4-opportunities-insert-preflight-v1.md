# Fase 4 — Pre-flight de INSERT em `public.opportunities` (NSEC-1.2-CHG-011)

Sprint: NOID-SECURITY 1.2
Classificação: **VERDE — auditoria read-only.** Zero writes, zero migrations,
zero RPCs novas, zero policies/triggers alterados, zero fixtures criadas.
Ambiente: projeto Lovable Cloud único de produção (ref `urihdqturaebhiefwjnw`).

## 1. Escopo

Determinar viabilidade de uma futura canary de INSERT em `public.opportunities`
usando o mesmo padrão homologado em `accounts` e `contacts` (RPC temporária
`SECURITY INVOKER` + JWT real sintético + rollback interno). Nenhuma
oportunidade foi criada nesta mudança.

## 2. Tabela e campos (113 colunas)

Fonte: `information_schema.columns` em `public.opportunities`.

- **NOT NULL sem default (payload obrigatório do cliente):**
  - `title text` (uppercase forçado por `trg_opportunity_title_upper`).
  - `organization_id uuid` (tenant — pilar do RLS).
- **NOT NULL com default (não exige envio):**
  - `id uuid DEFAULT gen_random_uuid()`.
  - `requires_seller_classification boolean DEFAULT false`.
  - `opportunity_score_metadata jsonb DEFAULT '{}'`.
  - `deal_health_metadata`, `risk_metadata`, `engagement_metadata`,
    `velocity_metadata`, `ai_win_probability_metadata`, `nrhs_gaps`,
    `nrhs_recommendations`, `nrhs_metadata` — todos `jsonb NOT NULL`
    com default `{}` / `[]`.
- **Nullable com default operacional relevante:**
  - `status text DEFAULT 'new'` — status neutro seguro (ver Fase F/H).
  - `prob int DEFAULT 50` (sobrescrito por `sync_prob_on_stage_change`
    caso o `stage_id` informado tenha `probability` definido).
  - `temperatura text DEFAULT 'warm'`, `temperature text DEFAULT 'warm'`.
  - `automation_enabled boolean DEFAULT true` — deverá ser `false`
    no probe para desligar automações opcionais.
  - `created_at`, `updated_at` — `now()`.
- **Nullable sem default (relevantes para probe):**
  - `account_id`, `contact_id`, `owner_user_id`, `pipeline_id text`,
    `stage_id text`, `close_date_prevista`, `valor_previsto`,
    `created_by` (preenchido por trigger `opportunities_set_created_by`),
    `qualified_at`, `qualified_by_user_id`, `source_opportunity_id`,
    `accepted_proposal_id`, `loss_reason_id`, `client_loss_reason_id`,
    `deleted_at`, `won_at`, `lost_at`, `closed_at`.

Todos os campos NRHS / scoring / vibe / handoff / trial / plg / remarketing /
event_start_date / event_end_date são opcionais e não precisam ser enviados
para o INSERT mínimo.

### 2.1 Payload mínimo tecnicamente válido

Descrição funcional apenas (nenhum valor real):

- `title`: qualquer texto sintético (será uppercased).
- `organization_id`: UUID da organização sintética.
- `pipeline_id`: id `text` de pipeline sintético da mesma organização.
- `stage_id`: id `text` de stage sintético pertencente ao pipeline acima.
- `account_id`: opcional (nullable no schema; deve ser sintético + mesma org
  para exercer a matriz de cross-tenant).
- `contact_id`: opcional (nullable; se enviado, precisa pertencer ao mesmo
  tenant e — para consistência — à mesma account).
- `owner_user_id`: opcional (nullable). Se `NULL` no probe, evita o
  side effect de notificação por `notify_opportunity_changes`
  (`create_system_notification` não persiste quando `user_id IS NULL`
  pela FK do notifications). Recomendado enviar `NULL` no probe para
  minimizar rastros.
- `status`: `'new'` — status **neutro seguro** (não dispara segment
  benchmark, revenue events de win/loss, forecast outcome nem lifecycle).
- `automation_enabled`: `false` — segurança extra em auto-tasks.
- `deleted_at`: `NULL`.

Todos os demais campos assumem seus defaults.

## 3. Foreign keys

| Constraint | Referência | `ON DELETE` | Nullable | Proteção tenant-aware |
|---|---|---|---|---|
| `opportunities_organization_id_fkey` | `organizations(id)` | NO ACTION | NO | Sim (RLS INSERT `WITH CHECK` casa `get_user_organization_id()`) |
| `opportunities_account_id_fkey` | `accounts(id)` | CASCADE | YES | **Não** (FK só valida existência do UUID). Sem trigger que exija `accounts.organization_id = opportunities.organization_id` |
| `opportunities_contact_id_fkey` | `contacts(id)` | SET NULL | YES | **Não** (FK só valida existência do UUID) |
| `opportunities_pipeline_id_fkey` | `pipelines(id)` | NO ACTION | YES | **Não** (FK só valida existência). Sem trigger que exija `pipelines.organization_id = opportunities.organization_id` |
| `opportunities_stage_id_fkey` | `stages(id)` | NO ACTION | YES | **Não** (FK só valida existência). Não há trigger exigindo `stages.pipeline_id = opportunities.pipeline_id` |
| `opportunities_accepted_proposal_id_fkey` | `proposals(id)` | SET NULL | YES | não relevante para INSERT mínimo |
| `opportunities_loss_reason_id_fkey` | `loss_reasons(id)` | SET NULL | YES | não relevante para INSERT mínimo |
| `opportunities_client_loss_reason_id_fkey` | `loss_reasons(id)` | NO ACTION | YES | não relevante para INSERT mínimo |
| `opportunities_source_opportunity_id_fkey` | `opportunities(id)` | NO ACTION | YES | **Trigger `trg_opportunities_qualification_gate`** exige checklist da origem se pipeline destino for `sales`. Manter `NULL` no probe |
| `opportunities_created_by_fkey` | `auth.users(id)` | NO ACTION | YES | preenchido por trigger `opportunities_set_created_by` a partir de `auth.uid()` |
| `fk_opportunities_plg_organization` | `organizations(id)` | SET NULL | YES | não relevante para INSERT mínimo |

**Achado A (documentar como observação, não corrigir nesta fase):** A
proteção tenant-aware para `account_id`, `contact_id`, `pipeline_id` e
`stage_id` **não existe no nível do banco** (nem policy de INSERT em
opportunities, nem trigger BEFORE). O único guard é a policy de `SELECT`
em cada tabela referenciada, que impede o usuário atacante de *descobrir*
UUIDs cross-org. Um atacante que já conheça o UUID cross-org por outro
meio consegue vinculá-lo. Este risco será exercitado pela matriz da
canary futura.

## 4. Pipeline e stage

- `pipeline_id` **NÃO é obrigatório** no schema (nullable, sem default).
- `stage_id` **NÃO é obrigatório** no schema (nullable, sem default).
- Não há default automático server-side. O default é aplicado apenas pelo
  cliente (`src/services/supabase/opportunities.ts` §326–386), que
  consulta `pipelines` e `stages` do tenant e escolhe o mais antigo.
- Trigger `sync_prob_on_stage_change` (BEFORE INSERT/UPDATE OF stage_id):
  copia `stages.probability` para `opportunities.prob` quando `stage_id`
  for informado.
- Trigger `trg_opportunities_qualification_gate` (BEFORE INSERT): só
  bloqueia INSERT quando `source_opportunity_id IS NOT NULL` **e** o
  pipeline destino é `pipeline_type='sales'`. Para o probe, mantendo
  `source_opportunity_id=NULL`, o gate é neutro.
- `pipelines` e `stages` são **por tenant** (`organization_id NOT NULL`
  em 17/17 pipelines e 98/98 stages; conferido).
- Policies de INSERT em `pipelines` e `stages` exigem
  `organization_id = get_user_organization_id()` — não há bypass.
- **Organizações sintéticas (`NOID_SECURITY_ORG_A/B`) não possuem
  pipelines nem stages próprios** (verificado; 0 rows).
- Não é aceitável reutilizar pipeline/stage de tenant real (violaria
  guardrail #8 "zero dados reais alterados", já que uma canary
  `ALLOWED_ROLLED_BACK` reverte a linha em `opportunities` mas *não*
  reverte side effects já enfileirados em queues que consumam o
  `pipeline_id`).

**Conclusão:** serão necessárias fixtures sintéticas de pipeline + stage
inicial por organização — ver §11.

## 5. Account e contact

- `account_id` opcional. `contact_id` opcional.
- **A regra `Opportunity Org A + Account B` NÃO é bloqueada pelo banco
  hoje** (achado A, §3). Estruturalmente o INSERT passa se o atacante
  souber o UUID da Account B.
- **A regra `Opportunity Org A + Contact Org B` NÃO é bloqueada pelo
  banco hoje** (achado A, §3).
- Não há trigger validando `contacts.account_id = opportunities.account_id`.
- Não há filtro por `deleted_at IS NULL` em nenhuma FK ou trigger para
  bloquear account/contact soft-deletados.

As duas accounts-base sintéticas (`SECURITY_TEST_ACCOUNT_ORG_A_BASE`
`36085a30-…-d92b` e `…ORG_B_BASE` `b777baac-…-9f41`) podem ser
reutilizadas na canary futura. Contatos-base sintéticos permanentes
ainda não existem (contatos criados na canary CHG-009/010 foram todos
`ROLLED_BACK`).

## 6. Policies RLS

Total: 6 policies em `public.opportunities` (todas permissivas, nenhuma
restritiva).

| Comando | Nome | Roles | Expressão relevante |
|---|---|---|---|
| SELECT (`r`) | `opportunities_select_by_visibility` | PUBLIC | `organization_id = get_user_organization_id() AND (can_view_all(uid) OR owner_user_id=uid OR (is_team_manager(uid) AND owner_user_id = ANY(get_team_member_ids(uid))))` |
| INSERT (`a`) | `Org members can insert opportunities` | authenticated | `WITH CHECK organization_id IN (SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid() AND om.status='active')` |
| INSERT (`a`) | `Org members insert opportunities` | PUBLIC | `WITH CHECK organization_id IS NOT NULL AND auth.uid() IS NOT NULL AND organization_id = get_user_organization_id()` |
| INSERT (`a`) | `Users can insert org opportunities` | authenticated | `WITH CHECK organization_id IS NOT NULL AND auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM organization_members WHERE user_id=auth.uid() AND organization_id=opportunities.organization_id AND status='active')` |
| UPDATE (`w`) | `Org members update opportunities` | PUBLIC | `USING/CHECK organization_id = get_user_organization_id()` |
| DELETE (`d`) | `Admins and managers can delete org opportunities` | authenticated | `USING EXISTS(SELECT 1 FROM organization_members ... org_role IN ('owner','admin','manager'))` |

**Análise de INSERT:**

1. `WITH CHECK` presente em todas.
2. Todas exigem `auth.uid()`.
3. Todas exigem membership ativo na organização informada.
4. `get_user_organization_id()` retorna **apenas 1 organização** (por
   `LIMIT 1` — usuário em duas orgs vê só a primeira ativa).
5. As três policies permissivas se combinam por `OR`. Como todas
   convergem para "mesma organização + membership ativo", a combinação
   é segura para cross-org.
6. **Nenhuma policy diferencia `org_role`.** Viewer, cs, sales, manager,
   admin e owner passam identicamente pela lógica de INSERT.
7. **Nenhuma policy RESTRICTIVE existe.**
8. Não há `USING (true)`. Não há bypass para platform admin no INSERT
   (bypass só existe em RLS de leitura de admin_access_logs / audit).
9. Service role isolado (não usado pelo frontend).

### 6.1 Matriz estática esperada por papel

| Papel | Same-org (Acc/Contact same-org) | Same-org sem Acc/Contact | Account cross-org | Contact cross-org | Org cross-org (`organization_id` fake) | `organization_id = NULL` | Sem membership |
|---|---|---|---|---|---|---|---|
| owner | ALLOW | ALLOW | **ALLOW (achado A)** | **ALLOW (achado A)** | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| admin | ALLOW | ALLOW | **ALLOW (achado A)** | **ALLOW (achado A)** | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| manager | ALLOW | ALLOW | **ALLOW (achado A)** | **ALLOW (achado A)** | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| sales | ALLOW | ALLOW | **ALLOW (achado A)** | **ALLOW (achado A)** | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| cs | ALLOW | ALLOW | **ALLOW (achado A)** | **ALLOW (achado A)** | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| **viewer** | **ALLOW** (⚠️ vs SEC-011/SEC-012 padrão) | **ALLOW** (⚠️) | **ALLOW** (⚠️) | **ALLOW** (⚠️) | BLOCK RLS | BLOCK RLS | BLOCK RLS |
| platform admin sem membership | BLOCK RLS | BLOCK RLS | BLOCK RLS | BLOCK RLS | BLOCK RLS | BLOCK RLS | BLOCK RLS |

**Achado B — SEC-013 candidato (não corrigido nesta fase):** viewer
insere oportunidades pela policy atual, exatamente o mesmo padrão de
role escalation já corrigido em `accounts` (SEC-011) e `contacts`
(SEC-012). Recomendação futura: introduzir policy RESTRICTIVE
`nsec12_opportunities_insert_block_viewer` seguindo o mesmo template.

**Achado A — cross-tenant via FK sem tenant-check** persiste para
`account_id`, `contact_id`, `pipeline_id`, `stage_id`. Recomendação
futura: adicionar trigger `BEFORE INSERT` que valide
`organization_id` das entidades vinculadas.

## 7. Triggers e efeitos derivados (INSERT-time)

Triggers que disparam em INSERT (16 identificados):

| Nome | Timing | Efeito | Externo? | Reversível em rollback? |
|---|---|---|---|---|
| `opportunities_set_created_by` | BEFORE | `NEW.created_by := auth.uid()` | não | sim |
| `trg_opportunity_title_upper` | BEFORE | uppercase título | não | sim |
| `sync_prob_on_stage_change` | BEFORE | `NEW.prob := stages.probability` | não | sim |
| `trg_opportunities_qualification_gate` | BEFORE | gate só ativo se `source_opportunity_id NOT NULL`; RAISE se pipeline sales com checklist incompleto | não | sim (RAISE aborta tx) |
| `log_opportunity_events_trigger` | AFTER | `PERFORM log_system_event(...)` → INSERT em `system_events` | não | sim (mesma tx) |
| `tr_opportunity_revenue_event` | AFTER | INSERT em `revenue_events` com `event_type='opportunity_created'` | não | sim (mesma tx) |
| `track_opportunity_changes_trigger` | AFTER | INSERT em `audit_log` com `action='opportunity_created'` | não | sim |
| `trigger_notify_opportunity_changes` | AFTER | `create_system_notification(...)` → INSERT em `notifications` | não | sim. Se `owner_user_id=NULL`, FK de `notifications.user_id` **falha** e aborta o INSERT. Probe **deve** enviar `owner_user_id NULL` **e** desabilitar este trigger é proibido. Alternativa: `owner_user_id` = usuário sintético dono do probe. |
| `trg_indicators_opportunity` | AFTER | INSERT em `opportunity_indicators_recalc_queue` | não | sim |
| `trg_lsrq_opportunities_iud` | AFTER | INSERT em `lead_score_recalc_queue` (dedup 2min) | não | sim |
| `trg_nrhs_enqueue_opportunities` | AFTER | INSERT em `nrhs_recalc_queue` | não | sim |
| `trg_osrq_opportunities_iud` | AFTER | INSERT em `opportunity_score_recalc_queue` | não | sim |
| `trg_track_opportunity_owner_history` | AFTER | INSERT em `opportunity_owner_history` | não | sim |
| `trg_track_opportunity_qualification_history` | AFTER | INSERT em `opportunity_qualification_history` (só se `qualified_at NOT NULL`) | não | sim |
| `trg_track_opportunity_stage_history` | AFTER | INSERT em `opportunity_stage_history` | não | sim |
| `trg_segment_benchmark_refresh` | AFTER | **`net.http_post` para Edge Function** — só executa quando `NEW.status IN ('won','lost')`. Para `status='new'` retorna imediatamente | **potencialmente sim, mas guardado por status** | não aplicável ao probe (status neutro) |
| `trigger_account_lifecycle_on_qualification` | AFTER | UPDATE em `accounts.lifecycle_stage` — só se `qualified_at NOT NULL AND source_opportunity_id NOT NULL AND account_id NOT NULL` | não | sim (probe evita ao deixar `qualified_at NULL`) |
| `trigger_opp_acc_score` | AFTER | UPDATE em `accounts.score_updated_at := NULL` (WHEN `account_id IS NOT NULL`) | não | sim |

**Nenhum trigger de INSERT chama Edge Function/webhook quando
`status='new'`.** O único ponto de egress (`trg_segment_benchmark_refresh`)
está protegido por guard de status.

**Valores proibidos no probe:**
- `status IN ('won','lost')` — dispara egress externo, revenue win/loss,
  forecast outcome, sync proposals, kairos attribution.
- `qualified_at NOT NULL` combinado com `source_opportunity_id NOT NULL`
  e `account_id NOT NULL` — muta `accounts.lifecycle_stage` (embora
  reversível, é side effect indesejado).
- `source_opportunity_id NOT NULL` para pipeline sales — pode disparar
  `QUALIFICATION_GATE_BLOCKED` de forma imprevisível (não é falha de
  segurança, mas polui o resultado do probe).
- Stages sinalizadas como `is_qualified_stage=true` — só relevantes em
  UPDATE, mas manter fora do stage inicial mesmo assim.

## 8. Egress externo

Caminho de INSERT com `status='new'`, `owner_user_id != NULL`,
`qualified_at=NULL`, `source_opportunity_id=NULL`, `automation_enabled=false`:

- `pg_net` / `net.http_post` / `net.http_get`: **não disparados**
  (segment benchmark trigger sai cedo por status guard).
- Webhook / Slack / e-mail / Edge Function direta: **não disparados**.
- Filas (`lead_score_recalc_queue`, `nrhs_recalc_queue`,
  `opportunity_score_recalc_queue`, `opportunity_indicators_recalc_queue`):
  inserções **transacionais** — revertidas no rollback interno da RPC.
- Realtime broadcast (`supabase_realtime`): a inserção é publicada, mas
  sob rollback dentro da mesma transação a linha nunca é comitada, então
  o WAL não a exporta para clientes.
- Outbox pattern: nenhum trigger de INSERT em opportunities alimenta
  outbox consumível por processo externo.

Classificação final: **TRANSACIONAL E REVERSÍVEL** para o payload mínimo
proposto. Nenhum efeito externo não reversível identificado.

## 9. Soft delete e status

- `deleted_at timestamptz NULL` — soft-delete implementado por
  `soft_delete_opportunity_trigger` (BEFORE DELETE). INSERT com
  `deleted_at=NULL` é neutro.
- `status` default `'new'`.
- Status seguros para probe: `'new'`.
- Status que disparam automações pesadas: `'won'`, `'lost'` (revenue
  events com `revenue_impact`, segment benchmark egress, forecast
  outcome, kairos attribution, sync proposals, account lifecycle,
  cleanup on close, KB rescore, experiment runs, notifications
  específicas).
- Oportunidade nova com `status='new'` **entra em Forecast**? Não como
  contribuição de won/lost; entra apenas nas queues de recálculo
  (`opportunity_score_recalc_queue`). Como o INSERT é revertido, o worker
  pode picar a linha da queue e não achar a oportunidade — comportamento
  aceitável e observado no padrão de accounts/contacts.
- Rollback interno da RPC (`RAISE EXCEPTION` após INSERT) desfaz
  atomicamente todas as inserções em queues e histórias.

## 10. Código da aplicação

Fonte: `src/services/supabase/opportunities.ts` §326–440.

- Caminho real: `createOpportunity(dto)`:
  1. Valida com `opportunitySchema` (Zod).
  2. `supabase.auth.getUser()` — exige autenticação.
  3. `supabase.rpc('get_user_organization_id')`.
  4. Normaliza `prob` (aceita 0-1 ou 0-100).
  5. Se `pipeline_id`/`stage_id` ausentes, escolhe o mais antigo da org.
  6. `resolvedOwner`: tenta `claim_next_owner_v2`, fallback `user.id`.
  7. Monta `insertData` com campos: `title, account_id, contact_id,
     pipeline_id, stage_id, produto, valor_previsto, owner_user_id,
     status, temperature, prob, urgency_score, automation_enabled,
     organization_id, close_date_prevista, origem`.
  8. `.from('opportunities').insert(insertData).select().single()`.
- Server-side (via triggers): `created_by`, `title` (uppercase), `prob`
  (sync do stage).
- Regras existentes **apenas no frontend** (não replicadas no banco):
  - Escolha do pipeline default por `organization_id` (o banco não
    garante que o `pipeline_id` enviado pertença ao tenant — achado A).
  - Escolha do stage inicial (`order_index ASC`).
  - Normalização de `prob` 0-1 → 0-100.
  - `owner_user_id` fallback para `user.id` (banco aceita NULL).
- **Divergência frontend × banco (achado A):** frontend confia que o
  pipeline/stage/account/contact selecionados pertencem à mesma
  organização. Um cliente PostgREST direto pode adulterar. Não existe
  validação server-side.
- Todas as chamadas ao PostgREST usam a policy de INSERT — não há uso
  de service role no caminho.
- Nenhuma Edge Function é chamada durante o INSERT (recálculos são
  disparados por hooks separados após o retorno).

## 11. Fixtures necessárias

| Fixture | Status | Ação futura |
|---|---|---|
| Organizações sintéticas A/B | ✅ existentes | reutilizar |
| Usuários sintéticos por papel (12) | ✅ existentes | reutilizar |
| Accounts-base A/B | ✅ existentes (`36085a30-…`, `b777baac-…`) | reutilizar |
| Contacts-base A/B permanentes | ❌ ausentes | criar via Edge Function `nsec12-provision-fixtures` (extensão) — 1 contato por org, prefixo `SECURITY_TEST_CONTACT_ORG_<A|B>_BASE`, ligado à account-base |
| **Pipelines sintéticos A/B** | ❌ ausentes | criar `SECURITY_TEST_PIPELINE_ORG_<A|B>` (id text `sec-test-pipeline-<a|b>`, `pipeline_type='sales'`, `is_primary=false`, `organization_id`=respectivo) via Edge Function |
| **Stages sintéticas iniciais A/B** | ❌ ausentes | criar 1 stage por pipeline (`sec-test-stage-<a|b>-initial`, `order_index=0`, `probability=10`, **não** `is_qualified_stage`, **não** de fechamento) |

Cada fixture deve ser provisionada em uma mudança AMARELA separada
(NSEC-1.2-CHG-012 provável) com cleanup runbook próprio. Nenhuma delas
é criada nesta fase.

### 11.1 Efeitos derivados das fixtures

- Criar pipeline/stage não dispara egress externo (triggers ausentes de
  INSERT em `pipelines`/`stages`, salvo `set_created_by` e updated_at).
- Criar contacts-base já foi ensaiado em CHG-009/010 e volta a
  transitar apenas por `lead_score_recalc_queue` (dedup 2min) e queues
  transacionais.
- Cleanup previsto: `DELETE` das linhas sintéticas pelo prefixo, mesmo
  padrão do runbook existente.

## 12. Proposta de futura RPC (não criada)

Nome: `public.nsec12_probe_insert_opportunity(...)`.

Modo: `SECURITY INVOKER`, `SET search_path=public`, `LANGUAGE plpgsql`.

Guardas rígidos (aborta com `RAISE EXCEPTION` antes do INSERT se falhar):
- `auth.uid()` presente.
- E-mail do invoker em `auth.users` casa regex `^sec-test-[ab]-(owner|admin|manager|sales|viewer|cs)@example\.com$`.
- `p_organization_id IN (fixed_org_a_uuid, fixed_org_b_uuid)`.
- `p_pipeline_id IN (allowed synthetic pipelines only)`.
- `p_stage_id IN (allowed synthetic stages only)`.
- `p_account_id IS NULL OR p_account_id IN (allowed synthetic accounts)`.
- `p_contact_id IS NULL OR p_contact_id IN (allowed synthetic contacts)`.
- `p_title LIKE 'SECURITY_TEST_%'`.
- `p_status='new'` (proibir 'won','lost','qualified').
- `p_source_opportunity_id IS NULL`.
- `p_qualified_at IS NULL`.

Parâmetros mínimos: `p_organization_id uuid, p_pipeline_id text,
p_stage_id text, p_account_id uuid, p_contact_id uuid,
p_owner_user_id uuid, p_title text, p_expect text`
(`'allow'|'block'`).

Fluxo:
1. Validar guards; se falha → RETURN `'GUARD_REJECTED:<motivo>'`.
2. `BEGIN` → INSERT em `opportunities` (com fixos: `status='new'`,
   `automation_enabled=false`, `deleted_at=NULL`, `prob=10`,
   `temperature='warm'`).
3. Capturar `id` retornado.
4. `RAISE EXCEPTION 'NSEC12_ROLLBACK' USING ERRCODE='P0001'`
   dentro de bloco `BEGIN … EXCEPTION WHEN OTHERS THEN…` que
   converte para retorno estruturado.
5. Retornar códigos: `ALLOWED_ROLLED_BACK`, `BLOCKED_RLS`,
   `BLOCKED_FK`, `BLOCKED_TRIGGER:<nome>`, `GUARD_REJECTED:<motivo>`.

Efeitos abrangidos pelo rollback: todos os INSERTs em queues,
histórias, audit_log, revenue_events, system_events, notifications
(porque `owner_user_id` no probe será um usuário sintético válido — a
FK de notifications é satisfeita, e a linha some no rollback).

Cenários que a RPC **não** pode bloquear internamente e devem ser
exercitados pela matriz da canary:
- Combinações cross-org de `organization_id` × membership do JWT.
- Combinações `pipeline_id` de tenant ≠ `organization_id` (achado A).
- Combinações `account_id` cross-tenant (achado A).
- Combinações `contact_id` cross-tenant (achado A).
- Combinações `contact_id` de account diferente (achado A).
- Papel viewer (achado B — SEC-013 candidato).

Migration: uma para criar RPC; segunda para `DROP` no cleanup.

## 13. Riscos

1. **SEC-013 (achado B) — viewer insere opportunities.** A canary
   confirmará; a correção proposta é policy RESTRICTIVE
   `nsec12_opportunities_insert_block_viewer` (mesmo template dos
   sprints CHG-003/CHG-006).
2. **Cross-tenant FK sem tenant-check (achado A).** A canary revelará
   que `account_id`/`contact_id`/`pipeline_id`/`stage_id` de outro
   tenant passam o RLS de INSERT. Correção proposta: trigger
   `BEFORE INSERT` validando `organization_id` das entidades.
3. **Recálculos em cascata.** Cada INSERT bem-sucedido enfileira 4+
   queues. Sob rollback, a queue reverte junto — sem risco. Se o
   probe rodar em janela de flush do worker, o worker verá 0 linhas.
4. **Baseline crescente de audit_log/system_events/revenue_events.**
   Reversível pelo rollback interno. Zero linhas persistidas em probes
   `ALLOWED_ROLLED_BACK`.
5. **Egress externo.** Guardado pelo status neutro; risco zero para
   `status='new'`.

## 14. Dados reais intocados

Nenhum write executado. Nenhuma policy, trigger, função ou fixture
alterada. Nenhuma migration. Nenhum dado real modificado. Baseline
imutável.

## 15. Decisão de readiness

`OPPORTUNITIES INSERT READY AFTER SYNTHETIC FIXTURES`

Justificativa:
- Metodologia é segura (payload mínimo determinado; egress externo
  descartado sob `status='new'`).
- Rollback interno cobre todos os side effects transacionais.
- Nenhum dado real é necessário no probe.
- **Faltam fixtures sintéticas permanentes de pipeline + stage inicial
  (por org) e opcionalmente contatos-base**, sem as quais o probe seria
  obrigado a reutilizar pipelines/stages reais — o que é vetado pelo
  guardrail de "zero dados reais alterados".

Próxima autorização recomendada (não iniciada): `NSEC-1.2-CHG-012 —
provisionamento de fixtures sintéticas pipeline/stage/contact` como
mudança AMARELA aditiva, seguindo o protocolo de mudança única. Após
essa mudança, a canary `NSEC-1.2-CHG-013` poderá exercer a matriz
completa de INSERT em `opportunities`.
