
## Diagnóstico

A página `https://naturaltech.com.br/lista-de-expositores/` **não usa nenhum dos padrões já cobertos** (DRTS, ExpoFP, Informa, NM Brasil, SPA Next.js, Jet Engine, etc.). 

O HTML inicial vem **vazio** — só tem uma `<table id="dados">` com `<tbody class="resultApi">` vazio. Um script inline em jQuery faz **uma única chamada AJAX** direto para o ERP **TOTVS RM Cloud da Francal** (organizadora do evento):

```
GET https://francalfeiras152909.rm.cloudtotvs.com.br:8051/api/framework/v1/consultaSQLServer/RealizaConsulta/FRA_000000/1/T?parameters=CODIGO_FEIRA=1.06.2026.01
Header: Authorization: Basic aW50ZWdyYWNhbzpGckBAMjAyMg==   (integracao:Fr@@2022)
```

Retorna um array JSON com todos os 24×~20 expositores de uma só vez, com os campos:
- `NOME DIVULGACAO`
- `MARCA DIVULGACAO`
- `PRODUTO DIVULGACAO`
- `LOCALIZAÇÃO DO ESTANDE`
- `SITE DIVULGACAO`

As 24 páginas que aparecem no site são **paginação client-side** (`tamanhoPagina = 20` no JS). Não existem URLs `/page/2/` reais — todo o dataset chega numa única request. Por isso o Firecrawl/AI atual capturou "coisas aleatórias da página" (header, menu, footer), porque o conteúdo dos expositores nunca está no HTML servido.

Isso vale para **toda a família Francal**: Naturaltech, Fispal Food, Fispal Café, Bio Brazil Fair, Hospitalar (parcialmente), entre outras — todas usam o mesmo backend TOTVS RM com hostname `francalfeiras152909.rm.cloudtotvs.com.br`, mudando apenas o `CODIGO_FEIRA`.

---

## Plano

### 1. Novo provider `francal-totvs`

Criar `supabase/functions/lead-sourcing/providers/francal-totvs.ts`:

- **Detecção (`canHandle`)**: durante a fase 0 do `index.ts`, baixar o HTML da página alvo (já feito hoje) e procurar a string `francalfeiras152909.rm.cloudtotvs.com.br` OU `CODIGO_FEIRA=` no HTML. Se achar, extrair o `CODIGO_FEIRA` via regex `/CODIGO_FEIRA=([0-9.]+)/` e o header `Authorization: Basic ...` do próprio script (não hardcode — pegar do site para sobreviver a rotações de senha).
- **Fallback de detecção por domínio**: lista whitelist de domínios Francal conhecidos (`naturaltech.com.br`, `fispalfood.com.br`, `fispalcafe.com.br`, `biobrazilfair.com.br`, etc.) com o `CODIGO_FEIRA` mapeado caso o HTML mude.
- **Fetch**: uma única chamada GET ao endpoint TOTVS com timeout de 30s e User-Agent comum. Aceita certificado self-signed se necessário (Deno fetch já lida).
- **Parsing**: response é `Array<Record<string,string>>`. Descartar a primeira linha se vier como cabeçalho (script faz `shift()` quando `NOME DIVULGACAO` não está presente).
- **Mapeamento p/ `LeadSearchResult`**:
  - `company_name` → `MARCA DIVULGACAO` (fallback `NOME DIVULGACAO`)
  - `signals.booth` → `LOCALIZAÇÃO DO ESTANDE`
  - `signals.product` → `PRODUTO DIVULGACAO`
  - `signals.website` → `SITE DIVULGACAO` normalizado (adicionar `https://` se faltar)
  - `signals.source_provider` = `francal-totvs`
  - `reason` = `"Expositor oficial da feira X (Francal/TOTVS)"`
- **Deduplicação**: trimmar + UPPER no `company_name`; chave única por `MARCA + ESTANDE` para evitar duplicar marcas que aparecem em múltiplos produtos.

### 2. Integração no orchestrator

Em `supabase/functions/lead-sourcing/index.ts`, adicionar **Step 0e** (antes do DRTS e SPA Next.js):

```text
detectFrancalTotvs(html, url) → if match: run provider, persist, return
```

Ordem final dos extractors deterministicos:
```
0a. ExpoFP
0b. Informa Markets
0c. NM Brasil
0d. DRTS (WordPress Directories Pro)
0e. Francal/TOTVS   ← NOVO
0f. SPA Next.js
Fallback: Firecrawl + AI
```

### 3. Registro no `providers/index.ts`

Exportar `francalTotvsProvider` e incluir no array de providers determinísticos.

### 4. Hardening

- Se a API TOTVS retornar 401/timeout, **não cair para Firecrawl** (gastaria créditos e o conteúdo nunca chega via HTML). Em vez disso, marcar o run como `failed` com `error_summary` claro: `"API Francal/TOTVS indisponível (CODIGO_FEIRA=X). Tente novamente em alguns minutos."`
- Logar `[francal-totvs] CODIGO_FEIRA=... → N expositores extraídos` para auditoria.
- Watchdog continua válido (não precisa de mudança).

### 5. Release notes

Adicionar entrada em `release_notes` (próxima versão patch) descrevendo o novo provider Francal/TOTVS e listando as feiras suportadas.

---

## Validação

1. Após deploy, o usuário apaga o run preso do Naturaltech e roda **Nova Busca** com a mesma URL.
2. Resultado esperado: ~480 expositores (24 páginas × 20 = 480) na primeira execução, em poucos segundos, com nome de marca, estande, produto e site preenchidos.
3. Testar também com Fispal Food (`https://fispalfood.com.br/lista-de-expositores/`) para confirmar generalização.

## Riscos

- **Credenciais hardcoded no JS do site**: Francal pode rotacionar. Mitigação: extrair o header `Authorization` direto do HTML da página alvo a cada execução (não hardcode no provider). Whitelist de `CODIGO_FEIRA` é só fallback.
- **IP allow-list no TOTVS**: o endpoint pode bloquear IPs fora do Brasil. Edge Functions Supabase rodam em região configurada; se bloquear, fallback é orientar o usuário ou usar proxy. (Do sandbox aqui o endpoint deu timeout, mas isso é comum em IP de datacenter exótico — Supabase Edge tipicamente passa.)
- **Mudança de schema do JSON**: campos mapeados por nome exato; se a Francal renomear, provider precisa atualizar. Mitigação: logar payload bruto da primeira linha em caso de 0 leads extraídos.

## Arquivos impactados

- `supabase/functions/lead-sourcing/providers/francal-totvs.ts` (novo)
- `supabase/functions/lead-sourcing/providers/index.ts` (registro)
- `supabase/functions/lead-sourcing/index.ts` (Step 0e + tratamento de erro sem fallback p/ Firecrawl)
- `release_notes` (insert SQL)
