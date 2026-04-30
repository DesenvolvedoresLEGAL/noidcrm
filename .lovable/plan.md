## Diagnóstico

A página `apasshow.com/expositores` **não lista expositores em HTML**. Ela embute um iframe do **ExpoFP** (`apasshow2026.expofp.com`), que é uma plataforma SaaS de mapas virtuais usada por dezenas de feiras (APAS, NRF, Anuga, CES regionais, etc.). Por isso o scrape Firecrawl trouxe lixo — "Mapa do Evento", "Por que expor na APAS Show", "Localização" — que são seções da página de marketing, não expositores.

**Boa notícia:** o ExpoFP serve os dados num JSON público, simples e estável.

### Endpoint descoberto (validado agora)

```
GET https://<event>.expofp.com/data/version.js   → window.__fpDataVersion = "<v>"
GET https://<event>.expofp.com/data/data.js?v=<v>  → var __data = { exhibitors: [...] }
```

Resultado para APAS 2026: **578 expositores** com `id`, `externalId`, `name`, `categories[]`, `country`, `logo` (336/578 com categoria, 108/578 com país). Endpoint requer `Referer: https://<event>.expofp.com/` e User-Agent de browser.

**Limitação:** o JSON do ExpoFP só dá nome+categoria+país. Não traz site, CNPJ, descrição. Isso é OK — o nome é exatamente o input que o pipeline atual (Caramelo → enrichment → CNPJ lookup → Apollo) já sabe processar. O que estava errado era a **fonte do nome**, não o enriquecimento.

## Plano

### 1. Novo provider: `ExpoFPProvider` (Edge Function)

Criar `supabase/functions/lead-sourcing/providers/expofp.ts` com duas funções puras:

- `detectExpoFP(eventUrl, html)`: dado o HTML da página do evento, procura iframe `*.expofp.com` ou atributo `data-event-id`. Retorna `{ subdomain, eventId } | null`.
- `fetchExpoFPExhibitors(subdomain)`:
  1. `GET /data/version.js` → extrai `__fpDataVersion`
  2. `GET /data/data.js?v=<version>` (com Referer e UA de browser, BOM-safe)
  3. Faz `eval` controlado da expressão `var __data = {...};` (parse com regex + `JSON.parse` da parte após `=`)
  4. Resolve `categories[]` (IDs → nomes) usando o array `categories` no mesmo payload
  5. Retorna `Array<{ name, country, categories[], external_id, source_url, raw }>`

### 2. Detecção automática no handler de evento

Em `handleEventFirecrawl` (lead-sourcing/index.ts, linha ~980), antes do `firecrawl.map`:

```text
1. Fetch HTML da event_url (já feito hoje no fluxo)
2. Tenta detectExpoFP(html)
3. Se positivo:
     - logRunEvent("ExpoFP detectado", { subdomain })
     - exhibitors = fetchExpoFPExhibitors(subdomain)
     - Pula Firecrawl map+scrape+AI chunking inteiramente
     - Vai direto para a etapa de "extracted_raw" → dedupe → score → persist
4. Se negativo: mantém pipeline Firecrawl atual (zero regressão)
```

Reaproveita 100% da pipeline downstream (`prospects` insert, scoring, dedupe, auto-import). Só substitui a fonte da lista bruta.

### 3. Provider registry (extensível)

Estrutura para adicionar próximos SaaS de mapa de feira sem tocar no handler principal:

```text
providers/
  expofp.ts     ← este sprint
  swapcard.ts   ← já existe inline, mover para cá depois
  index.ts      ← detect(html, url) → tenta cada provider em ordem
```

Esse sprint só implementa ExpoFP + scaffold do registry. Swapcard fica intocado.

### 4. UX — sinalizar a fonte ao usuário

No `playbook_runs.stats` adicionar:

- `provider: "expofp" | "firecrawl"`
- `expofp_event_id`, `expofp_exhibitors_count`, `expofp_with_country`, `expofp_with_categories`

Na tela de resultados (Sourcing), badge ao lado do nome da execução: **"📍 ExpoFP · 578 expositores"** (componente já existe — só ler `stats.provider`).

### 5. Fallback gracioso

Se o ExpoFP for detectado mas o fetch falhar (403, mudança de schema):

- log_event "ExpoFP fetch falhou, caindo para Firecrawl"
- Continua o fluxo Firecrawl normal
- Sem failure visível pro SDR

### 6. Limpeza dos resultados ruins da APAS

Migration única para marcar como `rejected` (não deletar — manter auditoria) os 8 `lead_search_results` da execução `APAS SHOW 2026 · 29/04/26 às 20:50` cujos nomes batem com lixo conhecido: `MAPA DO EVENTO`, `Por que expor%`, `Vamos conversar?`, `ATENDIMENTO AO EXPOSITOR`, `Localização`, `Mapa Virtual%`. Adicional: flag `is_garbage = true` + `rejection_reason = "non-exhibitor content"`.

## Arquivos impactados

- **novo** `supabase/functions/lead-sourcing/providers/expofp.ts` (~120 linhas)
- **novo** `supabase/functions/lead-sourcing/providers/index.ts` (registry, ~30 linhas)
- **edit** `supabase/functions/lead-sourcing/index.ts` — inserir bloco de detecção no início de `handleEventFirecrawl` (~30 linhas)
- **edit** `src/components/playbook/...` (componente do card de execução) — badge do provider
- **migration** marcar resultados-lixo da execução APAS atual como rejected

## Critério de sucesso

Re-rodar a busca em `https://apasshow.com/expositores`:

- ✔ retorna 500+ expositores (nomes reais: "101 do Brasil Bebidas", "Aurora Coop", "Bebidas do Brasil | Gin Eternity"...)
- ✔ stats mostra `provider: "expofp"`
- ✔ tempo de execução cai de ~150s (Firecrawl) para <10s (1 fetch JSON)
- ✔ custo Firecrawl zera para esse evento
- ✔ pipeline de enriquecimento (CNPJ, Apollo) funciona normal sobre os nomes ExpoFP
- ✔ zero regressão em buscas de eventos não-ExpoFP (ABRINT, FEIMEC, BETT continuam via Firecrawl)

## Riscos

- **Schema do ExpoFP pode mudar** → mitigado pelo fallback automático para Firecrawl
- **Eventos com ExpoFP privado/autenticado** → fetch retorna 403, fallback aciona, sem quebrar
- **Outro SaaS similar (mapyourshow, a2zinc)** → fora de escopo deste sprint, mas o registry deixa pronto pra adicionar

## Próximos passos (fora deste sprint)

- Provider `mapyourshow` (NRF, IBIE)
- Provider `a2zinc` (várias feiras industriais US)
- Enriquecimento de `website` direto via Google Custom Search a partir do nome ExpoFP, antes de cair no Caramelo