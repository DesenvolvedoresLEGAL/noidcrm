# Plano: Handler genérico para SPAs Next.js/React no Kairós

## Objetivo
Fazer o Kairós extrair expositores de sites SPA (Next.js / React / Vue) onde o HTML inicial vem vazio (`<div>Carregando...</div>`) — caso da **FCE COSMETIQUE** (vitrine.fcecosmetique.com.br retornou 1 lead de 220) — **sem alterar nenhum provider existente** (Swapcard, Informa Markets, ExpoFP) e sem regredir os 5 eventos que funcionam hoje.

## Garantia de não-regressão
O novo handler só roda **depois** de todos os providers determinísticos atuais falharem. A ordem fica:

```text
1. ExpoFP        → se hit, retorna e sai
2. Informa/Swapcard → se hit, retorna e sai
3. [NOVO] SPA Next.js/React → se hit, retorna e sai
4. Firecrawl + IA chunking (fluxo atual) → fallback final
```

Os guards `expofpHandled` e `swapcardCompleted` continuam intactos. Zero mudança nos arquivos `providers/expofp.ts`, `providers/informa-markets.ts`, `providers/index.ts` ou no fluxo Firecrawl/IA.

## Arquivos impactados

| Arquivo | Tipo | Mudança |
|---|---|---|
| `supabase/functions/lead-sourcing/providers/spa-nextjs.ts` | **novo** | Detector + extrator SPA |
| `supabase/functions/lead-sourcing/providers/index.ts` | edit | Exportar `tryGenericSpaFromUrl` |
| `supabase/functions/lead-sourcing/index.ts` | edit | Inserir Step 0c entre Informa e Firecrawl (~10 linhas) |

## Como o novo provider funciona

### Camada 1 — Detecção de SPA (sem custo)
Faz `fetch` simples ao HTML raiz. Considera SPA se:
- `<body>` contém apenas spinner/loader (`Carregando…`, `Loading…`, body < 5KB de texto visível)
- E houver um destes marcadores: `__next_f`, `__NEXT_DATA__`, `window.__NUXT__`, `ng-version`, `id="root"` vazio, `id="__nuxt"`, `id="app"` vazio.

Se não bate, **retorna `{ detection: null }` imediatamente** — fluxo segue para Firecrawl normal.

### Camada 2 — Extração do payload hidratado (determinística, sem IA)
Tenta nesta ordem:

1. **`__NEXT_DATA__`** (Next.js Pages Router) — `<script id="__NEXT_DATA__">{...}</script>`. Faz `JSON.parse` e percorre `props.pageProps` procurando arrays de objetos com chaves típicas (`name|nome|companyName|razaoSocial|exhibitor`).
2. **RSC payload** (Next.js App Router) — varre `self.__next_f.push([1, "..."])`, concatena os chunks, parseia cada linha JSON e procura arrays de objetos-empresa (mesmas heurísticas do passo 1).
3. **Nuxt** (`window.__NUXT__ = ...`) e **Apollo state** (`window.__APOLLO_STATE__`) — mesma heurística aplicada ao objeto.

Heurística de "array de empresas": ≥10 itens, ≥60% com chave name-like, opcionalmente `logo|logoUrl|website|stand|booth|country|city|categoria|category`.

### Camada 3 — Sniffing de API interna (fallback determinístico)
Se camada 2 não achou ≥20 empresas:
- Faz **1 scrape Firecrawl** com `formats: ['rawHtml','links']` + `waitFor: 4000` para capturar HTML hidratado.
- Procura no HTML/JS bundles padrões de fetch: `fetch("/api/...")`, `axios.get("/...")`, URLs absolutas para `*.supabase.co`, `*.cloudfront.net/api`, `cdn.contentful.com`, etc.
- Para cada endpoint candidato, tenta `GET` direto (com `Origin` e `Referer` do site) e aplica a mesma heurística "array de empresas".

### Camada 4 — Firecrawl com `waitFor` longo (último recurso do provider)
Se camadas 2 e 3 falharem, faz **1 scrape** com `waitFor: 8000` + `onlyMainContent: false` e devolve o HTML renderizado para o pipeline Firecrawl/IA atual seguir — **mas marca `_extraction_method = "spa_hydrated_html"`** para a IA receber HTML útil em vez de bundle JS de 400KB (raiz da bug original do FCE).

## Telemetria
- `metrics.provider = "spa-nextjs"` quando hit
- `metrics.spa_framework = "nextjs-app" | "nextjs-pages" | "nuxt" | "react-spa"`
- `metrics.spa_extraction_layer = 2 | 3 | 4`
- Log `executionLog.push({ step: "spa_detection", framework, layer, count })`

## Validação
1. Rodar nova busca para `https://vitrine.fcecosmetique.com.br/` → esperado ≥150 expositores via camada 2 (Next.js RSC).
2. Re-rodar uma busca **APAS SHOW** (Swapcard) → confirmar que continua passando pelo provider Swapcard, não pelo SPA handler (`metrics.provider = "informa-markets"` ou `"swapcard"`).
3. Re-rodar **APAS** que usa ExpoFP → confirmar `metrics.provider = "expofp"`.
4. Verificar logs `system_events` para `spa_detection` e métrica `spa_extraction_layer`.

## Risco
**Baixo.** Provider novo é puramente aditivo, com short-circuit de detecção (custo ~1 fetch + regex se não for SPA). Os 5 eventos que funcionam hoje **não passam pela detecção SPA** porque já são interceptados antes pelos providers atuais.

## Próximos passos pós-merge
- Memória `architectural-decision/intelligence/spa-nextjs-provider` documentando padrões de extração.
- Adicionar à doc do Kairós a lista atualizada dos **6 handlers**.
