# Sprint A — Ajustes Finos do Enrichment

Quatro ajustes sobre o que já foi entregue na Sprint A. Tudo aditivo, zero risco para dados existentes.

## 1. Migration (banco)

Adicionar 4 campos em `enrichment_runs` E em `enrichment_normalized` (snapshot histórico precisa dos mesmos para ser auditável):

```sql
ALTER TABLE public.enrichment_runs
  ADD COLUMN IF NOT EXISTS missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS quality_label TEXT
    CHECK (quality_label IN ('high_confidence','usable','low_confidence','insufficient')),
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;

ALTER TABLE public.enrichment_normalized
  ADD COLUMN IF NOT EXISTS missing_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS prompt_version TEXT,
  ADD COLUMN IF NOT EXISTS quality_label TEXT
    CHECK (quality_label IN ('high_confidence','usable','low_confidence','insufficient')),
  ADD COLUMN IF NOT EXISTS fallback_reason TEXT;
```

## 2. Edge function `run-enrichment` (alterações cirúrgicas)

### 2.1. Constante de versão do prompt
No topo do módulo:
```ts
const PROMPT_VERSION = "enrichment.normalize.v2.0";
```
Bumpa toda vez que o prompt master mudar. Sprint C vai correlacionar `prompt_version` × `quality_grade` para medir impacto.

### 2.2. Função `qualityLabelFromGrade`
```ts
function qualityLabelFromGrade(grade): 'high_confidence'|'usable'|'low_confidence'|'insufficient'
// A → high_confidence, B → usable, C → low_confidence, D → insufficient
```

### 2.3. Função `computeMissingFields(normalized)`
Lista de campos canônicos obrigatórios (`company_summary`, `business_model`, `market_type`, `industry`, `target_customer`, `geo`, `company_size_hint`, `top_pains`, `top_opportunities`, `trigger_signals`, `digital_maturity`). Retorna array com os que vieram `null` ou array vazio.

### 2.4. `fallback_reason` no fluxo
Variável calculada onde hoje se decide o fallback:
```ts
let fallbackReason: string | null = null;
if (force_fallback === true) fallbackReason = "forced_by_user";
else if (mainContentLength < 1500) fallbackReason = "low_content_length";
// reservado: "missing_sections" para futura heurística baseada em campos esperados
```
Só é persistida quando `fallback_used === true`.

### 2.5. Persistência

No INSERT de `enrichment_normalized` adicionar:
```ts
prompt_version: PROMPT_VERSION,
missing_fields: missingFields,
quality_label: qualityLabel,
fallback_reason: fallbackUsed ? fallbackReason : null,
```

No UPDATE final de `enrichment_runs` adicionar os mesmos 4 campos.

### 2.6. Response da função
Acrescentar `missing_fields`, `quality_label`, `prompt_version`, `fallback_reason` ao JSON de retorno (útil pro toast e debug).

## 3. Frontend (mínimo)

`useEnrichment.ts` — toast já mostra grade+score; sem mudanças necessárias. Os novos campos ficam disponíveis em `enrichment_runs` via `useEnrichmentRun` para uso futuro (Sprint C terá UI dedicada).

Opcional (rápido): no `CompanyEnrichmentCard`, se `run.missing_fields.length > 0`, exibir uma linha discreta:
> "Campos sem evidência: indústria, modelo de negócio"

## Arquivos impactados

- Migration nova (via tool) — `enrichment_runs` + `enrichment_normalized` ganham 4 colunas
- `supabase/functions/run-enrichment/index.ts` — adiciona helpers + persiste novos campos
- `src/components/playbook/enrichment/CompanyEnrichmentCard.tsx` — (opcional) mostra missing_fields

## Riscos

Zero. Todas as colunas têm DEFAULT ou são nullable; código antigo continua funcionando se a migration não tiver rodado ainda (os novos campos nos INSERT/UPDATE simplesmente serão escritos como `null`/`[]`).
