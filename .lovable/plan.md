

## Problema

O Forecast atualmente busca dados de **todos** os pipelines com `pipeline_type = 'sales'` ou `'renewal'`. Isso inclui pipelines que não deveriam participar do forecast (ex: OPERACIONAL que está marcado erroneamente como `sales`). O comportamento correto: o forecast deve usar apenas o pipeline marcado como **principal** pela organização.

Além disso, o pipeline OPERACIONAL está com `pipeline_type = 'sales'` no banco quando deveria ser `'onboarding'`.

## Plano

### 1. Adicionar coluna `is_primary` na tabela `pipelines`

**Migração SQL:**
- Adicionar `is_primary boolean default false` na tabela `pipelines`
- Criar constraint parcial: apenas 1 pipeline pode ser `is_primary = true` por `organization_id`
- Criar trigger que, ao marcar um pipeline como primary, desmarca os outros da mesma organização
- Setar o pipeline VENDAS da organização LEGAL como `is_primary = true`
- Corrigir o OPERACIONAL: atualizar `pipeline_type` de `'sales'` para `'onboarding'`

### 2. Adicionar toggle "Principal" no modal de edição de funil

**Arquivo:** `src/components/pipelines/EditPipelineModal.tsx`

- Adicionar um switch/checkbox "Funil Principal para Forecast" que só aparece quando o tipo é `sales`
- Descrição: "Este funil será usado como referência para o Forecast de vendas"
- Ao salvar, enviar `is_primary` junto com os demais dados

**Arquivo:** `src/services/supabase/pipelines.ts`

- Atualizar `Pipeline` interface para incluir `is_primary?: boolean`
- Atualizar `mapDBToPipeline` para mapear o campo
- Atualizar `createPipeline` e `updatePipeline` para aceitar e salvar `is_primary`
- Ao salvar `is_primary = true`, desmarcar outros pipelines da mesma organização (ou deixar o trigger fazer)

### 3. Forecast: filtrar pelo pipeline principal

**Arquivo:** `src/hooks/useForecastData.ts`

- Nas 3 queries que buscam pipelines (oportunidades abertas, fechadas, perdidas), trocar:
  ```ts
  .in('pipeline_type', ['sales', 'renewal'])
  ```
  por:
  ```ts
  .eq('is_primary', true)
  ```
- Quando o usuário seleciona "Todos os pipelines" no filtro, usar o pipeline `is_primary`. Quando seleciona um pipeline específico, usar esse.

**Arquivo:** `src/components/forecast/ForecastFilters.tsx`

- Atualizar a query de pipelines para mostrar apenas o pipeline principal (e opcionalmente permitir seleção de outros pipelines de vendas)

### 4. Corrigir dados existentes

**Na migração:**
```sql
-- Corrigir OPERACIONAL para onboarding
UPDATE pipelines SET pipeline_type = 'onboarding' 
WHERE id = '97a78715-c2e5-426c-b248-979b7718af03';

-- Marcar VENDAS da LEGAL como principal
UPDATE pipelines SET is_primary = true 
WHERE id = '59a4780d-0b92-4a48-be49-ee490be93dbf';
```

### Resumo de arquivos

| Arquivo | Mudança |
|---------|---------|
| Migração SQL | Adicionar `is_primary`, trigger de unicidade, corrigir OPERACIONAL |
| `src/services/supabase/pipelines.ts` | Interface + mappers + CRUD com `is_primary` |
| `src/components/pipelines/EditPipelineModal.tsx` | Toggle "Principal" para pipelines de vendas |
| `src/hooks/useForecastData.ts` | Filtrar por `is_primary` em vez de `pipeline_type IN (sales, renewal)` |
| `src/components/forecast/ForecastFilters.tsx` | Ajustar query de pipelines |

