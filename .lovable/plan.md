# Fix: Timeout 504 em "Repontuar com aprendizado" (Kairós)

## Diagnóstico

A edge function `rescore-prospects` está dando **504 (timeout em 150s)** ao re-pontuar runs do Kairós.

**Causa raiz:**
- Para cada prospect, faz 2 `UPDATE` sequenciais (`prospect_scores` + `prospects`).
- Run ABRINT 2026 tem 244 prospects → ~488 round-trips serializados ao Postgres.
- Run FEIMEC tem 793 prospects → ~1586 round-trips, impossível dentro de 150s.
- Logs confirmam: uma execução sucedeu em 137s, próximas estouraram 150s (504).

Não é bug de lógica nem de schema — é arquitetura síncrona inadequada para o volume.

## Correção

### 1. Edge function `rescore-prospects` — execução em background

Seguindo o padrão já adotado no projeto (`background-execution-pattern-long-running-tasks`):

- Responder **202 Accepted imediatamente** com `{ run_id, total, status: 'processing' }`.
- Usar `EdgeRuntime.waitUntil(...)` para o processamento real continuar após o response.
- Eliminar updates 1-a-1: substituir por **`upsert` em batch único por lote** em `prospect_scores` (já tem `id`), e atualizar `prospects.priority_score` via **RPC SQL** que faz `UPDATE ... FROM (VALUES ...)` em massa.
- Aumentar lote para 200 e paralelizar leitura/escrita por lote.

### 2. Tabela de status (opcional, mas recomendado)

Reaproveitar `system_events` para registrar:
- `rescore.started` (com run_id, total)
- `rescore.completed` (com rescored, unchanged, failed, learning_signals_active, avg_adjustment)
- `rescore.failed` (com erro)

Não criar tabela nova — UI lê o último evento via realtime ou polling leve.

### 3. Frontend `RecentRunsList.tsx`

- Toast imediato: "Re-pontuação iniciada em background. Notificaremos quando concluir."
- Polling leve (a cada 5s, máx 3 min) em `system_events` filtrando por `event_type='rescore.completed'` e `entity_id=run.id`, OU subscription realtime.
- Ao receber conclusão: toast final com `rescored / total / avg_adjustment` e invalidar queries de prospects da run.
- Botão fica em estado `loading` enquanto polling não vê conclusão (com timeout de fallback de 3 min).

### 4. RPC auxiliar (migration)

```sql
create or replace function public.bulk_update_prospect_priority(
  p_updates jsonb -- [{"id": "uuid", "score": 245}, ...]
) returns int
language plpgsql
security definer
set search_path = public
as $$
declare v_count int;
begin
  with payload as (
    select (x->>'id')::uuid as id, (x->>'score')::numeric as score
    from jsonb_array_elements(p_updates) x
  )
  update prospects p set priority_score = payload.score
  from payload where p.id = payload.id;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
```

Permite atualizar centenas de prospects em **um único round-trip**.

## Arquivos impactados

- `supabase/functions/rescore-prospects/index.ts` — refatorar para background + bulk
- `src/components/playbook/RecentRunsList.tsx` — UX assíncrona + polling/realtime
- `supabase/migrations/<timestamp>_rescore_bulk.sql` — RPC `bulk_update_prospect_priority` + index `system_events(entity_id, event_type, created_at desc)` se faltar

## Resultados esperados

- Run de 244 prospects: response em <1s, processamento em ~5-10s.
- Run de 793 prospects: response em <1s, processamento em ~15-30s.
- Sem mais 504. UX clara de progresso.

## Riscos

- **Race condition** se usuário clicar 2x: mitigar com guard em `system_events` (se há `rescore.started` para esse run nos últimos 2 min, retornar 409).
- **EdgeRuntime.waitUntil** já é usado em outras funções do projeto, padrão estabelecido.
- Migration adiciona apenas RPC nova (não-destrutiva).

## Recuperação imediata (sem aguardar deploy)

Posso disparar manualmente o re-processamento da run ABRINT 2026 chamando a função em lotes menores via SQL direto, mas o ideal é aplicar o fix definitivo.
