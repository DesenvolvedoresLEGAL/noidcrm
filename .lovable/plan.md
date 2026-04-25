## Diagnóstico (a partir dos logs reais da run FEIMEC 2026)

A run da Feimec quebrou por **três problemas combinados**, não um só. Já validei cada um nos `run_events` da DB:

| Etapa do log | O que aconteceu | Por quê |
|---|---|---|
| `Fallback direto: html_chars=407692, markdown_chars=1893, az_links_found=0` | Capturou shell HTML pesado (Angular bundle) com markdown praticamente vazio | `app.informamarkets.com.br` é SPA Angular que renderiza 100% via JS — `fetch()` direto traz só o `<app-root>` vazio |
| `Iniciando paginação: 14 páginas adicionais (max detectado: 1) … pages_captured: 14` | "Capturou" 14 páginas extras (?page=2..15) totalizando 6MB | Falsa-vitória: cada página retornou o **mesmo shell Angular**, infloou o tamanho mas não tem expositores. Critério de validade (`stand|expositor|exhibitor|booth`) bate no shell global |
| `SPA detectada com filtro A-Z` (8s para 26 letras com waitFor:4000) | Disparou estratégia A-Z falsamente (heurística achou "A | B | C" no shell) e gastou 0 tempo útil | Heurística A-Z muito permissiva + cliques em seletores que não existem na página |
| `Parser de markdown extraiu 32 expositores antes da AI` | 32 falsos positivos vindos do shell genérico | Padrão de heading H2/H3 capturou strings do menu/UI |
| **Travou aqui por 13 min** | Loop de IA processou 15 conteúdos × até ~150 chunks de 40KB cada, serial, sem timeout total | Sem watchdog na fase de IA — usuário precisou forçar conclusão |

**Conclusão:** o pipeline atual assume que `fetch()` direto + paginação `?page=N` resolve tudo. Para SPAs reais (Angular/React renderizado client-side), precisamos **sempre** passar por Firecrawl com `proxy:stealth` + scroll, e **detectar quando o shell é vazio** para abortar caminhos inúteis (paginação falsa, A-Z falso, parsers de markdown).

---

## O que NÃO vou mexer (proteção do que funciona — Bet Brasil)

- ✅ Firecrawl `/v1/map` para descobrir páginas
- ✅ Detecção de paginação `?page=N` para sites estáticos com markdown rico
- ✅ Scrape inicial com `actions: scroll` (60×) para `/v1/scrape`
- ✅ Parser de markdown H2/H3, parser híbrido HTML, extração com IA (gpt-5-mini)
- ✅ Dedupe intra-run, scoring, persistência em batches

A lógica continua **idêntica** quando o conteúdo capturado é rico em texto. Só adiciono caminhos novos quando detectamos shell vazio de SPA.

---

## Mudanças propostas

### 1. Detector de "shell vazio de SPA" (novo helper)

Função `isEmptyShell(html, markdown)` que retorna `true` quando:
- `markdown.length < 5_000` E
- HTML contém marcadores típicos (`<app-root`, `<div id="root"`, `ng-version=`, `data-reactroot`, `<noscript>You need to enable JavaScript`)

Quando isso acontece para o **fallback direto**, marcar a página como `requires_js_render = true` em vez de empurrar pro `scrapedContents`.

### 2. Pular paginação `?page=N` quando o conteúdo-base é shell vazio

Hoje, `shouldPaginate` dispara se `looksLikeListing && scrapedContents.length > 0` — sem checar **qualidade**. Vou adicionar:
- Se a página-base é `isEmptyShell` (markdown < 5KB), **não** gerar `?page=2..15` brute-force (evita os 6MB de shells repetidos da Feimec)
- Manter brute-force quando há detecção real de `?page=N` no HTML OU quando markdown-base tem >5KB de conteúdo real

### 3. Refinar a heurística A-Z (eliminar falsos positivos)

Hoje qualquer `A | B | C` no markdown ativa A-Z. Vou exigir **pelo menos um match concreto de seletor**:
- `data-letter="A"` OU `data-filter="A"` OU `class="alpha-filter"` OU `class="letter-filter"`
- A regex genérica `/<a[^>]*>[A-Z]<\/a>/` é muito frouxa — exigir contagem ≥10 letras distintas em links isolados

`forceAlphaStrategy` por host conhecido fica intocado (Bet Brasil continua forçada).

### 4. Nova estratégia: **Infinite-Scroll Aggressive** para SPAs sem A-Z

Quando `isSpaLike && !hasAlphaFilter && !forceAlphaStrategy` (ramo "deep scroll" de hoje), substituir o single-shot de 120 scrolls por **scroll progressivo com early-stop**:

```ts
// 4 rodadas de 60 scrolls cada, com proxy stealth
// A cada rodada: comparar tamanho do markdown com a anterior
// Se crescimento <5% por 2 rodadas seguidas → stop (atingiu fundo)
// Se crescimento >5% → continuar até max 4 rodadas
```

