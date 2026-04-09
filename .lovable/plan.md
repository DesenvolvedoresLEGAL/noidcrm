

## Sprint 6 — Histórico, Observabilidade, Retries e Performance

### Resumo

Adicionar maturidade operacional ao módulo de Lead Sourcing: histórico completo de execuções com detalhes, log de eventos por run, retry de execuções com erro, e KPIs de performance baseados em dados reais dos `playbook_runs` e `prospects`.

---

### 1. Migração SQL

**Colunas novas em `playbook_runs`:**
```sql
ALTER TABLE playbook_runs
  ADD COLUMN IF NOT EXISTS error_summary text,
  ADD COLUMN IF NOT EXISTS retry_count int DEFAULT 0,
  ADD COLUMN IF NOT EXISTS execution_time_ms int;
```

**Nova tabela `run_events`:**
```sql
CREATE TABLE run_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL,
  playbook_run_id uuid NOT NULL REFERENCES playbook_runs(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE run_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "org members can read run_events" ON run_events FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT id FROM organizations WHERE id IN (
    SELECT organization_id FROM organization_members WHERE user_id = auth.uid()
  )));
CREATE INDEX idx_run_events_run_id ON run_events(playbook_run_id);
```

---

### 2. Edge Function — `lead-sourcing` updates

- Calcular `execution_time_ms` (timestamp start → end) e salvar no `playbook_run`
- Em caso de erro, salvar `error_summary` com mensagem resumida
- Inserir `run_events` nos pontos-chave do fluxo: início, páginas descobertas, extração, scoring, erro parcial, finalização
- **Retry handler**: novo action type `retry` que busca o run original, cria novo run com mesmo `input_payload` incrementando `retry_count`, e re-executa

---

### 3. Hooks — Novos queries e mutations

**`useLeadSourcingV2.ts`** — adicionar:
- `usePlaybookRunsPaginated(page, pageSize)` — query paginada com contagem total
- `useRunEvents(runId)` — query dos eventos/logs de uma execução
- `useRetryPlaybookRun()` — mutation que chama edge function com action `retry`
- `usePlaybookPerformanceStats()` — query agregada: total runs, prospects criados, taxa aprovação, taxa importação, score médio

---

### 4. Frontend — Histórico de Execuções

**`RunHistoryTable.tsx`** (novo) — Tabela paginada com colunas:
- Data, Tipo de playbook, Status (badge), Prospects, Aprovados, Importados, Tempo (ms→s), Erro (ícone), Ações (ver detalhe, retry)

**`RunDetailDrawer.tsx`** (novo) — Sheet com seções:
1. **Resumo** — status, tempo, retry_count, triggered_by
2. **Input Payload** — JSON formatado
3. **Stats** — métricas do run
4. **Logs/Eventos** — timeline dos `run_events` com nível (info/warn/error) e timestamps
5. **Erros** — error_summary destacado se houver
6. **Prospects** — contagem com link para ver resultados

Botão "Retry" no footer para runs com status `failed`.

---

### 5. Frontend — Aba Performance (reescrever `PlaybookPerformance.tsx`)

Atualmente usa hooks legados (`usePlaybooks`, `useLeadSearches`). Reescrever para usar dados reais de `playbook_runs` e `prospects`:

**KPIs:**
- Total de execuções
- Prospects criados (soma dos stats)
- Taxa de aprovação (aprovados / total prospects)
- Taxa de importação (importados / aprovados)
- Score médio por tipo de playbook

**Breakdown por tipo** — tabela com linhas por `playbookType` (event, manual_import, etc.) mostrando runs, prospects, aprovados, importados.

---

### 6. Integração no `LeadSourcingEngine.tsx`

- Adicionar tabs ou seção para acessar "Histórico Completo" que renderiza `RunHistoryTable`
- Botão retry nas runs com erro na `RecentRunsList`
- Atualizar `RecentRunsList` para mostrar `execution_time_ms` e ícone de erro

---

### 7. Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `supabase/migrations/xxx_sprint6_observability.sql` | Colunas em playbook_runs + tabela run_events |
| `supabase/functions/lead-sourcing/index.ts` | Timing, error_summary, run_events, retry handler |
| `src/hooks/useLeadSourcingV2.ts` | Paginated runs, run events, retry mutation, performance stats |
| `src/components/playbook/RunHistoryTable.tsx` | **Novo** — tabela paginada de histórico |
| `src/components/playbook/RunDetailDrawer.tsx` | **Novo** — drawer de detalhe da execução |
| `src/components/playbook/PlaybookPerformance.tsx` | Reescrever com dados reais |
| `src/components/playbook/LeadSourcingEngine.tsx` | Integrar histórico e retry |
| `src/components/playbook/RecentRunsList.tsx` | Mostrar tempo e erro |

---

### Critérios de aceite

- Histórico paginado mostra todas as execuções com status, tempo e stats
- Drawer de detalhe exibe logs/eventos da execução em timeline
- Retry de run com erro cria nova execução e funciona
- Performance tab mostra KPIs reais calculados de playbook_runs e prospects
- run_events registrados nos pontos-chave do fluxo da edge function

