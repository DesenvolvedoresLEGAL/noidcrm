
## Diagnóstico

O site `abfexpo.com.br/expositores-2026/` **não** é o Swapcard (app.informamarkets.com.br) e por isso o provider `informa-markets.ts` atual não pega — ele só detecta hosts `*.informamarkets.com(.br)` com path `/event/.../exhibitors/...`.

O site da ABF é um Next.js marketing da Informa que renderiza um módulo `informa-exhibitor-list-module` vazio no SSR e busca os expositores client-side numa **API pública sem autenticação**:

```
GET https://api-connect.informamarkets.com/api/v1/editions/BRZ26ABF/listings?lang=pt&page=1&limit=50
```

Verificado: retorna 205 expositores da ABF Expo 2026 em 5 páginas (status 200, ~80KB/página), com `paging.next` para iterar. O código da edição (`BRZ26ABF`) está embutido no payload SSR do Next.js como `"eventEditionCode":"BRZ26ABF"` (escapado dentro de `self.__next_f.push(...)`).

Esse padrão cobre toda a rede de marketing Informa BR (ABF Expo, Fispal, Hospitalar, etc.), não só ABF.

## Plano

**Sem mexer em nenhum provider existente.** Adicionar 1 provider novo e plugá-lo no orquestrador.

### 1. Novo provider `supabase/functions/lead-sourcing/providers/informa-connect.ts`

Exporta:

- `detectInformaConnect(url, html?)` — retorna `{ editionCode, eventSiteUrl }` quando:
  - URL aponta para um site Informa marketing (heurística: HTML contém `informa-exhibitor-list-module` **ou** `BaseLayout_wrapper` **ou** `"eventEditionCode":"..."`); **e**
  - consegue extrair o `eventEditionCode` via regex `/"eventEditionCode"\s*:\s*"([A-Z0-9_]+)"/` no HTML cru (cobre tanto JSON puro quanto a forma escapada `\"eventEditionCode\":\"...\"` do streaming Next.js).
- `fetchInformaConnectExhibitors(editionCode, eventSiteUrl)` — pagina `/api/v1/editions/{code}/listings?lang=pt&page=N&limit=50` enquanto `data.paging.next` existir. Hard cap de 100 páginas (5000 expositores) por segurança.
- `tryInformaConnectFromUrl(url)` — orquestra: faz `fetch` da URL → detecta → busca → normaliza.

Normalização do item da API → schema padrão de exhibitor já usado pelos outros providers (`external_id`, `name`, `website`, `logo_url`, `source_url`, `booth`, `categories`, `address`):

| Campo Kairós | Origem na API |
|---|---|
| `external_id` | `item.id` (com prefixo `informa-connect:`) |
| `name` | `item.title` |
| `website` | `item.website_url` ou `item.company.website` (vazio se placeholder) |
| `logo_url` | `item.logo.original` (descartar se contiver `logo_placeholder`) |
| `source_url` | `${eventSiteUrl}/elisting/${item.slug}` (ex: `https://www.abfexpo.com.br/elisting/5asec`) |
| `booth` | `item.booths[0].booth_number` |
| `categories` | `Object.values(item.categories || {})` |
| `address` | composição de `item.address` (rua, cidade, estado, país) |

### 2. Registrar no `providers/index.ts`

Adicionar export do novo provider (mantendo todos os existentes intactos).

### 3. Plugar no `supabase/functions/lead-sourcing/index.ts`

Inserir a chamada `tryInformaConnectFromUrl` **antes** do fallback genérico (Firecrawl/AI hybrid) e **depois** dos providers mais específicos já registrados (ExpoFP, Informa Markets/Swapcard, DRTS, Francal/Totvs, InfraFM, MundoGeo, NM Brasil, SPA Next.js). Ordem importa: o provider só reivindica a URL quando o regex acha `eventEditionCode`, então não há risco de roubar URL de outro provider.

### 4. Telemetria

Logar no `run_events` (padrão já usado pelos outros providers): `provider="informa-connect"`, `edition_code`, `total_exhibitors`, `pages_fetched`, `firecrawl_credits_used=0`.

## Detalhes técnicos

- **Auth**: nenhum header especial necessário. Testado via `curl` retornando 200 sem cookie/token.
- **Rate**: 5 páginas paralelas seguras; vou paginar **sequencialmente** (igual ExpoFP/Informa Markets) para não estressar o backend público da Informa.
- **i18n**: hardcoded `lang=pt` (mesmo padrão do site).
- **Edge cases**:
  - Página sem `eventEditionCode` no HTML → provider retorna `null` e deixa o fallback agir.
  - `data.paging.next === ""` → fim da paginação.
  - `logo.original` contém `/sites/default/files/logo_placeholder_` → tratar como sem logo.
  - `website_url` vazio é comum → deixar `null`, enriquecimento Apollo/Caramelo cuida depois.

## Arquivos afetados

- **NOVO**: `supabase/functions/lead-sourcing/providers/informa-connect.ts`
- `supabase/functions/lead-sourcing/providers/index.ts` (apenas adicionar exports)
- `supabase/functions/lead-sourcing/index.ts` (adicionar 1 bloco try/await na cadeia de providers)

## Garantias de não-quebra

- Zero alteração em `informa-markets.ts`, `expofp.ts`, `spa-nextjs.ts`, `drts-directory.ts`, `francal-totvs.ts`, `infrafm.ts`, `mundogeo.ts`, `nm-brasil.ts`.
- Detecção exige match positivo (`eventEditionCode` regex) — URLs já cobertas por outros providers não acionam este.
- Mesmo schema de saída dos demais providers → consumidores downstream (matching, enrichment, dedupe) não mudam.

## Riscos

- Se a Informa rotacionar o endpoint público (improvável, é a API que alimenta todos os sites institucionais deles), revalidar a URL base. Detecção fica isolada num único arquivo.
- Sem proteção anti-bot observada hoje; se aparecer, basta adicionar `User-Agent` realista ao fetch.

## Próximos passos após aprovação

1. Implementar `informa-connect.ts`.
2. Plugar no orquestrador.
3. Deploy de `lead-sourcing`.
4. Testar rodando Kairós em `https://www.abfexpo.com.br/expositores-2026/` e validar 205 expositores importados sem créditos Firecrawl.
5. Atualizar memória `mem://architectural-decision/intelligence/` com o novo provider.
