# Sprint A — Harden do Enrichment (Kairós)

Objetivo: deixar o enrichment **previsível, comparável e confiável**. Hoje o `run-enrichment` faz scrape + IA "criativa" e salva sem validar conteúdo, sem fallback determinístico e sem grade de qualidade. Esta sprint adiciona validação de conteúdo, fallback automático, JSON normalizado, score de confiança calculado em código e UI com badges A/B/C/D.

## O que muda no banco

Migration única (multi-tenant: usar `organization_id` no padrão atual, não `tenant_id`):

1. **Estender `enrichment_runs`**:
   - `quality_score INT` (0-100, calculado em código)
   - `quality_grade TEXT` (A/B/C/D)
   - `fallback_used BOOLEAN DEFAULT false`
   - `content_length INT`
   - `fallback_pages_fetched JSONB DEFAULT '[]'` (URLs do fallback que retornaram conteúdo)

2. **Nova `enrichment_raw_sources`** (auditoria do que foi raspado):
   - `id`, `organization_id`, `prospect_id`, `enrichment_run_id`
   - `source_type TEXT` (`firecrawl_main`, `fallback_about`, `fallback_sobre`, `fallback_empresa`, `fallback_quem_somos`, `directory`)
   - `url TEXT`, `raw_content TEXT`, `content_length INT`
   - `created_at`
   - RLS: SELECT/INSERT por membros da organização (mesmo padrão de `enrichment_runs`)
   - Índice `(organization_id, prospect_id, created_at DESC)`

3. **Nova `enrichment_normalized`** (snapshot do JSON canônico por run):
   - `id`, `organization_id`, `prospect_id`, `enrichment_run_id`
   - `data JSONB` (schema fechado abaixo)
   - `confidence_score INT`, `quality_grade TEXT`
   - `fallback_used BOOLEAN`, `content_length INT`
   - `created_at`
   - RLS igual às demais

`enriched_company_profiles` continua sendo a "view atual" (1 por prospect) — `enrichment_normalized` guarda histórico por run, sem quebrar o que o frontend já lê.

## Edge function: `run-enrichment` (refactor, sem nova função)

Mantém o nome para não quebrar `useRunEnrichment`. Novo fluxo:

```text
1. Scrape principal (Firecrawl) → salva em enrichment_raw_sources (firecrawl_main)
2. Mede content_length
3. Se content_length < 1500 OU faltam seções-chave:
     fallback_used = true
     para cada path em [/about, /sobre, /empresa, /quem-somos]:
       fetch direto (sem Firecrawl, fetch HTML simples + strip de tags)
       se conteúdo > 200 chars → salva em enrichment_raw_sources e concatena
4. Roda PROMPT MASTER de normalização (JSON rígido, schema fechado via tool call)
5. Limpa output (garante arrays mesmo se IA retornar null)
6. Calcula confidence_score em CÓDIGO (não confia no que a IA disser)
7. Deriva quality_grade (A/B/C/D)
8. Persiste:
   - enrichment_normalized (histórico)
   - enriched_company_profiles (upsert — view atual)
   - enrichment_runs (atualiza quality_score, quality_grade, fallback_used, content_length)
9. Brief comercial (mantém como está hoje)
```

Detalhes:
- Fallback usa `fetch` puro (não consome créditos Firecrawl); strip simples de `<script>`, `<style>` e tags HTML para extrair texto.
- O `content_length` total considera principal + fallback concatenados.
- `force_fallback: boolean` no body do request: quando true, pula a checagem e ativa fallback direto (usado pelo botão "Enriquecer novamente").

## Prompt master (substitui o atual de company profile)

Tool call com schema fechado:

```json
{
  "company_summary": "string",
  "business_model": "string",
  "market_type": "B2B | B2C | B2B2C",
  "industry": "string",
  "sub_industry": "string",
  "target_customer": "string",
  "geo": "string",
  "company_size_hint": "small | medium | large | unknown",
  "top_pains": ["string"],
  "top_opportunities": ["string"],
  "trigger_signals": ["string"],
  "digital_maturity": "low | medium | high",
  "confidence_notes": "string"
}
```

