# KAI.15 — Apollo Invisible Mode

Transforma Apollo de ação manual em camada de infraestrutura invisível dentro do Kairós. Saída continua sendo a Qualified Queue.

## 1. Schema (migration única)

**`apollo_auto_enrichment_rules`** (1 linha por organização)
- `enabled` bool default true
- `minimum_priority_score` int default 180
- `allowed_quality_labels` text[] default `{high_confidence,usable}`
- `required_domain` bool default true
- `allowed_relationship_status` text[] default `{new_prospect}`
- `allowed_icps` uuid[] (null = todos)
- `max_contacts_per_company` int default 3
- `max_apollo_credits_per_day` int default 500
- `max_apollo_credits_per_batch` int default 200
- `auto_select_primary_contact` bool default true
- `auto_reveal_contact` bool default true
- RLS: leitura organização; escrita admin/manager

**`apollo_enrichment_audit`**
- `batch_run_id`, `prospect_id`, `company_name`, `apollo_status` (`skipped|partial|enriched|failed`), `skip_reason`, `credits_used`, `contacts_found`, `contacts_revealed`, `primary_contact_id`, `decision_maker_found` bool, `icp_id`, `priority_score`
- RLS: org members select; service_role all

**Extensão `kairos_qualified_queue`**: adiciona `apollo_status`, `contacts_found` int, `primary_contact_name`, `primary_contact_role`, `primary_contact_score`

**Função `fn_apollo_should_run(p_prospect_id, p_rules)`** retorna `(eligible bool, reason text)` aplicando todas as regras de elegibilidade.

**Função `fn_apollo_credits_used_today(org_id)`** soma `credits_used` de `apollo_enrichment_audit` nas últimas 24h.

## 2. Edge Functions

- **`kairos-apollo-invisible`** — núcleo. Input: `prospect_id`, `batch_run_id?`. Carrega rules, chama `fn_apollo_should_run`, se elegível invoca `run-apollo-enrichment` (existente), aplica filtro de departamentos por ICP, filtro de cargos (Head/Director/Gerente/Coordenador/Especialista; ignora Estagiário/Assistente/Analista Júnior), calcula Contact Score (email 30 + phone 20 + senioridade 20 + linkedin 15 + ICP-role 15), marca `is_primary` no melhor, se `auto_reveal_contact` chama `reveal-apollo-contact` até `max_contacts_per_company`, escreve em `apollo_enrichment_audit`, atualiza `kairos_qualified_queue` (`apollo_status`, contatos, primary). Respeita limites de crédito diário e por batch.

- **`kairos-apollo-estimate`** — input lista de `prospect_ids` ou `batch_run_id`. Para cada, roda `fn_apollo_should_run` (dry run). Retorna `{eligible_count, ineligible_count, estimated_contacts, estimated_credits, daily_limit, daily_used, batch_limit}`.

- **`kairos-autopilot-process`** (editar): no estágio `apollo` chama `kairos-apollo-invisible` ao invés de `run-apollo-enrichment` direto. Aborta batch quando `credits_used_batch >= max_apollo_credits_per_batch`.

**Mapa departamentos por ICP** em `_shared/apollo-icp-departments.ts`:
- AGÊNCIAS: Marketing, Eventos, Operações, Compras
- ORGANIZADORES: Eventos, Operações, Compras
- MONTADORAS: Operações, Compras, Projetos
- PATROCINADORES: Marketing, Trade Marketing, Eventos
- EXPOSITORES: Marketing, Eventos, Trade, Compras

Resolve ICP do prospect via `icp_profiles.category` (fallback EXPOSITORES).

## 3. Eventos (system_events)

`apollo_enrichment_started`, `apollo_enrichment_completed`, `apollo_skipped`, `decision_maker_found`, `contact_revealed` — gravados pela edge function. Consumidos por Learning Loop posteriormente (apenas escrita nesta sprint).

## 4. Services / Hooks (frontend)

- `src/services/intelligence/apolloInvisible.ts`: `getRules`, `updateRules`, `estimateApollo(prospectIds | batchRunId)`, `listApolloAudit(filters)`, `getApolloKpis(filters)`, `getApolloROI(filters)`
- `src/hooks/intelligence/useApolloRules.ts`, `useApolloEstimate.ts`, `useApolloAudit.ts`, `useApolloKpis.ts`, `useApolloROI.ts`

## 5. UI

- **`ApolloInvisibleSettingsCard.tsx`** (Autopilot tab + nova sub-aba): formulário das rules.
- **`ApolloKpiBar.tsx`**: bloco "Apollo Performance" no Autopilot panel (empresas avaliadas, executado, ignorado, decisores, revelados, créditos, custo/decisor, taxa aproveitamento).
- **`AutopilotConfigModal.tsx`** (editar): adiciona preview de `estimateApollo` (elegíveis/ineligíveis/contatos/créditos vs limite diário e batch). Botão de execução bloqueado se exceder limite.
- **`AutopilotRunDrawer.tsx`** (editar): aba "Apollo Audit" listando `apollo_enrichment_audit` do run.
- **`QualifiedQueueTable.tsx`** (editar): colunas `primary_contact_name/role/score`, badge `apollo_status`.
- **`ApolloRoiPage.tsx`** em `src/pages/intelligence/ApolloRoi.tsx`: filtros (período/evento/ICP/batch), KPIs (créditos, decisores, contatos válidos, SDR Ready gerados, oportunidades, receita atribuída via `commercial_won_revenue_view`, ROI estimado). Linkada no `KairosHub` como aba "💎 Apollo ROI".
- **Alertas** (banner no Autopilot): crédito ≥80% do limite diário, taxa de decisores <20%, ICP com cobertura <10%, falha do provider em últimas 24h.

## 6. Garantias

- Apollo NUNCA cria opportunity/account/contact no CRM, não dispara email/WhatsApp. Saída exclusiva = atualização da Qualified Queue + audit.
- Promoção ao CRM permanece manual (KAI.13).
- `relationship_status != new_prospect` → skip automático.

## 7. Docs

- `src/components/playbook/APOLLO_INVISIBLE.md` — arquitetura, regras de elegibilidade, departamentos por ICP, fórmula Contact Score, limites.
- Atualizar `SOURCING_AUDIT.md` e `AUTOPILOT.md`.

## Riscos

- Custo Apollo descontrolado → mitigado por limites diário + batch + skip por score.
- Decisor errado → fórmula Contact Score + filtro de cargos.
- Apollo down → audit `apollo_status=failed`, batch continua próximos itens.
- Sem ICP mapeado → fallback EXPOSITORES.

## Arquivos

**Novos:** 1 migration, 2 edge functions, `_shared/apollo-icp-departments.ts`, 1 service, 5 hooks, 5 componentes UI, 1 página, 1 doc.
**Editados:** `kairos-autopilot-process`, `AutopilotConfigModal`, `AutopilotRunDrawer`, `AutopilotPanel`, `QualifiedQueueTable`, `KairosHub`, `SOURCING_AUDIT.md`, `AUTOPILOT.md`, `src/integrations/supabase/types.ts` (auto).
