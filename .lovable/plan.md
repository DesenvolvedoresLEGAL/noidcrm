
# KAI.18.5 — Apollo Reliability & Transparency

Objetivo: Kairós volta a ser tão confiável quanto o Apollo direto. Filtros viram recomendações, tudo é explicável e o usuário nunca mais vê "Nenhum contato encontrado" quando o Apollo retornou pessoas.

Escopo: **apenas** enriquecimento Apollo (edge functions + UI do drawer/prospect). Não toca CRM, OTE, Forecast, Revenue Command, Skills.

---

## 1. Backend — Logging e Raw Mode

### 1.1 Nova tabela `apollo_query_logs`
Migration criando tabela para persistir toda chamada Apollo:
- `organization_id`, `prospect_id`, `triggered_by` (user_id)
- `endpoint` (`mixed_people_search` | `people_match` | `organization_enrich` | `reveal`)
- `mode` (`smart` | `raw` | `replay`)
- `request_payload` (jsonb), `request_headers_safe` (jsonb, sem API key)
- `response_status`, `response_body` (jsonb), `apollo_request_id`
- `people_returned`, `people_recommended`, `people_hidden`
- `hidden_reasons` (jsonb: `{role_mismatch: n, company_phone_only: n, score_min: n, dedupe: n, coverage: n, ai: n, other: n}`)
- `credits_used`, `cache_status` (`hit` | `miss` | `expired` | `bypass`)
- `fallback_used` (bool), `latency_ms`, `retries`
- RLS: org members leem; admin vê tudo; edge functions gravam via service_role.
- GRANTs padrão + service_role ALL.

### 1.2 Edge function `kairos-apollo-search` (nova, unificada)
Envolve `mixed_people_search` do Apollo. Aceita `mode: 'smart' | 'raw' | 'replay'`:
- **raw**: chama Apollo, retorna todos os contatos sem qualquer filtro/coverage/score/ICP/skill/governance/heurística. `bypass_cache = true`.
- **smart** (default): mantém pipeline atual, mas em vez de **descartar** contatos, anota `hidden: true` + `hidden_reason` para cada um. Retorna `{people: [...all], recommended_ids: [...], hidden_reasons_summary: {...}}`.
- **replay**: reexecuta payload de um log existente, bypass cache, grava novo log linkado ao original (`replay_of`).
- Sempre persiste em `apollo_query_logs` com `request_id` do Apollo (header `x-request-id`), latência real e créditos.

### 1.3 Cache
- TTL 30 min (hoje suspeita-se de cache negativo indefinido).
- Chave: `hash(endpoint + payload_normalizado)` com escopo por org.
- **Nunca cachear resposta vazia** (`people.length === 0`) por mais de 60s.
- `bypass_cache: true` sempre que `mode !== 'smart'` ou botão "Tentar novamente".
- Registrar `cache_status` no log.

### 1.4 Ajuste em edge functions existentes
- `kairos-apollo-invisible` e `run-apollo-enrichment` passam a chamar `kairos-apollo-search` internamente para reutilizar cache/log/raw handling.
- `kairos-apollo-reveal-contact` grava log com `endpoint=reveal` (não muda lógica; só instrumenta).
- Filtros existentes (cargo, telefone corporativo, score, coverage, IA, governance) deixam de **remover** — passam a **marcar** `hidden_reason`. A decisão final "esconder no default view" fica na UI.

---

## 2. Frontend — Drawer do Prospect

Arquivos principais: `src/components/playbook/ProspectContactsTab.tsx`, `enrichment/*`, novo hook `useApolloSearch`.

### 2.1 Toggle de modo (topo do drawer)
Segmented control:
- `● Verde  Apollo Raw` — resultado bruto
- `● Azul  Kairós` (default) — recomendado

Ao lado, resumo:
```
Apollo encontrou 12  ·  Kairós recomenda 4  ·  [Mostrar todos]
```

### 2.2 Lista de contatos
Renderiza **todos** os contatos retornados (raw ou smart). Em modo smart, contatos com `hidden=true` aparecem em seção "Não recomendados (N)" colapsada, com badges explicando por quê:
- "Cargo diferente do solicitado (Finance vs Marketing) — 31% match"
- "Apenas telefone corporativo"
- "Score abaixo do mínimo"
- "Duplicado"
- "Fora do coverage"

Cada card de contato ganha metadados de origem:
- Origem: Apollo · Tipo: Pessoa · Cargo solicitado / encontrado · Compatibilidade % · Tipo de telefone.

### 2.3 Estado vazio real
Só mostra "Nenhum contato encontrado" quando `people_returned === 0`. Caso contrário: "Apollo encontrou N contatos. Nenhum passou nas recomendações do Kairós. [Ver contatos brutos]".

