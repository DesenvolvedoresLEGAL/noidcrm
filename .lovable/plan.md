## Diagnóstico (confirmado pelos logs do run da FEIMEC)

A FEIMEC roda em `app.informamarkets.com.br` (React SPA com infinite-scroll, sem filtro A-Z). O motor entrou no branch correto (`infinite-scroll progressivo`), mas as chamadas ao Firecrawl voltaram **0 chars** nas duas rodadas:

```
Infinite-scroll rodada 1/4: 0 chars (crescimento -100%)  → 60 scrolls, waitFor 6000ms
Infinite-scroll rodada 2/4: 0 chars (crescimento 0%)     → 120 scrolls, waitFor 6000ms
Early-stop disparado → fica com o shell original (1893 chars)
Parser pegou só 2 expositores → AI extraiu 201 → CRM persistiu 151 (parou na letra C)
```

**Causa raiz**: Firecrawl está estourando o orçamento interno da request quando recebe `60+ scrolls × (5 amount + 700ms wait)` em uma única chamada. Quando isso acontece, ele responde HTTP 200 mas com `data.markdown = ""`, então nosso código acha que "não cresceu" e para. Pior: a rodada 2 manda **120 scrolls cumulativos**, agravando o timeout. O resultado é que **o infinite-scroll nunca dispara de fato** na FEIMEC.

A BETT funciona porque cai no branch `forceAlphaStrategy` (host `bettshow.com`) — esse caminho é totalmente independente e **não será tocado**.

## Objetivo

Capturar as ~780 empresas da FEIMEC sem quebrar:
- BETT BRASIL (A-Z forçado por host) — caminho intocado
- Páginas estáticas paginadas — caminho intocado
- Outras SPAs já funcionais

## Plano de correção (escopo cirúrgico em `supabase/functions/lead-sourcing/index.ts`)

### 1. Reescrever o branch `Infinite-Scroll Aggressive` (linhas ~1291–1394)

Trocar a estratégia "scrolls cumulativos numa única request" por **rodadas curtas e empilháveis** que respeitam o orçamento do Firecrawl e detectam respostas vazias como falha (não como "fim do conteúdo"):

- **Scrolls por rodada constantes (não cumulativos)**: 25 scrolls × 600ms = ~15s de ações + render → cabe folgado em uma request de 120s.
- **Mais rodadas, menos peso por rodada**: `MAX_ROUNDS = 8` (era 4). Worst-case 8 × ~25s = 3min, vs 12min do desenho atual.
- **Estratégia de carrinho**: cada rodada começa **da posição final da anterior**, simulada por `scrollTo bottom` antes do scroll incremental. Como Firecrawl não persiste estado, mandamos o conjunto crescente, mas com `amount` maior por scroll para diminuir o número de ações:
  - Rodada N: `scroll(direction:'down', amount: 10)` × 25 + waits curtos. Total de ações por request constante.
- **Resposta vazia = falha, não fim**: se `markdown.length === 0` e `html.length < 1000`, **não conta como "growth = 0"**. Loga `"Resposta vazia do Firecrawl, possível timeout interno"` e tenta a mesma rodada **uma vez** com `waitFor=8000` e sem `proxy:stealth` (fallback). Só então marca como falha.
- **Early-stop só por crescimento real**: `smallGrowthStreak` só incrementa quando a resposta foi **válida** (>1000 chars) e crescimento <5%. Empty/failed não conta.
- **Hard-stop por tempo de parede**: total acumulado da fase de scroll limitado a 6 min (`Date.now() - phaseStart`), como rede de segurança.
- **Persistência incremental**: a cada rodada bem-sucedida, atualiza `scrapedContents[0]` imediatamente (não só no fim). Se o run falhar/timeout depois, o melhor markdown já está salvo para a fase de extração de IA.

### 2. Rota direta como fallback final

Se após todas as rodadas `bestMarkdown.length < 5000`, fazer **uma última tentativa via Firecrawl `crawl`** apontando para o mesmo URL com `limit: 50, maxDepth: 1, scrapeOptions.actions: [scrolls]`. O `crawl` tem timeout interno mais generoso e historicamente entrega payloads que `scrape` perde em SPAs pesadas. Esse fallback só roda quando o scroll progressivo não progrediu — não impacta BETT/estáticas.

### 3. Refinar a heurística de "resposta vazia" do Firecrawl globalmente (mínimo)

Adicionar helper `isFirecrawlEmpty(scrapeData)` que retorna `true` quando `data.markdown` e `data.html` são ambos vazios/curtos. Usar **só** dentro do branch infinite-scroll novo (não nos demais call-sites, para não mexer no que está estável).

### 4. Logs explícitos

Adicionar logs por rodada com `attempt`, `wait_ms`, `proxy_mode`, `chars`, `growth_pct`, `accumulated_phase_ms`. Isso permite diagnosticar futuras regressões sem adivinhar.

### 5. Aviso visual no card "Recent Runs" (opcional, sem código novo de UI)

Já temos campos suficientes em `stats`. Nenhuma alteração de frontend nessa rodada.

## Garantias de não-regressão

| Caminho | Estado atual | Após mudança |
|---|---|---|
| BETT (A-Z forçado por host) | branch `forceAlphaStrategy` linha 1247 | **idêntico, intocado** |
| Páginas estáticas paginadas | branch de paginação linhas ~950–1003 | **idêntico, intocado** |
| Páginas estáticas com map farto | branch padrão linhas ~1006–1071 | **idêntico, intocado** |
| SPA com A-Z genuíno (≥5 data-letter) | `hasAlphaFilter = true` linha 1238 | **idêntico, intocado** |
| SPA com infinite-scroll (FEIMEC) | rodadas cumulativas + 0 chars = early-stop falso | **rodadas curtas + detecção de empty + crawl fallback** |

## Riscos

- **Custo Firecrawl**: 8 rodadas × ~25s vs 4 rodadas × até 180s. Custo total tende a **cair**, não subir.
- **Tempo total do run**: limite de 6min para a fase scroll, alinhado com o watchdog de IA já existente (também 6min).
- **Crawl fallback**: só dispara quando scroll fracassou; consumo extra controlado por `limit: 50, maxDepth: 1`.

## Arquivos impactados

- `supabase/functions/lead-sourcing/index.ts` (apenas o bloco `else` do A-Z, linhas ~1291–1394, + um helper novo)

## Validação após deploy

1. Disparar nova busca FEIMEC 2026 (mesmo URL): esperar ≥500 expositores extraídos.
2. Disparar nova busca BETT BRASIL 2026: esperar mesmas ~447 leads (regressão check).
3. Conferir `run_events` da FEIMEC: rodadas devem mostrar crescimento real (>5%) nas primeiras 3-5 rodadas.

## Próximo passo

Aprove este plano para eu aplicar a alteração na edge function `lead-sourcing` e re-deployar imediatamente.