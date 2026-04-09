

## Sprint 4 — Playbook Evento com Firecrawl

### Pré-requisito: Firecrawl Connector

O Firecrawl **não está conectado** ao projeto. Antes de implementar, será necessário conectar o Firecrawl via connector (`standard_connectors--connect` com `connector_id: firecrawl`). Isso disponibilizará `FIRECRAWL_API_KEY` como env var nas edge functions.

---

### 1. Migração SQL — Colunas extras em `prospects`

Adicionar 3 colunas para dados específicos de evento:

```sql
ALTER TABLE prospects
  ADD COLUMN IF NOT EXISTS event_name text,
  ADD COLUMN IF NOT EXISTS event_url text,
  ADD COLUMN IF NOT EXISTS exhibitor_profile_url text,
  ADD COLUMN IF NOT EXISTS booth text;
```

---

### 2. Edge Function `lead-sourcing` — Provider Firecrawl Event

Adicionar um novo handler `handleEventFirecrawl` ao invés de usar o AI-powered genérico. Fluxo:

1. Criar `lead_source` tipo `event_exhibitors`
2. Chamar Firecrawl **map** na URL do evento para descobrir URLs
3. Filtrar URLs relevantes (contendo palavras como `exhibitor`, `expositor`, `sponsor`, `brand`, `partner`)
4. Salvar URLs em `source_pages` com `page_type` classificado
5. Chamar Firecrawl **scrape** nas top páginas relevantes (limit ~10 páginas)
6. Para cada página scrapeada, chamar **Gemini 3 Flash** com o prompt do Caramelo Agent para extrair expositores em JSON estruturado
7. Normalizar cada expositor, criar `prospect` com campos `event_name`, `event_url`, `booth`, `exhibitor_profile_url`
8. Rodar dedupe contra accounts
9. Scoring determinístico + event-specific bonuses (+10 diretório oficial, +10 perfil individual, +5 booth, +10 website, +5 descrição, +10 sinais de demo)
10. Criar `prospect_signals` com sinais específicos: `participates_in_events`, `listed_in_official_directory`, `has_booth`, `has_product_showcase`
11. Atualizar `playbook_run.stats` com `pages_discovered`, `pages_scraped`, `exhibitors_extracted`, `prospects_created`
12. Tolerância a falhas: páginas que falharem no scrape não derrubam a execução

**Detecção de tipo**: `if (searchType === 'event')` → `handleEventFirecrawl()`

---

### 3. Frontend — Progress Steps para Evento

**`LeadSourcingEngine.tsx`**: Para runs do tipo `event`, mostrar indicador de etapas durante execução:
- Descobrindo páginas → Classificando → Extraindo expositores → Pontuando → Finalizando

Como a edge function roda de uma vez (não streaming), usaremos um stepper visual simulado durante o `isPending` state.

**`LeadResultsTable.tsx`**: Sem mudanças estruturais — os campos `event_name`, `booth`, `exhibitor_profile_url` já aparecem no ProspectDetailDrawer. Opcionalmente adicionar coluna "Evento" quando prospects têm `event_name`.

**`LeadSearchForm.tsx`**: Já tem campos para URL e nome do evento — sem mudanças.

---

### 4. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint4_event_columns.sql` | 4 colunas novas em prospects |
| `supabase/functions/lead-sourcing/index.ts` | Novo handler `handleEventFirecrawl` com Firecrawl map+scrape + AI extraction |
| `src/components/playbook/LeadSourcingEngine.tsx` | Stepper visual durante execução de evento |
| `src/components/playbook/ProspectDetailDrawer.tsx` | Mostrar campos de evento (booth, profile URL) |
| `src/hooks/useLeadSourcingV2.ts` | Atualizar tipo Prospect com novos campos |

---

### Critérios de aceite

- Firecrawl conectado e operacional
- URL de evento dispara map + scrape + extração AI
- Páginas salvas em `source_pages`
- Expositores reais criados como prospects com sinais específicos de evento
- Falhas parciais toleradas (páginas individuais)
- Stats do run mostram páginas e expositores
- Campos de evento visíveis no drawer de detalhe

