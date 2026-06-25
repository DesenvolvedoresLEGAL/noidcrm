# Fix: Sourcing de páginas de patrocinadores tipo "logo wall"

## Diagnóstico

A página `https://www.expertxp.com.br/patrocinadores/` (e várias outras como Concrete Show, Feiplar, CONARH, Fenabrave) é uma **grade de logos clicáveis**:

```html
<a href="https://www.icatuvanguarda.com.br">
  <img src=".../icatu-vanguarda.png" alt="Icatu Vanguarda" />
</a>
```

O HTML/markdown **não contém o nome da empresa em texto** — apenas a imagem e o link. O pipeline atual envia o markdown convertido pro AI, que então capturou os **títulos das cotas** (`COTA SEGMENTO EXCLUSIVO`, `DIAMANTE`, `OURO`, `PRATA`, `BRONZE`, `COBRE`, `3 DIAS`) como se fossem empresas. Resultado: 19 leads completamente errados.

A solução real é detectar logo walls e extrair os patrocinadores **diretamente do DOM**, sem AI:
- **Nome**: do `alt` do `<img>` (quando preenchido) OU derivado do **domínio** do `<a href>` externo.
- **Site**: do próprio `<a href>`.
- **Logo**: do `<img src>`.

## Mudanças

### 1. Novo provider `logo-wall.ts`
`supabase/functions/lead-sourcing/providers/logo-wall.ts`

- Entrada: HTML cru da página (Firecrawl com `formats: ['html']`).
- Heurística de detecção: agrupar `<a><img></a>` onde o `href` aponta para **domínio externo** (≠ host da página), em densidade ≥ 6 ocorrências, e os `<a>` estão concentrados em uma mesma região DOM.
- Para cada par:
  - `external_domain = new URL(href).hostname` (remover `www.`).
  - `name`:
    1. `img.alt` se não vazio, ≥ 3 chars e não bater em blacklist (`logo`, `patrocinador`, `sponsor`, nomes de tier `diamante|ouro|prata|bronze|cobre`).
    2. fallback: `title` do `<a>`.
    3. fallback final: derivar do domínio (segmento principal sem TLD, capitalizado).
  - `website = href` normalizado.
  - `logo_url = img.src`.
  - `tier` (opcional): captar último `<h2>/<h3>` antes do bloco (ex.: "DIAMANTE", "OURO") como metadado, não como nome.
- Saída no formato padrão do pipeline (`{ name, website, logo_url, signals: ['logo_wall', 'external_domain'], _page_type: 'sponsor_wall', tier? }`).
- Deduplicar por domínio.

### 2. Roteamento no `lead-sourcing/index.ts`

- Antes de cair no extrator AI/markdown genérico, rodar `detectLogoWall(html)`:
  - Se densidade ≥ 6 logos externos: usar **somente** `logo-wall` provider e pular o caminho AI/markdown para evitar contaminação.
  - Se < 6: manter fluxo atual.
- Adicionar `signals: ['logo_wall']` com peso (ex.: 12) e `extraction_method: 'logo_wall'` nas métricas.

### 3. Guardrails no extrator AI atual

No prompt/normalizer que produz prospects a partir de markdown:

- Blacklist absoluta de nomes que são **cotas/tiers de patrocínio** ou seções estruturais:
  `diamante, ouro, prata, bronze, cobre, platina, master, premium, exclusivo, segmento exclusivo, 3 dias, novo na base, todos`.
- Rejeitar candidatos com `name.length ≤ 3` puramente alfabético sem domínio associado.
- Quando o `_page_type` for `sponsor_wall`, **descartar** itens vindos do caminho AI.

### 4. Limpeza dos 19 leads falsos

- RPC admin one-shot para marcar como `discarded` os prospects da última run do Expert XP cujo `name` ∈ blacklist OU `confidence ≤ 1` E `website IS NULL`.
- Não bloqueante: pode ser feito manualmente após validação.

## Arquivos impactados

- `supabase/functions/lead-sourcing/providers/logo-wall.ts` (novo)
- `supabase/functions/lead-sourcing/index.ts` (roteamento + guardrails)
- migration opcional: marcar os 19 leads atuais como descartados.

## Riscos

- Páginas com logos puramente decorativos (parceiros, certificações) podem ser capturados. Mitigação: limiar de densidade ≥ 6 + exigir domínio externo distinto do host.
- `alt` vazio é comum; o fallback por domínio resolve (`icatuvanguarda.com.br` → "Icatuvanguarda" — aceitável; enriquecimento posterior corrige).
- ExpoFP e outros provedores específicos continuam tendo prioridade (não muda).

## Validação

1. Rodar sourcing em `expertxp.com.br/patrocinadores/` → esperar ~70+ patrocinadores reais (Accor, B3, BYD, Localiza Meoo, Icatu, Bradesco, Mapfre, MetLife, etc).
2. Conferir que nenhum lead se chama "DIAMANTE", "OURO", "PRATA", "BRONZE", "COBRE", "3 DIAS".
3. Smoke em outra página tipo wall (ex.: Concrete Show patrocinadores) — sem regressão nos providers existentes (ExpoFP, Swapcard).
