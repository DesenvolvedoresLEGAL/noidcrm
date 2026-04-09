

## Sprint 7 — Busca Geográfica, Diretórios e Seed Expansion

### Resumo

Substituir o handler genérico `handleAIPowered` por três handlers especializados que usam **Firecrawl Search** para encontrar empresas reais na web, seguido de extração AI estruturada. Isso elimina a geração puramente inventada pelo LLM e conecta o motor a dados reais.

---

### 1. Sem migração SQL

As tabelas existentes (`prospects`, `prospect_scores`, `prospect_signals`, `lead_sources`, `source_pages`) já suportam todos os campos necessários. Nenhuma alteração de schema.

---

### 2. Edge Function — Três novos handlers

Substituir o fallback `handleAIPowered` por handlers dedicados no `lead-sourcing/index.ts`:

**Router atualizado:**
```
if (searchType === "geo") → handleGeoSearch()
if (searchType === "directory") → handleDirectorySearch()
if (searchType === "seed") → handleSeedExpansion()
// fallback genérico removido ou mantido como safety net
```

**a) `handleGeoSearch`**
1. Usar **Firecrawl Search** com query: `"empresas de {segment} em {city} {state} Brasil"`
2. Scrape dos top 5-8 resultados para extrair conteúdo
3. AI (Gemini Flash) extrai empresas reais do conteúdo scrapeado
4. Criar prospects com `source_label: "Busca Geográfica"`, sinais: `geo_targeted`, `found_in_search`
5. Scoring: bonus por website (+10), cidade match ICP (+10), segmento match (+15)
6. Dedupe contra accounts existentes

**b) `handleDirectorySearch`**
1. Se `directory_url` fornecida → Firecrawl **Map** + **Scrape** (como evento)
2. Se apenas `directory_source` (nome) → Firecrawl **Search** com query: `"{directory_source} empresas Brasil lista diretório"`
3. AI extrai empresas do conteúdo
4. Sinais: `listed_in_directory`, `has_public_profile`
5. Scoring: bonus por diretório oficial (+10), perfil individual (+10), website (+10)

**c) `handleSeedExpansion`**
1. Firecrawl **Search**: `"empresas similares a {seed_company}" OR "concorrentes de {seed_company}" OR "{seed_company} competitors"`
2. Firecrawl **Scrape** no website da empresa seed para extrair contexto (segmento, tamanho, produtos)
3. AI recebe contexto da seed + resultados de busca → gera lista de empresas similares com **justificativa de similaridade**
4. Sinais: `similar_to_reference`, `competitor`, `same_segment`
5. Scoring: bonus por similaridade confirmada (+15), mesmo segmento (+10), website (+10)

**Padrão comum dos 3 handlers:**
- Criar `lead_source` com `source_type` específico
- Registrar `run_events` em cada etapa
- Salvar `source_pages` dos scrapes
- Dedupe contra accounts
- Calcular `execution_time_ms`
- Tolerância a falhas parciais

---

### 3. Frontend — Formulário já pronto

O `LeadSearchForm.tsx` já tem os campos corretos para cada tipo:
- **Geo**: segmento, cidade, estado ✓
- **Diretório**: directory_source ✓  
- **Seed**: seed_company ✓

**Ajuste menor no formulário**: Adicionar campo opcional `directory_url` no tipo diretório para permitir crawl direto de URL.

**`LeadSourcingEngine.tsx`**: Sem mudanças — o handler de execução já passa `playbookType` corretamente para a edge function.

**`LeadResultsTable.tsx`**: Sem mudanças — a tabela já mostra `source_label` e funciona com qualquer tipo.

---

### 4. Arquivos a editar

| Arquivo | Ação |
|---|---|
| `supabase/functions/lead-sourcing/index.ts` | Adicionar `handleGeoSearch`, `handleDirectorySearch`, `handleSeedExpansion`; atualizar router |
| `src/components/playbook/LeadSearchForm.tsx` | Adicionar campo `directory_url` opcional no tipo diretório |

---

### Critérios de aceite

- Busca geográfica retorna empresas reais via Firecrawl Search + AI extraction
- Diretório funciona com URL (crawl) ou nome (search)
- Seed Expansion retorna empresas similares com justificativa
- Prospects têm sinais específicos por tipo de playbook
- Origem correta visível na tabela de resultados
- Falhas parciais não derrubam a execução

