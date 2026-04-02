

# Garantir Duplicação Completa de Oportunidades

## Problemas Identificados

### 1. Campos da oportunidade NÃO copiados
O `newOpp` (linhas 381-403) copia apenas 12 campos. Faltam campos críticos:
- `commission_value` - valor de comissão
- `mrr_value` / `arr_value` - receita recorrente
- `opportunity_type` / `lead_type` - tipo de oportunidade
- `created_by` - quem criou
- Campo `mrr` referenciado na linha 402 **não existe** na tabela (o correto é `mrr_value`)

### 2. Entidades filhas NÃO copiadas
Atualmente copia: `audit_log`, `custom_field_values`, `proposals` + `proposal_items`, `opportunity_files`.

**Faltam:**
- `deal_participants` - participantes/co-responsáveis do deal
- `opportunity_tags` - tags associadas
- `contracts` - contratos vinculados

### 3. Falhas silenciosas
Todos os blocos de cópia usam `try/catch` com `console.error` — se falham, a oportunidade é criada sem os dados filhos e ninguém fica sabendo.

## Solução

### Alteração em `execute-workflow/index.ts`

**A. Expandir campos copiados na oportunidade** (linhas 381-403):
```typescript
const newOpp = {
  organization_id: opportunity.organization_id,
  title: action.config?.title_prefix 
    ? `${action.config.title_prefix}${opportunity.title}`
    : opportunity.title,
  account_id: opportunity.account_id,
  contact_id: opportunity.contact_id,
  owner_user_id: newOwnerUserId,
  valor_previsto: opportunity.valor_previsto,
  pipeline_id: targetPipelineId,
  stage_id: action.config?.target_stage_id || opportunity.stage_id,
  status: 'new',
  source_opportunity_id: opportunity.id,
  qualified_by_user_id: opportunity.owner_user_id,
  qualified_at: new Date().toISOString(),
  prob: opportunity.prob,
  temperature: opportunity.temperature,
  produto: opportunity.produto,
  origem: opportunity.origem,
  fonte: opportunity.fonte,
  close_date_prevista: opportunity.close_date_prevista,
  mrr_value: opportunity.mrr_value,
  arr_value: opportunity.arr_value,
  commission_value: opportunity.commission_value,
  opportunity_type: opportunity.opportunity_type,
  lead_type: opportunity.lead_type,
  created_by: opportunity.created_by,
};
```

**B. Adicionar cópia de `deal_participants`** (após custom_field_values):
```typescript
try {
  const { data: participants } = await supabase
    .from('deal_participants')
    .select('*')
    .eq('opportunity_id', opportunity.id);
  if (participants?.length) {
    const toInsert = participants.map(({ id, created_at, updated_at, ...p }) => ({
      ...p, opportunity_id: data.id
    }));
    const { error } = await supabase.from('deal_participants').insert(toInsert);
    if (error) console.error('[execute-workflow] Error copying deal_participants:', error);
    else console.log(`[execute-workflow] Copied ${participants.length} deal participants`);
  }
} catch (e) { console.error('[execute-workflow] Error copying deal_participants:', e); }
```

**C. Adicionar cópia de `opportunity_tags`**:
```typescript
// Same pattern for opportunity_tags
```

**D. Adicionar cópia de `contracts`** (excluindo `id`, `created_at`, `updated_at`, status resetado para `draft`):
```typescript
// Same pattern for contracts
```

**E. Adicionar log consolidado de sucesso/falha** ao final de todas as cópias, listando exatamente o que foi copiado e o que falhou, para diagnóstico futuro.

## Arquivos Afetados

| Arquivo | Alteração |
|---------|-----------|
| `supabase/functions/execute-workflow/index.ts` | Expandir campos + copiar deal_participants, tags, contracts + log consolidado |

## Deploy
Redeploy de `execute-workflow` após alterações.

