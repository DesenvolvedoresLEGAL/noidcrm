## Diagnóstico forense — FISPAL FOOD 2026

Run `e6d2f0b4-b9f4-403e-bb1e-39761269b6d6` foi disparado em **2026-05-11 17:00:57** e está `status='running'` desde então (mais de 4 dias), `last_heartbeat_at = NULL`, `finished_at = NULL`, `retry_count = 0`, `error_summary = NULL`. **Nenhum prospect foi criado** (`prospects` = 0). É o único run da FISPAL no histórico — o usuário não conseguiu iniciar outro porque a UI ainda enxerga este como "em execução".

Linha do tempo dos `run_events` (todos em ~60 segundos):

```
17:00:58  Execução iniciada
17:01:00  Mapeando URL do evento
17:01:31  1 páginas descobertas
17:01:34  Shell vazio de SPA detectado (react)
17:01:38  SPA com infinite-scroll → Firecrawl 8 rodadas vazias (esperado: SPA Apollo)
17:01:56  Swapcard GraphQL extraiu 460 expositores via cursor   ✅
17:01:57  Parser de markdown extraiu 462 expositores antes da AI ✅
…  (silêncio absoluto desde então)
```

Ou seja: o **provedor Swapcard/Informa funcionou perfeitamente** (462 expositores em mãos, batendo com os 467 do site). O run morreu **depois** disso, dentro do **Step 4 (loop de extração com IA)** — `gpt-5-mini` é chamado de novo sobre o mesmo HTML/markdown da SPA, em chunks, e a Edge Function bate o teto de wall-clock do Supabase (~150s livre / ~25min com `waitUntil`) **antes** de chegar no Step 5 (dedupe + persist). Como nada é persistido incrementalmente e nenhum heartbeat é gravado, o registro fica "running" para sempre, bloqueando a UI.

Causas combinadas:
1. AI loop redundante mesmo quando o provedor determinístico (Informa/Swapcard, ExpoFP) já entregou a lista completa.
2. Persistência só no fim do pipeline → tudo se perde se houver timeout.
3. Sem `last_heartbeat_at` gravado a cada etapa → recuperador automático não consegue marcar runs zumbi.
4. URL com `?filters=...` (segmentação UFM) é repassada como `formattedEventUrl` e usada também no Firecrawl, gerando 8 rodadas inúteis antes do GraphQL — desperdiça budget e tempo.

## Plano de correção

### 1. Curto-circuitar o AI loop quando provedor determinístico funcionou
`supabase/functions/lead-sourcing/index.ts`
- Após o bloco Swapcard (linha ~1937–1953) e o bloco ExpoFP, setar `deterministicProviderHit = true` quando `swapcardExhibitors.length >= 20` (ou ExpoFP ok).
- Se `deterministicProviderHit`, pular Step 4 (AI chunks) e Step 4b (HTML híbrido). Continuar direto para dedupe/persist.
- Logar `Provider determinístico completo, AI loop pulada` para visibilidade.

### 2. Persistência incremental + heartbeat
- Logo depois de Swapcard/ExpoFP devolverem N expositores, executar dedupe + insert em lotes de 25 e atualizar `playbook_runs.last_heartbeat_at = now()` + `stats.persisted_prospects` a cada lote.
- Garante que mesmo se algo falhar adiante o usuário tem 462 prospects no Caramelo.

### 3. Recuperação de runs zumbi
- Acrescentar update de `last_heartbeat_at` em **todos** os `logRunEvent` críticos (já temos índice `idx_playbook_runs_heartbeat`).
- Criar (ou reusar) função SQL `mark_stale_playbook_runs_failed()` que marca como `failed` runs `running` com `last_heartbeat_at < now() - interval '15 min'` (ou `started_at` se heartbeat null). Disparar via cron `pg_cron` a cada 5 min. Mensagem: "Execução interrompida por timeout — reabrir busca para tentar novamente".

### 4. Não desperdiçar Firecrawl em SPA conhecida
- Quando `detectInformaMarkets(eventUrl)` ou `detectExpoFP(eventUrl)` retornarem positivo, **pular** o bloco Firecrawl/scroll resiliente inteiro e ir direto para o provedor nativo. Hoje gastamos 8 rodadas Firecrawl mesmo sabendo que a página é Apollo SPA.
- Sanitizar `formattedEventUrl` removendo `?filters=...` antes de logar/comparar identidade do evento (a paridade GraphQL já ignora filters).

### 5. Recuperar o run da FISPAL
- Migration única que marca o run `e6d2f0b4-b9f4-403e-bb1e-39761269b6d6` como `failed` com `error_summary = 'Recuperado: timeout silencioso após Swapcard extrair 462 expositores; pipeline corrigido — abrir nova busca'` para liberar a UI.

### 6. Validação
- Rodar `supabase--curl_edge_functions` chamando `lead-sourcing` com a URL exata da FISPAL após deploy.
- Conferir em `playbook_runs` / `prospects` que finalizou em < 60s com 462 linhas e `status = completed`.
- Conferir que o ExpoFP do APAS continua funcionando (regressão).

## Arquivos impactados

```text
supabase/functions/lead-sourcing/index.ts        (curto-circuito + heartbeat + persist incremental + skip Firecrawl em SPA)
supabase/functions/lead-sourcing/providers/informa-markets.ts   (sanitizar query string ?filters=)
supabase/migrations/<timestamp>_*.sql            (mark_stale_playbook_runs_failed + cron + reset run FISPAL)
```

Sem alterações em UI / serviços frontend — a página `KairosHub` segue lendo `playbook_runs` normalmente.

## Riscos
- Pular AI loop em outros eventos não-Informa/ExpoFP por engano: protegido pela flag `deterministicProviderHit` (só liga quando o provider devolveu >= 20).
- Cron marcando como failed um run legitimamente longo (>15min): hoje nenhum run saudável passa de 4min; se necessário aumentar para 25min.
