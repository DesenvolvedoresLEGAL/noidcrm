## Sprint INV 0.7.2 — Templates de Especificações Técnicas por Família

Objetivo: cada Família passa a definir os campos técnicos esperados dos seus itens. Ao escolher a família no cadastro de item, o formulário renderiza dinamicamente esses campos. Valores continuam salvos em `inventory_items.metadata.technical_specs`, agora com `source: 'family_template' | 'custom'`.

### 1. Banco

Migration única (sem tabelas novas):

```sql
ALTER TABLE inventory_families
ADD COLUMN IF NOT EXISTS technical_spec_template jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Validação leve: garantir que é um array
ALTER TABLE inventory_families
ADD CONSTRAINT inventory_families_template_is_array
CHECK (jsonb_typeof(technical_spec_template) = 'array');
```

RLS existente das famílias é preservada (já é organization-scoped). Sem novas policies.

### 2. Tipos e validação (lib)

Novo arquivo `src/lib/operations/inventoryFamilyTemplate.ts`:

- Tipos: `FamilySpecFieldType = 'text' | 'number' | 'date' | 'boolean' | 'url' | 'select' | 'password'`
- `FamilySpecTemplateField` (key, label, type, required, placeholder, help_text, sort_order, is_active, options[])
- Constantes de label PT-BR e `MAX_FAMILY_TEMPLATE_FIELDS = 50`
- `normalizeSpecKey(label)` (reutiliza padrão já em `inventoryTechnicalSpecs.ts`)
- `familySpecTemplateFieldSchema` (zod) e `familySpecTemplateArraySchema` com:
  - key obrigatória, sem duplicar
  - label 2–80 chars, sem duplicar (case-insensitive)
  - placeholder ≤120, help_text ≤200
  - se `type='select'`: `options.length >= 1`, cada opção ≤80, sem duplicar, sem strings vazias
  - limite 50 campos
- Helpers:
  - `sanitizeFamilyTemplate(fields)` (trim, normaliza key, remove options vazias, deduplica)
  - `getActiveTemplateFields(template)` → ordena por `sort_order`, depois `label`, filtra `is_active`
  - `mergeItemSpecsWithTemplate(currentSpecs, template)` → retorna `{ templateSpecs, customSpecs }` separando por `source` e key
  - `applyTemplateToSpecs({ template, existingSpecs })` para o item: cria entradas `source:'family_template'` para cada campo do template, herdando valores se a key já existir; o resto vira `custom`

Atualizar `src/lib/operations/inventoryTechnicalSpecs.ts`:
- Adicionar campo opcional `source?: 'family_template' | 'custom'` em `TechnicalSpec` e no schema.
- `sanitizeTechnicalSpecs` preserva `source` (default `custom` quando ausente).

### 3. Service de famílias

`src/services/operations/inventoryFamilies.ts`:
- Adicionar `technical_spec_template: FamilySpecTemplateField[]` em `InventoryFamily` e `InventoryFamilyInput`.
- `createInventoryFamily` / `updateInventoryFamily`: persistir `technical_spec_template` (sanitizado) quando informado.
- Novo helper `getInventoryFamily(id)` para o formulário de item buscar o template ao trocar de família (ou reutilizar cache do `useInventoryFamilies`).

### 4. UI — Famílias

`src/components/operations/inventory/InventoryFamilyFormDialog.tsx`:
- Nova seção "Campos técnicos da família" abaixo dos campos atuais (mantém o dialog; apenas mais alta).
- Subcomponente novo `FamilyTechnicalTemplateEditor.tsx`:
  - Lista ordenável (sort_order numérico, sem drag-and-drop nesta sprint)
  - Para cada campo: Label, Tipo (select PT-BR), Obrigatório (switch), Placeholder, Texto auxiliar, Opções (input separado por vírgula, só se `type='select'`), Ordem, Ativo (switch)
  - Botão "Adicionar campo técnico"; estado vazio com copy do brief
  - Geração automática de `key` a partir do label
  - Validação inline via zod array schema
  - Limite 50

`InventoryFamiliesTab.tsx`: adicionar contador discreto "N campos técnicos" na coluna existente Tipo ou nova mini-coluna "Template" (preferência: pequena badge na coluna Nome). Manter colunas atuais sem quebrar layout.

