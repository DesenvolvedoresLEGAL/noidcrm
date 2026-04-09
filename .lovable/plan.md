

## Sprint 1 — Fundação de Dados e Arquitetura do Lead Sourcing Engine

### Contexto Importante

O sistema já usa `organizations` + `organization_members` como modelo de multitenancy (não "workspaces"). Já existem tabelas `lead_searches`, `lead_search_results`, `icp_profiles`, `ai_playbooks` e `profiles` com RLS ativo. A Sprint 1 do spec precisa ser **adaptada** para evoluir o que existe, não recriar do zero.

**Decisão arquitetural**: Usaremos `organization_id` em todas as novas tabelas (não `workspace_id`). Não criaremos tabelas `workspaces` nem `profiles` novas — já existem e funcionam.

---

### 1. Migração SQL — Novas Tabelas

Criar 7 novas tabelas + evolução da `icp_profiles`. As tabelas `lead_searches` e `lead_search_results` existentes serão mantidas como estão (já têm dados em produção) e co-existirão com o novo modelo até migração completa.

**Novas tabelas:**

| Tabela | Propósito |
|---|---|
| `sourcing_playbooks` | Templates de busca (evento, geo, import, etc.) com input_schema e config |
| `playbook_runs` | Cada execução do Caramelo com status, payload, logs |
| `lead_sources` | Origens de dados vinculadas a uma run |
| `source_pages` | Páginas individuais processadas (para Firecrawl futuro) |
| `prospects` | Leads descobertos com dados normalizados |
| `prospect_signals` | Sinais individuais de cada prospect |
| `prospect_scores` | Score composto com generated column `priority_score` |
| `dedupe_registry` | Registro de deduplicação cross-run |

**Evolução da `icp_profiles`:** Adicionar colunas `industries`, `company_size_min`, `company_size_max`, `geo_targets`, `keywords_include`, `keywords_exclude`, `buyer_personas`, `trigger_signals`, `disqualifiers`, `priority_rules` como JSONB (todas nullable, sem quebrar dados existentes).

**RLS:** Todas as tabelas com policy baseada em `organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())` — mesmo padrão das tabelas existentes.

**Índices:** Todos os listados no spec, usando `organization_id` ao invés de `workspace_id`.

---

### 2. Edge Function — Refatorar `lead-sourcing`

Atualizar a edge function existente para:
- Criar um `playbook_run` (status `queued` → `running` → `completed/failed`)
- Guardar `input_payload` exatamente como enviado
- Salvar resultados na tabela `prospects` (ao invés de `lead_search_results`)
- Criar `prospect_scores` com reasoning da IA
- Registrar `execution_log` no `playbook_run`
- Manter backward compatibility com o fluxo atual

---

### 3. Frontend — Novos Componentes e Hooks

**Hook `useLeadSourcingV2.ts`** (novo):
- `useSourcingPlaybooks()` — lista playbooks ativos da org
- `usePlaybookRuns()` — lista runs recentes
- `useProspects(runId)` — lista prospects de uma run com scores
- `useCreatePlaybookRun()` — mutation que invoca a edge function
- `useUpdateProspectStatus()` — aprovar/rejeitar/converter

**Componentes (refatorar os existentes):**

| Componente | Mudança |
|---|---|
| `LeadSourcingEngine.tsx` | Conectar a `playbook_runs` ao invés de `lead_searches`. Mostrar `RecentRunsList` |
| `LeadSearchForm.tsx` | Renomear internamente para usar `sourcing_playbooks`. Adicionar `IcpProfileSelect` com dados reais expandidos e `ExecutionSettingsPanel` com `approvalMode`, `scoreThreshold`, `autoImport`, `autoCreateOpportunity`, `autoAssignOwner` |
| `LeadResultsTable.tsx` | Evoluir para consumir `prospects` + `prospect_scores`, mostrando `priority_score`, `grade`, `reasoning` |
| `RecentRunsList.tsx` (novo) | Lista de `playbook_runs` com status, contadores, timestamp |

**Estados no formulário:**
- `selectedPlaybookType`, `selectedIcpId`, `inputPayload`, `scoreThreshold`, `autoImport`, `autoCreateOpportunity`, `autoAssignOwner`, `isSubmitting`

**Payload do botão "Executar Caramelo":**
```json
{
  "playbookType": "manual_import",
  "icpProfileId": "uuid",
  "inputPayload": {},
  "importRules": {
    "approvalMode": "manual",
    "scoreThreshold": 60,
    "autoImport": false,
    "autoCreateOpportunity": false,
    "autoAssignOwner": false
  }
}
```

---

### 4. Arquivos a Criar/Editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint1_sourcing_foundation.sql` | Migration com todas as tabelas, RLS, índices |
| `supabase/functions/lead-sourcing/index.ts` | Refatorar para usar novas tabelas |
| `src/hooks/useLeadSourcingV2.ts` | Novo hook com queries/mutations para novo schema |
| `src/components/playbook/LeadSourcingEngine.tsx` | Refatorar para novo schema |
| `src/components/playbook/LeadSearchForm.tsx` | Evoluir formulário com novos campos |
| `src/components/playbook/LeadResultsTable.tsx` | Evoluir para prospects + scores |
| `src/components/playbook/RecentRunsList.tsx` | Novo — lista de runs |
| `src/components/playbook/IcpProfileSelect.tsx` | Novo — seletor de ICP com resumo expandido |

---

### Critérios de Aceite

- Banco com todas as tabelas criadas e RLS ativo
- ICP real vindo do banco aparece no seletor
- Botão "Executar Caramelo" cria um `playbook_run` e gera `prospects` + `prospect_scores`
- Runs aparecem na lista de execuções recentes
- Resultados mostram score composto e reasoning
- RLS bloqueia acesso entre organizations

