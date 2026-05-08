## Sprint INV 0.7 — Especificações Técnicas (metadata.technical_specs)

Adicionar camada universal de atributos técnicos flexíveis em `inventory_items.metadata.technical_specs`. Sem nova tabela, sem RPC, sem edge function, sem alteração de schema.

### Arquivos a criar

1. **`src/lib/operations/inventoryTechnicalSpecs.ts`** — utilitários puros e schema:
   - `normalizeSpecKey(label)` — minúsculo, sem acento, espaços → `_`, sem chars especiais, sem `_` duplicados/no início/fim.
   - `getTechnicalSpecs(metadata)` — leitura segura: retorna `[]` se `metadata` nulo/malformado ou se `technical_specs` não for array.
   - `mergeTechnicalSpecs(existingMetadata, specs)` — preserva todas as outras chaves do `metadata` e atualiza apenas `technical_specs`.
   - `TECHNICAL_SPEC_TYPES` = `['text','number','date','boolean','url']`, label map pt-BR (Texto, Número, Data, Sim/Não, URL).
   - `MAX_SPECS = 30`.
   - `technicalSpecSchema` (Zod): `key` min 1 max 80, `label` min 2 max 80, `value` min 1 max 200, `type` enum default `text`, `notes` max 300 nullable optional.
   - `technicalSpecsArraySchema`: `z.array(...).max(30, 'Limite de 30 especificações técnicas por item.').default([]).superRefine` — rejeita `key` ou `label` (lowercased+trim) duplicados com mensagem "Já existe uma especificação com este campo neste item."

2. **`src/components/operations/inventory/TechnicalSpecsSection.tsx`** — bloco reutilizável (controlado por react-hook-form via `useFieldArray`):
   - Card com título "Especificações Técnicas" + texto auxiliar.
   - Estado vazio: "Nenhuma especificação técnica adicionada." + botão "Adicionar especificação".
   - Cada linha: inputs `label`, `value`, select `type`, input `notes`, botão remover.
   - Auto-gera `key` no `onBlur`/`onChange` do `label` via `normalizeSpecKey`. Se `key` resultar vazia, mostra erro inline e bloqueia (a validação Zod já cobre `min 1`).
   - Botão "Adicionar especificação" desabilitado quando atinge 30; tooltip/aviso.
   - Layout responsivo (grid sm:grid-cols-12), reaproveita `Input`, `Select`, `Button`, `Label`.

### Arquivos a editar

3. **`src/services/operations/inventoryItems.ts`**:
   - Adicionar `technical_specs?: TechnicalSpec[]` em `SerializedItemInput` e `QuantityItemInput`.
   - Em `createSerializedItem`/`createQuantityItem`: `metadata: { technical_specs: input.technical_specs ?? [] }`.
   - Em `updateSerializedItem`/`updateQuantityItem`: aceitar opcional `_currentMetadata` e, quando `technical_specs !== undefined`, setar `patch.metadata = { ...(currentMetadata ?? {}), technical_specs }` para preservar outras chaves.

4. **`src/components/operations/inventory/InventoryItemFormDialog.tsx`** (serializado):
   - Estender schema com `technical_specs: technicalSpecsArraySchema`.
   - `useEffect`: carregar `getTechnicalSpecs(item?.metadata)` no reset.
   - Renderizar `<TechnicalSpecsSection control={form.control} />` abaixo de Observações.
   - Passar `technical_specs` e `_currentMetadata: item?.metadata` para o update.

5. **`src/components/operations/inventory/InventoryQuantityItemFormDialog.tsx`** (por quantidade):
   - Mesmas mudanças do serializado.

6. **`src/hooks/operations/useInventoryItems.ts`**:
   - Tipos das mutations já são `Partial<...Input>`; nenhuma mudança estrutural — `technical_specs` flui automaticamente.

7. **`src/components/operations/inventory/InventorySerializedItemsTab.tsx`** e **`InventoryQuantityItemsTab.tsx`**:
   - Adicionar coluna discreta "Specs" exibindo `getTechnicalSpecs(item.metadata).length` (ou `0`). Sem popover/drawer nesta sprint (preferência do brief).

### Regras técnicas

- Salvamento sempre via merge: `{ ...(metadata ?? {}), technical_specs }` — chave `source` ou outras nunca apagadas.
- Toasts reutilizam mensagens existentes ("Item criado/atualizado com sucesso.", versão "por quantidade" idem).
- Erros de validação Zod (duplicado, limite, key vazia) aparecem inline no formulário; submit bloqueado.
- RLS preservada — todas as gravações continuam pelo cliente Supabase autenticado, filtradas por `organization_id` (sem alterações nas regras).

### Fora de escopo

Tabela nova, presets por categoria, templates por tipo, vínculo entre itens, kits, reservas, disponibilidade, proposta, popover/drawer de visualização rápida, KPI "itens com specs" na Visão Geral, edge functions, RPCs, alteração de schema.

### Riscos

- `metadata` pode vir como `null` em itens antigos — `getTechnicalSpecs` e `mergeTechnicalSpecs` tratam.
- `useFieldArray` precisa de `id` estável por linha (React Hook Form gera automaticamente).
- Coluna "Specs" nas duas tabs aumenta levemente largura — manter classe `text-center w-16` para não poluir.
