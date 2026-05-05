# Diagnóstico forense — por que ainda está lento

Rodei agora mesmo o smoke test no banco de produção (`SELECT 1`) e a resposta foi:

```
SUPABASE_INTERNAL_ERROR — status 544
"Failed to run sql query: Connection terminated due to connection timeout"
```

Os logs `postgres_logs` retornaram **vazios** (Logflare não está conseguindo nem coletar). Isso significa que **o problema atual não é mais só código** — a instância do Lovable Cloud está saturada e qualquer query (incluindo as do detalhe da oportunidade) está enfileirada/derrubada por timeout. Foi por isso que a tela de oportunidade demorou >1min e estourou "Tempo esgotado".

A migração de RLS que apliquei ontem (`20260505180136`) está correta e continua valendo (restringiu a policy `Public access via proposal token` ao role `anon`, eliminando o EXISTS caro para usuários autenticados). Mas ela sozinha não resolve um pool de conexões esgotado.

---

# Plano de correção definitiva (3 frentes em paralelo)

## Frente 1 — Infraestrutura (ação imediata, fora do código)
A causa raiz do "carrega 1 minuto e dá erro" agora é capacidade do backend. Você precisa:

1. Abrir **Cloud → Advanced settings → Upgrade instance** e subir o tamanho da instância (CPU + RAM + conexões).
2. Após o upgrade (~poucos minutos), o pool de conexões para de derrubar queries e o detalhe da oportunidade volta ao tempo normal.

Documentação: https://docs.lovable.dev/features/cloud#advanced-settings-upgrade-instance

Sem esse passo, qualquer otimização de código vai ser engolida pela fila do banco.

## Frente 2 — Reduzir carga da página de Oportunidade (código)
O `OpportunityDetailPage` hoje dispara em paralelo **>15 queries** ao abrir (details, scoring, NRHS, gaps, vibe, emotional memory, AI suggestions, timeline, activities, notes, files, emails, proposals, participants, history, analytics) + 3 realtime channels. Isso multiplica a pressão no banco. Vou:

1. **Lazy-load por aba**: hoje `OpportunityTabs` monta `defaultValue="timeline"` mas todos os `<TabsContent>` são instanciados. Mudar para render condicional (`mounted` set por aba clicada) — só Timeline carrega no abrir; Inteligência/Analytics/Histórico só quando o usuário troca de aba. Corta ~70% das queries iniciais.
2. **Consolidar fetch do detalhe**: `useOpportunityDetails` hoje faz 1 query principal + 4 follow-ups sequenciais (`Promise.all` de owner/qualified_by/source_opp/stages). Criar uma RPC `get_opportunity_detail(id)` security definer que devolve tudo em 1 round-trip.
3. **Aumentar `staleTime`** dos hooks satélites (scoring, NRHS, emotional memory) de default para 5 min — esses dados não mudam a cada navegação.
4. **Suspender o auto-recalc de score** ao abrir (`useOpportunityScoring` hoje pode disparar recalculate). Manter só leitura; recálculo via botão.
5. **Throttle do realtime**: `useRealtimeOpportunityDetail` invalida o cache inteiro a cada postgres_change. Trocar por debounce de 1s + invalidar somente as keys afetadas.

## Frente 3 — Resiliência e telemetria
1. **Timeout + retry exponencial** no `supabase` client wrapper: hoje uma query travada faz a UI ficar "Carregando…" eternamente. Aplicar `AbortController` com 15s + 1 retry, e disparar toast "Backend lento, tentando novamente" em vez de tela em branco.
2. **Circuit breaker** no React Query: se 3 queries seguidas falharem por timeout, parar de disparar novas por 30s e mostrar banner "Sistema sobrecarregado — aguarde".
3. **Métrica visível** no header (dev/admin): tempo médio das últimas 10 queries Supabase, para enxergarmos quando volta a degradar.
4. **Migração adicional**: garantir índices que ainda faltam para o detalhe:
   - `idx_opportunities_owner_user_id_active` (owner + deleted_at IS NULL)
   - `idx_proposals_opportunity_id_status` (composto)
   - `idx_opportunity_activities_opportunity_id_created` (paginação)
   - `ANALYZE` nas 3 tabelas após criação.

---

# Arquivos que vou tocar (Frentes 2+3)

- `src/components/opportunity/OpportunityTabs.tsx` — lazy mount por aba
- `src/hooks/useOpportunityDetails.ts` — usar nova RPC, staleTime 5min
- `src/hooks/useRealtimeOpportunityDetail.ts` — debounce + invalidação granular
- `src/hooks/useOpportunityScoring.ts` — remover auto-recalc on mount
- `src/lib/supabaseTimeout.ts` (novo) — wrapper com AbortController + retry
- `src/lib/queryCircuitBreaker.ts` (novo) — contador global de timeouts
- `supabase/migrations/<novo>.sql` — RPC `get_opportunity_detail` + índices faltantes + ANALYZE

# Riscos

- A RPC nova precisa respeitar RLS via `SECURITY INVOKER` (não definer) para não vazar deals de outras orgs.
- Lazy mount de abas pode quebrar deep-links tipo `?tab=propostas` — manter leitura do query string e pré-montar a aba alvo.
- O upgrade de instância é responsabilidade sua no painel do Cloud — sem ele, frentes 2 e 3 melhoram mas não eliminam o problema atual.

# Próximo passo

Aprove o plano para eu executar Frentes 2 e 3 no código + migração. **Em paralelo, faça o upgrade da instância no Cloud agora** — é o que destrava o gargalo imediato que você está sentindo.

<lov-actions>
<lov-link url="https://docs.lovable.dev/features/cloud#advanced-settings-upgrade-instance">Como fazer upgrade da instância Cloud</lov-link>
</lov-actions>
