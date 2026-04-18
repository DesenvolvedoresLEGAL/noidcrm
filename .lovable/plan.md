

## Sprint 1 — Auditoria da Verdade dos Dados e Contrato de Métricas

Modo read-only. Vou explorar o código de relatórios + schema, mapear cada métrica à sua fonte real, identificar divergências e entregar o **Contrato Oficial de Métricas V2** como base para as Sprints 2-8.

### Escopo desta sprint (apenas auditoria, zero código novo)

1. **Inventário de telas** — ler todos os componentes de `src/components/reports/*` (14 abas listadas) e mapear cada card/gráfico/tabela.
2. **Mapeamento de origem** — para cada métrica, registrar:
   - tabela(s) Supabase consultadas
   - hook/edge function usada
   - campo de data (`closed_at`, `created_at`, `updated_at`, `lost_at`, etc.)
   - filtro de status (`won`, `lost`, `open`, `new`, `draft`...)
   - regra de soma/contagem/agrupamento
   - se respeita `deleted_at IS NULL` e `pipeline_type='sales'`
3. **Matriz de divergências** — confrontar cálculos atuais com regras já consolidadas em memória:
   - Win Rate unificada (sales only, closed_at, exclui soft-deleted)
   - Receita = valor líquido (Total - Desconto)
   - Forecast só com `is_primary=true`
   - SDR métricas (won em pipelines de qualificação)
4. **Contrato Oficial V2** — documento markdown definindo cada métrica de forma única, versionada, com SQL de referência.
5. **Gaps estruturais** — listar campos ausentes que travam Sprints 2-3 (ex.: `lost_at` dedicado, `stage_history` real, `loss_reason_id` consistente, `sdr_user_id` vs `closer_user_id`).

### Plano de exploração (read-only)

```text
1. code--list_dir src/components/reports
2. code--view de cada componente (Geral, Processadas, Perdidas,
   Acumuladas, Origens, Balanceamento, Conversão, Estágios,
   Forecast, SDR, Closer, Team, Handoff, AIInsights)
3. code--view dos hooks usados (useReportFiltersContext,
   useOwnerDashboard e demais hooks de relatório)
4. supabase--read_query no schema de:
   - opportunities (campos de status, datas, valores, ownership)
   - stages, pipelines, loss_reasons, win_loss_records
   - stage_history / opportunity_events (se existir)
   - profiles (papéis SDR/Closer)
5. cruzar com memórias canônicas (win-rate, valor-líquido,
   forecast, closed_at imutável, SDR métricas, deal-handoff)
```

### Entregáveis (gerados em `/mnt/documents/`)

| Arquivo | Conteúdo |
|---|---|
| `relatorios-v2-sprint1-inventario.md` | Tabela: aba → componente → métrica → fonte atual |
| `relatorios-v2-sprint1-divergencias.md` | Matriz de inconsistências encontradas vs regras canônicas |
| `relatorios-v2-sprint1-contrato.md` | **Contrato Oficial de Métricas V2** (definição única + SQL de referência por métrica) |
| `relatorios-v2-sprint1-gaps.md` | Campos/colunas/tabelas ausentes que precisam ser criados na Sprint 2 |

Tudo entregue como `<lov-artifact>` para você revisar e aprovar antes da Sprint 2 (que envolverá migrations).

### Critérios de aceite

- ✅ Todas as 14 abas auditadas
- ✅ Cada métrica com 1 definição única + SQL canônico
- ✅ Matriz de divergências cobrindo Receita, Pipeline, Conversão, Motivos de Perda, SDR/Closer
- ✅ Lista de gaps estruturais pronta para virar migration na Sprint 2

### Fora de escopo (vai para sprints seguintes)

- Migrations (Sprint 2)
- `stage_history` / event sourcing (Sprint 3)
- Views SQL canônicas (Sprint 4)
- Edge functions de apuração (Sprint 5)
- Refatoração de UI (Sprint 6)

### Tempo estimado

~2h de leitura + síntese. Sem risco de regressão (zero escrita).