### 5. UI — Itens (Serializados e Quantidade)

`InventoryItemFormDialog.tsx` e `InventoryQuantityItemFormDialog.tsx`:

- Substituir a `TechnicalSpecsSection` única por dois blocos:
  1. **Dados técnicos da família** — renderizado por novo componente `FamilyTemplateSpecsFields.tsx`
  2. **Campos extras** — `TechnicalSpecsSection` reaproveitado, agora salvando com `source:'custom'`

- `FamilyTemplateSpecsFields.tsx`:
  - Recebe `template` (campos ativos ordenados) e `value` (Record<key, string>) controlado via RHF
  - Renderiza por tipo:
    - text/url → `<Input>`
    - number → `<Input type="number" inputMode="decimal">`, salva como string
    - date → `<Input type="date">` (YYYY-MM-DD)
    - boolean → `<Select>` Sim/Não, salva "true"/"false"
    - select → `<Select>` com options
    - password → input com toggle olho (reusar padrão de `password-input.tsx`)
  - Mostra `placeholder`, `help_text`, marca obrigatórios com `*`
  - Validação `required` integrada à submissão

- Comportamento ao escolher/trocar família:
  - Carregar `technical_spec_template` (do hook `useInventoryFamilies` em cache; sem nova query)
  - Construir specs do template usando `applyTemplateToSpecs`
  - Specs antigas com keys que não existem mais no novo template → movidas para "Campos extras" com `source:'custom'`
  - Mostrar toast discreto: "Alguns dados técnicos anteriores foram preservados em Campos extras porque não fazem parte da nova família." (somente quando houver migração)

- Ao salvar:
  - Validar obrigatórios do template (mensagem `Preencha o campo obrigatório: {label}`)
  - Validar limite total de 50 specs
  - Montar `metadata.technical_specs = [...templateSpecs, ...customSpecs]` preservando demais chaves de metadata

### 6. Visualização (read-only)

Onde já se exibe specs do item (lista/details), nada muda estruturalmente, pois `technical_specs` mantém o mesmo formato + `source` opcional. Tipo `password` continua armazenado em texto puro (sem criptografia nesta sprint), conforme pedido.

### 7. Permissões / Segurança

- Sem mudanças de role: módulo Inventário continua restrito a `owner | admin | operations | operacional`.
- Sem service role no frontend, sem bypass de RLS.
- Toda operação de família/item respeita `organization_id`.
- Tipo `password` apenas mascara visualmente; sem auditoria nova.

### 8. Arquivos impactados

Novos:
- `supabase/migrations/<timestamp>_inventory_family_template.sql`
- `src/lib/operations/inventoryFamilyTemplate.ts`
- `src/components/operations/inventory/FamilyTechnicalTemplateEditor.tsx`
- `src/components/operations/inventory/FamilyTemplateSpecsFields.tsx`

Editados:
- `src/lib/operations/inventoryTechnicalSpecs.ts` (campo `source`)
- `src/services/operations/inventoryFamilies.ts` (template no input/output)
- `src/components/operations/inventory/InventoryFamilyFormDialog.tsx`
- `src/components/operations/inventory/InventoryFamiliesTab.tsx` (contador)
- `src/components/operations/inventory/InventoryItemFormDialog.tsx`
- `src/components/operations/inventory/InventoryQuantityItemFormDialog.tsx`

### 9. Fora de escopo (explicitamente)

Tabelas novas, seeds automáticos com presets (Chip/Roteador/AP/Cabo), criptografia de senhas, kits, reservas, integração com proposta, edge functions, RPCs, QR Code, upload, transferências.

### 10. Riscos e mitigação

- **Compatibilidade com itens antigos**: itens sem template apenas exibem "Campos extras" com tudo que já tinham. Sem migração de dados.
- **Troca de família destrutiva**: mitigada movendo specs incompatíveis para Campos extras + toast.
- **Performance**: template é JSONB pequeno carregado junto da família já em cache (sem query extra).
- **RHF + arrays dinâmicos**: usar `useFieldArray` consistente com `TechnicalSpecsSection` atual.
