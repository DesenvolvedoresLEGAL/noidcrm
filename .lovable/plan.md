

## Sprint 9 — Módulo de Enriquecimento com IA, Website Scraping e Arquitetura Unificada

### Resumo

Criar o módulo completo de enrichment: banco de dados com 7 tabelas, edge function orquestradora que faz scraping via Firecrawl + síntese AI via Gemini, e frontend com aba de enrichment no ProspectDetailDrawer.

---

### 1. Migração SQL — 7 tabelas novas

Todas com RLS baseado em `organization_members.organization_id` (mesmo padrão do `run_events`).

**Tabelas:**
- `enrichment_runs` — orquestração de cada execução
- `enrichment_provider_results` — resultado bruto/normalizado por provider
- `enriched_company_profiles` — perfil consolidado da empresa
- `enriched_contact_profiles` — perfil de contato (preparado para futuro)
- `commercial_briefs` — brief comercial gerado por IA
- `enrichment_signals` — sinais detectados durante enrichment
- `contact_enrichment_queue` — fila para enriquecimento de contatos (preparada)

**RLS em todas:** SELECT e INSERT para membros da organização via `workspace_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())`.

**Índices:** Conforme especificado no sprint (workspace+prospect, workspace+run, workspace+signal_type, etc.)

---

### 2. Edge Function — `run-enrichment`

Uma única edge function orquestradora que:

1. Cria `enrichment_run` com status `running`
2. Busca dados do prospect (nome, domínio, website)
3. **Scraping via Firecrawl**: Scrape do website principal + Map para descobrir páginas institucionais (about, products, contact) + scrape das top 3-4 páginas
4. Salva resultado em `enrichment_provider_results` (provider: `internal_website`)
5. **Síntese AI via Gemini Flash**: Envia conteúdo scrapeado com prompt de análise empresarial → retorna JSON estruturado com company_summary, business_model, market_type, products_services, growth_signals, commercial_pains, etc.
6. Salva/upsert `enriched_company_profiles`
7. Cria `enrichment_signals` a partir dos sinais detectados
8. **Commercial Brief via AI**: Segunda chamada Gemini com dados consolidados → gera executive_summary, why_now, probable_pains, value_hypotheses, recommended_pitch_angle, first_touch_message, objection_predictions
9. Salva `commercial_briefs`
10. **Re-score**: Atualiza `prospect_scores` com bonus baseado em dados de enrichment (website confirmado +10, pains detectadas +10, growth signals +5, contato encontrado +5)
11. Finaliza `enrichment_run` com status `completed` e timestamps

**Erro handling:** Falhas parciais (Firecrawl offline, AI timeout) não matam o run — registram `providers_failed` e continuam com dados disponíveis.

---

### 3. Hook — `useEnrichment.ts` (novo)

- `useEnrichmentRun(prospectId)` — query do último enrichment run
- `useEnrichedCompanyProfile(prospectId)` — perfil consolidado
- `useCommercialBrief(prospectId)` — brief comercial
- `useEnrichmentSignals(prospectId)` — sinais do enrichment
- `useRunEnrichment()` — mutation que invoca a edge function
- `useEnrichmentStatus(runId)` — polling do status do run

---

### 4. Frontend — Aba Enrichment no ProspectDetailDrawer

Adicionar sistema de tabs ao `ProspectDetailDrawer.tsx`:
- **Tab "Detalhes"** — conteúdo atual do drawer (resumo, score, sinais, duplicidade, origem)
- **Tab "Enrichment"** — novo conteúdo:

**Componentes novos:**
- `EnrichProspectButton` — botão que dispara enrichment (com loading state)
- `EnrichmentStatusBadge` — badge do status do run (queued/running/completed/failed)
- `CompanyEnrichmentCard` — exibe company_summary, business_model, market_type, products_services, growth_signals, commercial_pains
- `CommercialBriefCard` — exibe executive_summary, why_now, probable_pains, value_hypotheses, pitch_angle, first_touch_message, objection_predictions com botões de "Copiar"
- `EnrichmentSignalsList` — lista de sinais com type, value, weight, confidence
- `EnrichmentTimeline` — timeline simples do enrichment run (started → scraped → analyzed → brief generated → score updated → completed)

**Layout da tab Enrichment:**
1. Botão "Enriquecer" (ou "Enriquecer novamente" se já rodou) + status badge
2. CompanyEnrichmentCard (se dados existem)
3. CommercialBriefCard (se dados existem)
4. EnrichmentSignalsList
5. EnrichmentTimeline

---

### 5. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint9_enrichment.sql` | 7 tabelas + RLS + índices |
| `supabase/functions/run-enrichment/index.ts` | **Novo** — orquestrador de enrichment |
| `src/hooks/useEnrichment.ts` | **Novo** — queries e mutations |
| `src/components/playbook/ProspectDetailDrawer.tsx` | Adicionar tabs + aba Enrichment |
| `src/components/playbook/enrichment/EnrichProspectButton.tsx` | **Novo** |
| `src/components/playbook/enrichment/EnrichmentStatusBadge.tsx` | **Novo** |
| `src/components/playbook/enrichment/CompanyEnrichmentCard.tsx` | **Novo** |
| `src/components/playbook/enrichment/CommercialBriefCard.tsx` | **Novo** |
| `src/components/playbook/enrichment/EnrichmentSignalsList.tsx` | **Novo** |
| `src/components/playbook/enrichment/EnrichmentTimeline.tsx` | **Novo** |

---

### Critérios de aceite

- Prospect com website válido gera enrichment_run completo
- enriched_company_profiles preenchida com dados reais do site
- commercial_briefs criada com resumo, dores, pitch angle e mensagem inicial
- Score do prospect recalculado com bonus do enrichment
- Aba Enrichment no drawer mostra dados reais com botões de copiar
- Falhas parciais não impedem execução do que for possível

