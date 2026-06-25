
## Diagnóstico

A página `fi-events.com.br/quero-visitar/lista-de-expositores/` é só uma casca de marketing. O conteúdo real vem de um iframe Swapcard:

```
https://visitor.figlobal.com/widget/event/fi-south-america-2026/exhibitors/RXZlbnRWaWV3XzEyMzQ1Mzk=?paginationMode=infinite
```

`visitor.figlobal.com` é **o mesmo Next.js + Apollo + Swapcard** que `app.informamarkets.com.br` (mesmo `/api/graphql`, mesma persisted query `b3cb76208b…`, mesmo `EventExhibitorListViewConnectionQuery`, mesmo schema de resposta). Confirmei por probe direto: retorna `totalCount: 191` exibidores ("3D Essence Food", "Ad Foods", "ADICEL"…).

O provider `informa-markets.ts` hoje só dispara quando o host casa `informamarkets.com(.br)` (regex `HOST_RE`) ou quando o HTML da página de marketing contém um link para esse host (regex `findInformaMarketsLinkInHtml`). FI Events linka para `visitor.figlobal.com` → nenhum provider dispara → cai no Firecrawl genérico → falha igual ao caso Informa antigo.

## Correção (mínima, cirúrgica)

Generalizar o provider Informa para reconhecer **todos os hosts Swapcard-powered conhecidos**, sem mexer em mais nada do pipeline.

### Arquivo: `supabase/functions/lead-sourcing/providers/informa-markets.ts`

1. Substituir `HOST_RE` por uma lista/regex de hosts suportados:
   - `informamarkets.com` / `informamarkets.com.br` (mantém)
   - `visitor.figlobal.com` (novo — FI Events, Vitafoods, Food Ingredients globais)
   - Manter aberto a adicionar outros subdomínios `*.figlobal.com` se aparecerem.

2. `findInformaMarketsLinkInHtml`: aceitar também links `https://visitor.figlobal.com/(widget/)?event/.../exhibitors/...`. Continua priorizando link canônico (sem `/widget/`) quando existir.

3. `detectInformaMarkets`: já lê origin do URL — sem mudança lógica, apenas passa o novo host. O `origin` resultante (`https://visitor.figlobal.com`) será usado no `fetch` ao `/api/graphql`, no `x-client-origin` e nas tentativas SSR (`/event/...` e `/widget/event/...`).

4. Nada muda em `fetchPage`, `normalizeExhibitor`, headers (Swapcard aceita o mesmo `x-client-platform: Event App` e a mesma persisted query — validado).

### Arquivo: `supabase/functions/lead-sourcing/index.ts`

Renomear apenas labels/logs onde aparece "Informa Markets" para algo mais genérico, **opcional e cosmético** — sem mudar nomes de provider expostos (`providerUsed = "informa-markets"`) para não quebrar dashboards/feedback loop existentes. Preferência: manter `providerUsed = "informa-markets"` e adicionar `metrics.informa_host` para distinguir nas métricas.

## Risco

- **Persisted query hash**: se a Informa rotacionar, o probe atual confirmou que `visitor.figlobal.com` aceita o mesmo hash hoje. Fallback existente (`PersistedQueryNotFound` → falha graciosa → Firecrawl) continua válido para os dois hosts.
- **Nada toca**: ExpoFP, logo-wall, demais providers, índice de prospects, RLS.

## Validação

1. Probe local já feito: `visitor.figlobal.com/api/graphql` com `viewId=RXZlbnRWaWV3XzEyMzQ1Mzk=` retorna 191 exhibitors corretos.
2. Após deploy, re-rodar sourcing em `https://www.fi-events.com.br/quero-visitar/lista-de-expositores/` e conferir métricas: `provider=informa-markets`, `informa_total_count≈191`.
3. Smoke test em URL Informa já suportada (ex.: Fispal) para garantir que não regrediu.

## Próximos passos depois do fix

- Pedir ao usuário para limpar os leads incorretos do FI Events (mesma rotina usada após o ajuste da Expert XP).
- Considerar memory entry “Swapcard providers (figlobal + informamarkets)” na próxima sprint de governança.
