## Sprint F2.3 — Forecast Engine V2 (motor determinístico oficial)

Sprint F2.1 (auditoria) e F2.2 (snapshots) já estão entregues. Toda essa sprint reescreve o miolo da RPC `calculate_forecast_audit_v2` para usar a fórmula oficial V2, atrás de feature flag, sem quebrar UI nem snapshots.

### Estratégia geral
- Mudança cirúrgica concentrada na RPC `calculate_forecast_audit_v2` + 1 nova migration aditiva.
- `create_forecast_daily_snapshot_v2` já chama essa RPC: snapshots passam a usar engine V2 automaticamente.
- Feature flag `forecast_v2_engine_enabled` via `is_feature_enabled()` (sistema canônico já existe). Quando OFF → comportamento atual (mesma fórmula que está em produção hoje).
- Drawer "Ver cálculo" e UI continuam funcionando se a engine falhar (try/catch já existente).

---

### 1. Migration nova: `forecast_v2_engine_1`

Arquivo: `supabase/migrations/<ts>_forecast_v2_engine.sql`

**Schema (aditivo, idempotente):**
- `ALTER TABLE forecast_calculation_items ADD COLUMN IF NOT EXISTS next_step_factor numeric NULL;`
- `ALTER TABLE forecast_daily_snapshots ADD COLUMN IF NOT EXISTS calculation_version text DEFAULT 'forecast_v2_engine_1';`
- Atualizar `CHECK (forecast_bucket IN ...)` para incluir `'slipping'` (hoje slipping vai em `eligibility_status`, mas a spec pede como bucket também). Drop+recreate constraint.
- Insert da flag default OFF: `INSERT INTO feature_flags (organization_id, flag_key, enabled) SELECT id, 'forecast_v2_engine_enabled', false FROM organizations ON CONFLICT DO NOTHING;`

**RPC `calculate_forecast_audit_v2` reescrita:**

Lê `is_feature_enabled('forecast_v2_engine_enabled')` no início:
- Se OFF → executa branch legado (cópia da implementação atual, `calculation_version = 'forecast_v2_audit_1'`).
- Se ON → executa branch V2 (`calculation_version = 'forecast_v2_engine_1'`).

**Branch V2 — fórmula oficial por deal aberto elegível:**
```
adjusted_value = deal_value
  × adjusted_probability
  × nrhs_factor × time_factor × activity_factor
  × next_step_factor × stage_factor × risk_factor
```

`adjusted_probability` (decimal 0..1):
- won → 1.0; lost → 0.0
- ambos prob: `manual*0.6 + stage*0.4`
- só um existir → usa esse; nenhum → 0

**Fatores (CASE blocks na RPC):**
- `nrhs_factor`: ≥80→1.0, 70-79→0.90, 60-69→0.75, 40-59→0.50, <40→0, NULL→0.50
- `time_factor`: dentro do período→1.0; vencida ≤3d→0.60; 4-7d→0.35; >7d→0.10; fora período até +15d→0.20; >+15d→0.05; NULL→0
- `activity_factor`: last_contact ≤2d→1.0, ≤7d→0.85, ≤14d→0.60, >14d→0.30, NULL→0.20
- `next_step_factor`: tem→1.0; não→0.70
- `stage_factor`: lookup case-insensitive por nome de estágio (mapa fornecido); fallback 0.50
- `risk_factor`: low/baixo→1.0, medium/médio→0.80, high/alto→0.55, critical/crítico→0.25, null→0.85
  - `risk_level` derivado do mesmo critério atual (slipping/NRHS<50→high; falta atividade/next step→medium; senão low). Promove para `critical` se múltiplas penalizações severas.

**Buckets V2:**
- `closed`: status=won no período
- `commit`: prob≥0.70 AND nrhs≥70 AND close_date no período AND atividade ≤7d AND next_step AND risk≠critical
- `realistic`: prob≥0.50 AND nrhs≥60 AND close_date no período AND time_factor≥0.60 AND activity_factor≥0.60 AND risk_factor≥0.55
- `optimistic`: prob≥0.25 AND nrhs≥50 AND deal_value>0 AND status=open
- `best_case`: deal_value>0 AND status=open AND (nrhs≥40 OR nrhs IS NULL) AND prob>0
- `slipping`: close vencida OU close fora do período OU days_remaining≤1 sem evidência forte
- `excluded`: valor 0/null OU lost OU prob=0 OU nrhs<40 OU sem close (quando exigido)

Cada deal entra em **exatamente um** bucket (CASE em ordem de prioridade: closed → excluded → slipping → commit → realistic → optimistic → best_case → pipeline_only).

**Trava fim de mês (`days_remaining = p_period_end - CURRENT_DATE`):**
Se `days_remaining ≤ 1`: deal aberto só permanece em `commit`/`realistic` se cumprir close_date no período, atividade≤2d, prob≥0.70, nrhs≥70, next_step e risk∉{high,critical}. Caso contrário → `slipping` (com `penalty_reasons += 'end_of_month_restriction'`).

**Totais oficiais:**
- `total_closed` = SUM(deal_value) WHERE bucket=closed
- `total_commit` = closed + SUM(adjusted_value) WHERE bucket=commit
- `scenario_pessimistic` = closed
- `scenario_realistic` = closed + SUM(adjusted_value) WHERE bucket IN (commit, realistic)
- `scenario_optimistic` = closed + SUM(adjusted_value) WHERE bucket IN (commit, realistic, optimistic)
- `scenario_best_case` = closed + SUM(deal_value) WHERE bucket IN (commit, realistic, optimistic, best_case) — sem dupla contagem (cada deal em 1 bucket)
- `pipeline_total` = SUM(deal_value) WHERE status=open AND status≠lost