Regras no system prompt: "não invente, retorne null/array vazio se não houver evidência, apenas JSON". O brief comercial continua usando o profile mapeado (compatibilidade: `top_pains` → `commercial_pains`, `top_opportunities` → `growth_signals`, `trigger_signals` → `tech_signals` no save de `enriched_company_profiles`).

## Cálculo de confiança (em código, determinístico)

```ts
score = 0
+ (content_length > 3000 ? 30 : content_length > 1500 ? 20 : 10)
+ (top_pains.length >= 2 ? 20 : 0)
+ (top_opportunities.length >= 2 ? 20 : 0)
+ (industry ? 10 : 0)
+ (business_model ? 10 : 0)
- (fallback_used ? 10 : 0)
score = clamp(score, 0, 100)

grade = score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : 'D'
```

## Frontend

1. **`src/hooks/useEnrichment.ts`** — `useRunEnrichment` aceita `forceFallback?: boolean` e repassa ao body.

2. **Novo `src/components/playbook/enrichment/EnrichmentQualityBadge.tsx`**:
   - Props: `grade: 'A'|'B'|'C'|'D'`, `score: number`
   - Cores: A verde, B azul, C laranja, D vermelho
   - Layout: `Qualidade A · 87%`

3. **Novo `src/components/playbook/enrichment/FallbackIndicator.tsx`**:
   - Mostra `⚠ Dados complementados via fallback` + tooltip listando URLs do fallback (`fallback_pages_fetched`)

4. **`CompanyEnrichmentCard.tsx`**: substitui o badge "% confiança" pelo novo `EnrichmentQualityBadge` (lê de `enrichment_runs.quality_grade/quality_score`, não mais do `confidence` da IA). Adiciona `FallbackIndicator` logo abaixo do título quando `fallback_used`.

5. **`EnrichProspectButton.tsx`**: variante secundária "Forçar fallback + reprocessar" exibida quando `hasRun=true`. Chama `runEnrichment.mutate({ ..., forceFallback: true })`.

6. **`ProspectDetailDrawer.tsx`**: passa `enrichmentRun` para o card (para exibir grade/fallback) e adiciona o segundo botão.

## Compatibilidade

- `enriched_company_profiles` continua existindo e populado com mapeamento dos novos campos → componentes atuais não quebram.
- `commercial_briefs` e `enrichment_signals` permanecem inalterados.
- `enrichment_score` (legado) continua sendo escrito (= `quality_score`) para não quebrar quem lê.

## Plano de testes (manual no UI)

1. **Caso A** — site rico (cliente com `/sobre` completo): roda enrichment → grade `A`, `fallback_used=false`, `content_length > 3000`.
2. **Caso B** — site pobre (landing 1 página): roda → fallback ativa automático, busca `/about` `/sobre` etc., grade tipicamente `B` ou `C`, `fallback_used=true`.
3. **Caso C** — sem website / site offline: grade `D`, `confidence` baixa, sem crash.
4. **Botão "Forçar fallback"**: re-roda mesmo com site rico, grada deve cair ~10pts pelo penalty.

## Arquivos impactados

- `supabase/migrations/<novo>.sql` — alter + 2 novas tabelas + RLS
- `supabase/functions/run-enrichment/index.ts` — refactor do fluxo
- `src/hooks/useEnrichment.ts` — flag `forceFallback`
- `src/components/playbook/enrichment/CompanyEnrichmentCard.tsx` — recebe `run`
- `src/components/playbook/enrichment/EnrichProspectButton.tsx` — botão secundário
- `src/components/playbook/enrichment/EnrichmentQualityBadge.tsx` — novo
- `src/components/playbook/enrichment/FallbackIndicator.tsx` — novo
- `src/components/playbook/ProspectDetailDrawer.tsx` — wiring

## Riscos

- Fetch direto do fallback pode falhar em sites com WAF/Cloudflare → tratado com try/catch silencioso por URL, fallback continua se ao menos um path responder.
- Sites JS-rendered (SPAs) não retornam conteúdo útil via fetch puro — aceitável nesta sprint; degradação cai em grade C/D corretamente.
- Migration adiciona colunas nullable e tabelas novas — sem risco para dados existentes.
