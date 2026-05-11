## Diagnóstico

A FISPAL FOOD não retorna 462 expositores por dois motivos distintos, um em cada URL testada:

**BUSCA 1 — `fispalfoodservice.com.br/quero-visitar/lista-de-expositores/`**
A página oficial do evento NÃO contém a lista de expositores em HTML. Ela é apenas um teaser que linka para a plataforma da Informa Markets (`app.informamarkets.com.br`). Por isso o engine extraiu só 9 leads — eram itens do header / footer / nav (DISTRITO ANHEMBI, footer, Contatos, Informações, Informa Markets, Links Rápidos…), não expositores.

**BUSCA 2 — `app.informamarkets.com.br/event/fispal-food-service-2026/exhibitors/...`**
Esta página é o app Next.js da Informa Markets, **renderizada por Swapcard**. Ela traz um SSR com `__NEXT_DATA__` contendo um Apollo Cache com:

```text
Core_Exhibitor:RXhoaWJpdG9yXzE0NzQzNzI=   (462 referências)
pageInfo.endCursor: "WzAuMDAwNTY2..."
totalCount: 462
```

O Firecrawl/Caramelo não sabe ler esse formato e cai no fluxo genérico de scraping + paginação infinita, ficando >25 min até estourar (sem timeout efetivo no `handleEventFirecrawl`).

Confirmado por probe direto: `curl` da BUSCA 2 retorna HTTP 200 com `"totalCount":462` no SSR e cursor de paginação válido — não exige login para a primeira página.

## O que precisa mudar

### 1. Novo provider `informa-markets` (Swapcard)
Arquivo: `supabase/functions/lead-sourcing/providers/informa-markets.ts`

Estratégia (mesmo padrão arquitetural do `expofp.ts`):

- **detect**: hostname termina em `informamarkets.com.br` / `informamarkets.com` OU HTML contém `Core_Exhibitor:` + `cdn-api.swapcard.com`.
- **fetch SSR**: GET na URL do evento, extrai `<script id="__NEXT_DATA__">`, lê o Apollo Cache. Pega:
  - `eventId` e `viewId` (do `pageProps.event` e da própria URL base64).
  - Primeira página de expositores (refs `Core_Exhibitor:*` + objetos correspondentes com `name`, `logoUrl`, `bookmarkedCount`, etc.).
  - `pageInfo.endCursor` e `pageInfo.hasNextPage`.
- **paginate via Swapcard GraphQL**: POST `https://app.swapcard.com/api/graphql` (endpoint público usado pelo próprio frontend) com a query `EventViewExhibitors` passando `viewId` + `after: endCursor`. Loop até `hasNextPage = false` ou hit de safety cap (ex.: 2000).
- **normalize**: devolve `{ external_id, name, country, categories, source_url, raw }` igual ao ExpoFPExhibitor.
- **safety**: timeout por request (10s), no-retry agressivo, max 50 páginas.

Exporta no `providers/index.ts`: `tryInformaMarketsFromUrl`.

### 2. Follow automático do link marketing → plataforma
Em `handleEventFirecrawl`, antes do Step 0 atual:

- Se a URL informada NÃO é uma plataforma conhecida (informamarkets, expofp, swapcard, mapyourshow…) e o HTML inicial contiver um link para uma plataforma conhecida (`app.informamarkets.com.br/event/...`, `*.expofp.com`, `*.swapcard.com`), **trocar `eventUrl` pela URL da plataforma** e logar `info: "URL marketing trocada por plataforma de expositores"`.
- Isso resolve o caso BUSCA 1 sem o usuário precisar saber qual link usar.

### 3. Step 0 estendido
Em `handleEventFirecrawl` (~linha 1080):
- Tentar ExpoFP (já existe).
- Se não detectado, tentar `tryInformaMarketsFromUrl`.
- Se algum bater, popular `allExhibitors`, marcar `providerUsed = "informa-markets"`, **pular** todo Firecrawl/AI chunking (mesmo no-op atual do ExpoFP).

### 4. Timeout global do run
Hoje o run pode rodar indefinidamente. Adicionar:
- Constante `MAX_RUN_MS = 5 * 60 * 1000` no início de `handleEventFirecrawl`.
- Helper `isTimeoutExceeded(startTime)` chamado entre cada step grande (após map, após cada batch de scrape, após cada chunk de IA).
- Ao estourar, fechar o run com `status = "completed_partial"`, `error_summary = "Tempo limite excedido — retorne resultados parciais"` e os expositores já coletados.

### 5. Mensagem de erro mais clara
Se nenhum provider bater **e** o scrape genérico devolver <30 expositores num evento que claramente é grande (heurística: HTML > 100KB ou contém palavras como `expositores`, `exhibitors`, `lista`), logar warn:
> "Esta página parece ser apenas um teaser. Cole o link da plataforma de expositores (ex.: app.informamarkets.com.br, *.expofp.com, *.swapcard.com)."

### 6. Memória do projeto
Atualizar `mem://architectural-decision/intelligence/expofp-provider-sourcing` (ou criar `informa-markets-provider-sourcing`) registrando: Informa Markets = wrapper Swapcard; SSR contém Apollo Cache; paginação via GraphQL público; segue redirect marketing→app.

## Arquivos impactados

- `supabase/functions/lead-sourcing/providers/informa-markets.ts` (novo)
- `supabase/functions/lead-sourcing/providers/index.ts` (re-export)
- `supabase/functions/lead-sourcing/index.ts` (Step 0 estendido + follow link + timeout)
- `mem://architectural-decision/intelligence/informa-markets-provider-sourcing` (nova memória)

## Riscos

- Endpoint GraphQL Swapcard público pode ter rate-limit (mitigado: 1 req sequencial, 25 itens por página, headers de browser).
- Estrutura do Apollo Cache pode variar entre eventos (mitigado: parser defensivo + fallback para Firecrawl se SSR não trouxer refs).
- Eventos Informa atrás de login não funcionarão por aqui — nestes casos o provider devolve `{result: null, error: "auth_required"}` e cai no fluxo genérico com mensagem clara.

## Resultado esperado

- BUSCA 1 → engine detecta link `app.informamarkets.com.br`, segue, provider Informa-Markets pagina via Swapcard GraphQL, retorna **~462 expositores** em segundos.
- BUSCA 2 → mesmo provider age direto, **sem hang de 25 min**.
- Qualquer run que travar é morto em 5 min com resultado parcial salvo.

## Fora de escopo

- Login/credenciais Informa Markets (apenas dados públicos do SSR/GraphQL).
- Mudanças em ExpoFP, MapYourShow, A2Z (intactos).
- UI do Kairós (apenas backend).