### 2.4 Aba "Apollo Inspector" (nova, dentro do drawer)
Componente `ApolloInspectorTab.tsx` lista os últimos `apollo_query_logs` do prospect. Cada linha expande em:
- Empresa, domínio, endpoint, tempo, cache status, fallback, status.
- Payload enviado (JSON expandível, copiável).
- Resposta Apollo (JSON expandível).
- Contadores: retornados / exibidos / descartados + breakdown de motivos.
- Créditos.
- Botões: **Reproduzir Busca** (chama `mode=replay`) e **Copiar Request ID**.

### 2.5 Enrichment Timeline
Novo componente ao lado dos contatos, alimentado pelos logs em ordem cronológica:
```
09:21 · Consulta Apollo ✓
09:21 · 2 contatos retornados ✓
09:21 · Coverage executado ✓
09:21 · 1 descartado — telefone corporativo
09:21 · 1 descartado — cargo incompatível
Resultado: 0 exibidos (padrão) · 2 disponíveis (raw)
```

### 2.6 Card "Qualidade Apollo"
No topo do drawer:
- Empresa encontrada / Domínio válido / Funcionários / Perfis públicos / Contatos encontrados / Aproveitados / Aproveitamento % / Motivo principal.

### 2.7 Painel Apollo Debug (admin only)
Rota `/kairos/apollo-debug` (ou aba escondida atrás de `platform_admin`): tabela paginada de `apollo_query_logs` cross-org com filtros por endpoint/status/latência/cache/fallback. Detalhe com headers seguros, request/response completos, latência, retries.

---

## 3. Telemetria
Emitir em `system_events` (canal existente):
`apollo_raw_opened`, `apollo_show_all`, `apollo_contacts_hidden`, `apollo_contacts_recommended`, `apollo_filter_reason`, `apollo_cache_hit`, `apollo_cache_miss`, `apollo_replay_search`.

Payload: `{prospect_id, mode, returned, recommended, hidden, reasons}`.

---

## 4. Testes (vitest + edge tests)

1. Apollo retorna Finance quando pediu Marketing → contato aparece em "Não recomendados" com badge de cargo diferente.
2. Apollo retorna 10, Kairós recomenda 3 → header mostra "10 encontrados · 3 recomendados", lista raw exibe 10.
3. Apollo retorna 0 → estado vazio real.
4. Cache MISS → replay força consulta → cache atualizado, contatos aparecem.
5. Só telefone corporativo → contato aparece, badge "Apenas telefone corporativo", nunca oculto.
6. Log persistido para cada chamada, com `apollo_request_id` presente.

---

## Detalhes técnicos

- **Sem breaking changes** na API pública: `useApolloEstimate`, `useApolloRules`, `revealContact` mantêm assinatura. Só muda o payload interno de `kairos-apollo-invisible` que passa a devolver `hidden` em vez de omitir.
- **Compat**: enquanto `apollo_query_logs` está vazio, Inspector mostra empty state amigável, sem quebrar.
- **Segurança**: `response_body` pode conter e-mail/telefone; RLS restringe a membros da org do prospect. Headers Apollo são salvos sem `X-Api-Key`.
- **Performance**: índice em `apollo_query_logs(prospect_id, created_at DESC)` e `(organization_id, created_at DESC)`.
- **Rollout**: feature flag `kairos.apollo_raw_mode` (default ON) para permitir desligar rapidamente se necessário.

---

## Arquivos afetados (resumo)

Backend:
- `supabase/migrations/<ts>_apollo_query_logs.sql` (nova)
- `supabase/functions/kairos-apollo-search/index.ts` (nova)
- `supabase/functions/_shared/apollo-log.ts` (nova — helper de log/cache)
- `supabase/functions/kairos-apollo-invisible/index.ts` (marcar hidden em vez de filtrar)
- `supabase/functions/kairos-apollo-reveal-contact/index.ts` (instrumentar log)
- `supabase/functions/run-apollo-enrichment/index.ts` (instrumentar log)

Frontend:
- `src/services/intelligence/apolloInvisible.ts` (novos endpoints raw/replay/logs)
- `src/hooks/intelligence/useApolloSearch.ts` (novo)
- `src/hooks/intelligence/useApolloQueryLogs.ts` (novo)
- `src/components/playbook/ProspectContactsTab.tsx` (toggle, sections, badges)
- `src/components/playbook/enrichment/ApolloModeToggle.tsx` (novo)
- `src/components/playbook/enrichment/ApolloInspectorTab.tsx` (novo)
- `src/components/playbook/enrichment/ApolloQualityCard.tsx` (novo)
- `src/components/playbook/enrichment/EnrichmentTimeline.tsx` (ampliar com dados do log)
- `src/components/playbook/enrichment/ContactCard.tsx` (badges de origem/motivo)
- `src/pages/admin/ApolloDebug.tsx` (novo, admin-only)

## Riscos
- Aumento de volume no banco (logs) → mitigado por retenção de 30 dias via cron.
- UI mais densa → Não-recomendados vem colapsado por padrão.
- Cache bypass em replay pode aumentar consumo de créditos → botão claramente rotulado e telemetria.

## Próximos passos
Confirmar plano e partir para implementação em ordem: migration → edge function unificada → refactor invisible → UI (toggle + inspector) → admin debug → testes.
