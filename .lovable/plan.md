# Sprint INV 0.7.1 — Categorias Mistas e Controle por Família/Item

Objetivo: permitir que uma categoria (ex.: Conectividade) aceite famílias e itens **serializados e por quantidade ao mesmo tempo**, sem afetar dados existentes nem reservas. Categoria define o que é **permitido**, família define o **tipo padrão**, item salva o **tipo final**.

## 1. Banco de dados (migration)

Criar enum dedicado para categoria (item nunca pode ser `mixed`):

```sql
create type public.inventory_category_control_mode as enum ('serialized','quantity','mixed');

alter table public.inventory_categories
  add column control_mode public.inventory_category_control_mode
  not null default 'serialized';

update public.inventory_categories
set control_mode = item_kind::text::public.inventory_category_control_mode;

alter table public.inventory_families
  add column item_kind public.inventory_item_kind not null default 'serialized';

-- Backfill família a partir do item_kind atual da categoria,
-- defaultando para serialized quando a categoria for mista.
update public.inventory_families f
set item_kind = case
  when c.item_kind = 'quantity' then 'quantity'::public.inventory_item_kind
  else 'serialized'::public.inventory_item_kind
end
from public.inventory_categories c
where f.category_id = c.id;
```

Validação de coerência (trigger `BEFORE INSERT/UPDATE` em `inventory_families`):
- Se `category.control_mode = 'serialized'` → `family.item_kind` deve ser `serialized`.
- Se `category.control_mode = 'quantity'` → `family.item_kind` deve ser `quantity`.
- Se `mixed` → ambos permitidos.

`inventory_categories.item_kind` **permanece** (legado/backward compat). Não tocar em `inventory_items.item_kind` nem em RLS.

## 2. Frontend — Categoria

`InventoryCategoryFormDialog.tsx` + `InventoryCategoriesTab.tsx` + `services/operations/inventoryCategories.ts`:

- Substituir “Tipo padrão do item” por **“Modo de controle permitido”** com opções: Serializado, Por quantidade, Mista.
- Persistir em `control_mode`. Continuar enviando `item_kind` espelhado (serialized/quantity; quando “Mista”, gravar `serialized` como fallback no campo legado).
- Listagem: coluna **“Modo de controle”** lendo `control_mode` (com fallback `?? item_kind ?? 'serialized'`).
- Adicionar `control_mode` aos tipos em `InventoryCategoryInput` e ao retorno de `listInventoryCategories`.

## 3. Frontend — Família

`InventoryFamilyFormDialog.tsx` + `services/operations/inventoryFamilies.ts` + `useInventoryFamilies`:

- Adicionar campo **“Tipo padrão do item”** (Serializado / Por quantidade) no form.
- Bloquear opções incompatíveis com o `control_mode` da categoria selecionada; mensagem: *“O tipo padrão desta família precisa respeitar o modo de controle permitido da categoria.”*
- Para categoria `serialized`/`quantity`, fixar e desabilitar o select com o valor único.
- Adicionar `item_kind` em `InventoryFamily`, `InventoryFamilyInput`, `create` e `update`.
- Mostrar coluna “Tipo” na listagem de famílias.

## 4. Frontend — Itens Serializados

`InventorySerializedItemsTab.tsx` (linha 78) e form de item:
- Filtro de categorias: `control_mode IN ('serialized','mixed')` (com fallback para `item_kind === 'serialized'`).
- Após escolher categoria, o select de família deve filtrar `family.item_kind === 'serialized'`.

## 5. Frontend — Itens por Quantidade

`InventoryQuantityItemsTab.tsx` (linha 88) e `InventoryQuantityItemFormDialog.tsx`:
- Filtro de categorias: `control_mode IN ('quantity','mixed')`.
- Select de família filtrando `family.item_kind === 'quantity'`.

## 6. Produto — Composição de Inventário

`ProductBOMEditor.tsx` e referências em `ProductEditorPage.tsx` / `ProductModal.tsx`:
- Renomear rótulo “Composição técnica (BOM)” → **“Composição de Inventário”**.
- Subtexto novo: *“Defina quais tipos de itens físicos este produto exige para ser entregue. O sistema usará essa composição para calcular disponibilidade, reserva e ocupação do estoque. A quantidade deve representar o consumo por ponto vendido.”*
- Mensagem vazia: *“Nenhum componente. Sem composição definida, a reserva usa o próprio produto.”*
- Toasts/labels internos com “BOM” → “Composição de Inventário” (manter “composição técnica” quando precisar reforço técnico).
- Selects de categoria/família passam a aceitar categorias `mixed`; família continua determinando o tipo do componente. Sem mudança na estrutura de dados do BOM.

## 7. Fora de escopo

Reservas, pré-reserva automática, disponibilidade por período, ocupação, kits, QR Code, upload de imagem, edge functions, cron, novas RPCs, remoção de `inventory_categories.item_kind`, mudanças no schema de produto além do label.

## Arquivos impactados

- Migration nova em `supabase/migrations/`
- `src/services/operations/inventoryCategories.ts`
- `src/services/operations/inventoryFamilies.ts`
- `src/components/operations/inventory/InventoryCategoryFormDialog.tsx`
- `src/components/operations/inventory/InventoryCategoriesTab.tsx`
- `src/components/operations/inventory/InventoryFamilyFormDialog.tsx`
- `src/components/operations/inventory/InventoryFamiliesTab.tsx`
- `src/components/operations/inventory/InventorySerializedItemsTab.tsx` + form de item serializado
- `src/components/operations/inventory/InventoryQuantityItemsTab.tsx` + `InventoryQuantityItemFormDialog.tsx`
- `src/components/products/ProductBOMEditor.tsx`
- `src/pages/ProductEditorPage.tsx` e `src/components/products/ProductModal.tsx` (textos)
- `src/lib/operations/inventoryLabels.ts` (novo `CATEGORY_CONTROL_MODE_LABEL` e options)

## Riscos

- Tipos do Supabase (`types.ts`) regeneram após migration; código TS deve usar fallback `control_mode ?? item_kind` durante a transição.
- Trigger de validação em famílias pode rejeitar dados legados inconsistentes — o backfill já alinha; verificar no smoke test.
- Filtros novos podem esconder categorias antigas se `control_mode` não for preenchido — fallback no frontend cobre.

## Critérios de aceite (resumo)

- Categoria “Conectividade” pode ser salva como **Mista**.
- Família serializada e por quantidade convivem na mesma categoria mista.
- Item serializado só vê categorias `serialized`/`mixed` e famílias serializadas.
- Item por quantidade só vê categorias `quantity`/`mixed` e famílias por quantidade.
- Produto exibe “Composição de Inventário” com novo subtexto.
- Nenhum item gravado com `item_kind = mixed`.
- Visão Geral, Reservas, Locais, RLS e permissões intactos.