**Confiança (`forecast_confidence`):**
Base 100, penalizações conforme spec (snapshots históricos<5: -10; %sem atividade>30%: -20; etc.). Persistir `confidence_reasons[]` em `forecast_calculation_runs.metadata.confidence_reasons` (jsonb array de strings em PT-BR).

**Por item (`forecast_calculation_items`):**
- Persistir `manual_probability`, `stage_probability`, `adjusted_probability` (em %, escala 0-100 mantida para compatibilidade com hook tipado), todos os 7 fatores, `adjusted_value`, `forecast_bucket`, `eligibility_status`, `risk_level`, `exclusion_reasons[]`, `penalty_reasons[]` (chaves canônicas listadas na spec).
- `metadata` jsonb por item:
```
{ formula, days_remaining, is_end_of_month_restricted, raw_value, adjusted_value, factors:{...} }
```

**Reuso da `calculation_version`:** coluna já existe (default `'forecast_v2_audit_1'`); branch V2 grava `'forecast_v2_engine_1'`.

---

### 2. Frontend — mudanças mínimas

**a) `useForecastAuditItems.ts`:** adicionar `next_step_factor`, `stage_factor`, `risk_factor`, `metadata` à interface (já tem `nrhs_factor`/`time_factor`/`activity_factor`).

**b) `useForecastAuditRun.ts`:** adicionar `calculation_version`, `confidence_reasons` ao tipo de retorno.

**c) `ForecastAuditDrawer.tsx`:**
- Mostrar badge da `calculation_version` no header.
- Atualizar `FormulaSection` para exibir a fórmula oficial V2 quando `run.calculation_version === 'forecast_v2_engine_1'` (mantém texto legado caso contrário).
- Nova sub-seção "Por que essa confiança?" exibindo `confidence_reasons[]`.
- Novos rótulos PT-BR para penalidades/exclusões adicionadas (`stale_activity`, `expired_close_date`, `high_risk`, `critical_risk`, `end_of_month_restriction`, `close_date_outside_period`, `low_nrhs`, `weak_stage`, `lost_opportunity`, `missing_deal_value`, `zero_probability`, `nrhs_below_40`, `missing_close_date`).
- Bucket label novo: `slipping` → "Escorregando".
- Resiliente a campos faltantes (já é).

**d) `RevenueForecastV2.tsx`:** **não muda** nesta sprint (a spec diz "não reconstruir UI"). O edge function `report_forecast_v2` continua alimentando os cards principais; a engine V2 vive na auditoria + snapshots. A consistência entre cards e engine virá numa sprint posterior — ou via tooltip explicativo opcional.
- Opcional: adicionar tooltip nos cards de cenário sinalizando "Cálculo auditável em Ver cálculo".

---

### 3. Snapshots

`create_forecast_daily_snapshot_v2` já chama `calculate_forecast_audit_v2`. Quando a flag estiver ON, o snapshot grava automaticamente os números V2. Adicionar:
- Trecho na RPC para popular `forecast_daily_snapshots.calculation_version` com a versão lida do run associado.

---

### 4. Feature flag

- Reusa `feature_flags` + `is_feature_enabled()` já existentes.
- Default OFF.
- Ativação por organização via painel admin existente (`ReportsV2FlagsSection` é para reports_v2; flag de engine fica acessível via SQL/admin direto — adicionar UI dedicada está fora do escopo desta sprint).

---

### Files changed
- `supabase/migrations/<ts>_forecast_v2_engine.sql` (NOVO) — schema aditivo + RPC reescrita com branches OFF/ON
- `src/hooks/useForecastAuditItems.ts` — novos campos no tipo
- `src/hooks/useForecastAuditRun.ts` — `calculation_version`, `confidence_reasons`
- `src/components/reports/v2/forecast-audit/ForecastAuditDrawer.tsx` — badge versão, fórmula V2, motivos da confiança, novos rótulos, bucket `slipping`
- `src/integrations/supabase/types.ts` — auto-regenerado

### Risks
- RPC longa em plpgsql; cobrir branches OFF/ON com testes manuais (já funciona em F2.1 com flag OFF).
- Constraint `forecast_bucket` precisa ser dropada/recriada (drop policy NÃO necessário).
- Mudança de escala de `adjusted_probability` (V2 quer decimal 0-1, mas hoje hook trata como 0-100). **Decisão: persistir em 0-100 para manter compatibilidade do drawer**, mas usar decimal internamente nos cálculos. Alternativa: persistir decimal e atualizar drawer; menos seguro.
- Deals em `slipping` podem agora aparecer no drawer como bucket distinto (era só eligibility) — drawer já mapeia label.

### Não inclui (ficou fora do escopo)
- ML / recalibração automática (Sprint futura, depende de histórico de snapshots)
- UI nova nos cards principais do `RevenueForecastV2`
- Painel admin para a flag (ativação inicial via SQL)
- Renomeação dos cards (Meta/Fechado/Realista/etc.)

### Next steps após aprovação
1. Aplicar migration.
2. Habilitar flag `forecast_v2_engine_enabled` para a org de teste.
3. Abrir drawer "Ver cálculo" → confirmar versão `forecast_v2_engine_1`.
4. Rodar snapshot manual → conferir `calculation_version` e cenários.
5. Validar cenários de teste 1-7 da spec.