## Release Notes Automáticos — GitHub + Eventos do Sistema, com revisão humana

Reusa a infraestrutura existente (`pending_release_changes` + edge `generate-daily-release-notes`) e adiciona ingestão híbrida, rascunho com revisão, geração via IA e disparo manual + agendado.

### Decisões aplicadas
- **Fonte:** GitHub (PRs mergeados) + eventos internos (migrações, action_executions críticas, system_events relevantes, ai_runs).
- **Disparo:** botão manual em `/release-notes` (super_admin) + cron semanal (sexta 18h America/Sao_Paulo).
- **Publicação:** sempre como `status='draft'` — gestor revisa e clica em "Publicar". Nada vai pra timeline pública sem revisão.

### 1. Banco (migration)

**Tabela `release_notes`** — novas colunas (todas opcionais, backward compatible):
- `status text` default `'published'` (`draft|published|discarded`)
- `published_at timestamptz`
- `generated_by text` (`manual|scheduled`)
- `source_summary jsonb` — `{ github_prs: n, system_events: n, period_start, period_end }`

Backfill: registros existentes ficam `status='published'`, `published_at = created_at`.

**Tabela `release_notes_ingestion_log`** (nova) — auditoria de cada execução do gerador:
- `source` (`github|system_events|action_executions|migrations|ai_runs`)
- `external_id text` (ex.: número do PR, id do evento) — único por source
- `payload jsonb`, `included_in_release uuid` (FK draft criado), `ingested_at`
- Índice único `(source, external_id)` para evitar reingestão. GRANTs padrão + RLS (super_admin only).

**View pública `v_release_notes_public`** (substitui leitura direta no front): exibe apenas `status='published'`. Painel de revisão (admin) lê a tabela bruta.

**RLS:** mantém policies atuais; adiciona policy para super_admin ler/atualizar rascunhos.

### 2. Edge function `generate-release-notes-draft` (substitui a antiga)

POST `{ period_days?: number, trigger: 'manual'|'scheduled' }`. Fluxo:

1. **Coleta GitHub (opcional):** se conector GitHub linkado, lista PRs mergeados em `main` no período via gateway (`/repos/{owner}/{repo}/pulls?state=closed&base=main`). Filtra `merged_at >= now() - period_days`. Persiste em `release_notes_ingestion_log`.
2. **Coleta system events:**
   - `action_executions` com `risk_level >= medium` ou `status='failed'` agrupados por `action_key`
   - `system_events` com `event_category in ('release','feature_flag','migration','security')`
   - `ai_runs` agregados por agente (contagem, taxa de sucesso)
   - Migrações: lê `supabase_migrations.schema_migrations` (via service role) — pega só `name`, agrupa por dia.
3. **Dedupe:** ignora qualquer item já presente em `release_notes_ingestion_log` (chave `source+external_id`).
4. **Sumarização via OpenAI** (`_shared/ai-client.ts`, modelo `gpt-5-mini`, com `dateContextPrompt()`):
   - Prompt recebe lista bruta agrupada por fonte + instruções de categorização (`feature|fix|improvement|security`).
   - Saída em JSON: `{ version, title, description, changes: [{type, description}], is_major }`.
   - Validação Zod no edge antes de inserir.
5. **Versão:** lê última `release_notes.version`, incrementa `minor` (ou `major` se IA marcar `is_major=true`).
6. **Insert:** `release_notes` com `status='draft'`, `generated_by`, `source_summary`. Marca todos os logs como `included_in_release = <novo id>`.
7. **Idempotência:** se já existir um rascunho não publicado, anexa novos itens a ele em vez de criar outro.
8. **Resposta:** retorna `{ release_id, version, items_collected, items_used }`.

Erros, validação Zod e CORS conforme padrão do projeto. Sem dependência obrigatória de GitHub — se conector ausente, log warning e segue só com eventos do sistema.

### 3. Cron semanal

Via `pg_cron` + `pg_net` (insert tool, não migration, pois usa anon key específica do projeto):
```sql
select cron.schedule(
  'generate-release-notes-weekly',
  '0 21 * * 5', -- 18h BRT = 21h UTC, toda sexta
  $$ select net.http_post(
       url:='https://<ref>.supabase.co/functions/v1/generate-release-notes-draft',
       headers:='{"Content-Type":"application/json","apikey":"<anon>"}'::jsonb,
       body:='{"trigger":"scheduled","period_days":7}'::jsonb
     ); $$
);
```

### 4. UI — painel de revisão em `/release-notes`

- **Botão "Gerar próxima release (rascunho)"** visível só pra super_admin (usa `usePlatformAdmin`). Abre modal com seletor de período (7/14/30 dias) e chama o edge via `supabase.functions.invoke`.
- **Aba "Rascunhos"** (admin only) lista releases com `status='draft'`:
  - Edição inline de `title`, `description`, e lista de `changes` (add/remove/edit, tipo + texto).
  - Mostra `source_summary` (badge "X PRs · Y eventos").
  - Botões **Publicar** (`status='published'`, `published_at=now()`) e **Descartar** (`status='discarded'`).
- Timeline pública (`status='published'`) inalterada para todos os outros usuários.
- `ReleaseNotes.tsx` migra leitura pública para `v_release_notes_public` (filtra drafts no servidor).

### 5. Arquivos

**Criar:**
- Migration: nova coluna `status` + tabela `release_notes_ingestion_log` + view `v_release_notes_public`.
- `supabase/functions/generate-release-notes-draft/index.ts`
- `src/components/admin/release-notes/GenerateReleaseDraftButton.tsx`
- `src/components/admin/release-notes/ReleaseDraftEditor.tsx`
- `src/components/admin/release-notes/DraftsTab.tsx`
- `src/hooks/useReleaseNotesAdmin.ts`

**Editar:**
- `src/pages/ReleaseNotes.tsx` — adiciona tab de rascunhos (gated por super_admin) + botão gerar; troca query pra view pública.
- `supabase/functions/generate-daily-release-notes/index.ts` — descontinuar/redirecionar pra nova function (manter backward compat até cron antigo, se houver, sumir).
- `mem://index.md` — adicionar entrada de Release Notes Automation.

### 6. Conectores

GitHub não está linkado no workspace. Após aprovar o plano, vou chamar `standard_connectors--connect` com `connector_id=github` pra abrir o seletor — sem isso, a função opera só com eventos internos (modo degradado) e o front mostra um banner "Conecte GitHub pra enriquecer com PRs".

### 7. Fora de escopo
- Não auto-publica nada (sempre draft).
- Não envia notificação Slack/email automática (pode ser sprint 2).
- Não toca em `commercial_won_revenue_view`, OTE, Forecast.
- Não remove a edge antiga até a nova estar ativa (toggle no cron).