Vantagens:
- Para Feimec, quebra em sub-jobs de Firecrawl (timeout 180s cada) em vez de 1 chamada de 300s que arrisca timeout
- Evita gastar budget se já chegou ao fim cedo
- Usa `waitFor: 6000` (Angular hidrata devagar) e `formats: ["html", "markdown"]`
- **Atualiza** `scrapedContents[0]` com o melhor resultado, não acumula shells duplicados

### 5. Watchdog na fase de IA (impede travamentos como o de 13 min)

Adicionar `Promise.race` com timeout de **6 minutos** no loop completo de extração IA (`Step 4`). Se estourar:
- Loga `warn: "AI extraction timeout, usando apenas resultados parciais"`
- Continua para Step 4b (extração híbrida HTML) com o que já tem
- Garante que a run sempre chega ao status final e ao `persist`

Já existe um watchdog global, mas ele só dispara depois de 10+ min sem update de status. Esse watchdog é **interno** ao Step 4 e mais agressivo.

### 6. Filtrar parser de markdown contra shell vazio

No Step 3.5 (parser markdown H2/H3), pular `scrapedContents` cujo `markdown.length < 3_000` E `isEmptyShell(html, markdown)`. Evita os 32 falsos positivos da Feimec.

### 7. Métricas adicionais nos `run_events`

Logar explicitamente:
- `spa_detected_kind: "angular" | "react" | "vue" | "unknown"` 
- `infinite_scroll_rounds: N`
- `infinite_scroll_growth_per_round: [chars1, chars2, ...]`
- `ai_extraction_timed_out: bool`

Ajuda muito o próximo debug e alimenta o feedback loop de sourcing.

---

## Arquivos impactados

### Editar
- **`supabase/functions/lead-sourcing/index.ts`** (único arquivo da edge) — mudanças isoladas em 4 trechos:
  - Adicionar helpers `isEmptyShell()` e `detectSpaFramework()` no topo
  - Step 2 (fallback direto, ~linha 1048-1078): marcar `requires_js_render` em vez de aceitar shell vazio cego
  - Step 2c (paginação, ~linha 1080-1169): pular brute-force quando base é shell vazio
  - Step 3a (SPA strategy, ~linha 1171-1267): refinar heurística A-Z + nova `infiniteScrollAggressive()`
  - Step 4 (IA, ~linha 1373-1488): wrapper `Promise.race` com timeout 6min
  - Step 3.5 (parser markdown, ~linha 1322-1366): pular shells vazios

### Criar
- Nada novo. Tudo cabe no `index.ts` existente para não fragmentar a função.

### NÃO mexer
- `supabase/functions/run-enrichment/`, `import_prospect_to_pipeline` RPC, `RecentRunsList.tsx`, `RunDetailDrawer.tsx`, `useForceCompleteRun` — já funcionando
- Lógica de scoring, dedupe, persistência, autoImport
- Caramelo Engine v5 (chunking híbrido) e padrão fallback determinístico

---

## Validação após implementar

1. **Smoke test Bet Brasil 2026** — re-rodar (ou comparar logs) garantindo:
   - Mesmas 447 prospects (±5%)
   - Mesma estratégia A-Z executada (forceAlphaStrategy via host conhecido)
   - Tempo <8 min como antes

2. **Smoke test Feimec 2026** — rodar nova execução:
   - Esperado: detectar shell vazio, pular paginação falsa, executar Infinite-Scroll Aggressive com 2-4 rodadas, capturar markdown >50KB com nomes reais
   - Run finaliza em <10 min com prospects > 0
   - Se a Firecrawl ainda não conseguir renderizar Angular pesado mesmo com `proxy:stealth`, log explícito + fallback `completed_empty` claro (não trava)

3. **Inspecionar `run_events`** da nova execução Feimec para confirmar novas métricas

---

## Riscos & mitigação

| Risco | Mitigação |
|---|---|
| Mudar heurística A-Z pode afetar Bet Brasil | `forceAlphaStrategy` por host (`bettshow.com`) continua intocado — Bet sempre roda A-Z |
| Watchdog de IA cortar runs grandes legítimas | Timeout de 6min é generoso (Bet Brasil rodou em 6,2min total — fase IA é menor que isso). Se cortar, ainda persiste o que já extraiu |
| Firecrawl `proxy:stealth` é mais caro/lento | Já usado hoje na rota A-Z; só passa a ser usado em SPAs sem A-Z (caso novo) |
| Angular SPAs como Feimec podem genuinamente bloquear scraping | Aceitar como `completed_empty` claro com mensagem orientando o usuário a tentar evento de dia diferente / reportar URL alternativa |

---

## Próximos passos (depois deste fix)

- Adicionar configuração de "estratégia preferida" por host conhecido (ex: `informamarkets.com.br → infinite_scroll_aggressive`) na tabela `lead_source_strategies`
- Métricas no Histórico mostrando qual estratégia capturou cada run (já temos `executionLog` mas não exibido)