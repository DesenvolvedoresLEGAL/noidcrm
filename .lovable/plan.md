
# Plano — Suporte a produtos cobrados por Ponto-dia

## Objetivo
Permitir que produtos (LEGAL™ Core Indoor etc.) sejam vendidos por **pontos × diárias × preço por ponto-dia**, mantendo:
- Cálculo financeiro = `quantity_points × billing_days × unit_price_point_day`
- Reserva de estoque = apenas `quantity_points` durante o período do evento
- BOM (composição técnica) replicada por ponto
- Compatibilidade total com produtos atuais (`one_time`, `recurring`, unidade "dia")

---

## 1. Banco de dados (migrações)

### 1.1 `products` — novo billing model
- Expandir constraint `products_billing_type_check` para incluir `'point_day'`.
- Novos campos:
  - `default_unit_price_point_day numeric` (preço sugerido por ponto-dia)
  - `default_billing_days integer` (sugestão padrão de diárias, opcional)
  - `default_quantity_points integer default 1`
- Nova tabela **`product_bom_items`** (composição técnica / receita por ponto):
  - `product_id` → produto "pai"
  - `component_product_id` → produto/equipamento físico
  - `quantity_per_point numeric not null default 1`
  - `inventory_category_id`, `inventory_family_id` (fallback quando o componente não é produto)
  - `label`, `notes`, `order_index`
  - RLS por organization_id

### 1.2 `proposal_items` — novos campos
- Expandir `proposal_items_billing_type_check` para incluir `'point_day'`.
- Novos campos:
  - `quantity_points integer`
  - `billing_days integer`
  - `unit_price_point_day numeric`
- Trigger `before insert/update`:
  - Se `billing_type = 'point_day'`:
    - Validar `quantity_points >= 1` e `billing_days >= 1`
    - `quantity := quantity_points * billing_days` (mantém compatibilidade do campo `quantity` legado para somatórios)
    - `unit_price := unit_price_point_day`
    - `total := quantity_points * billing_days * unit_price_point_day * (1 - discount_percent/100)`

### 1.3 Reservas de estoque
- Em `inventoryProposalBridge.generatePreReservationFromProposal` (e equivalente RPC, se houver):
  - Para itens com `billing_type = 'point_day'`:
    - `requested_quantity = quantity_points` (NÃO `quantity`)
    - Período = `event_start_date` → `event_end_date` (já existente)
    - Se o produto tiver linhas em `product_bom_items`, gerar **uma reserva por componente**, com `requested_quantity = quantity_points × quantity_per_point`, usando `serialized_item_id` / `quantity_item_id` / `category_family_demand` conforme o componente.
    - Caso contrário, manter o comportamento atual baseado em `inventory_control_mode` do produto pai, multiplicando por `quantity_points` (não por `quantity`).

### 1.4 Totais de proposta
- Atualizar função `calculateProposalTotal` (e o RPC `orchestrate_proposal_financials` se ele recalcular) para tratar `point_day` como `one_time` para fins de desconto de pagamento, mas usando `total` já calculado pelo trigger.

---

## 2. Frontend — Cadastro de produto
Arquivo principal: `src/components/products/*` e `src/services/supabase/products.ts`.
- Adicionar opção **"Ponto-dia"** no seletor de billing type.
- Quando selecionado, exibir:
  - Preço por ponto-dia (`default_unit_price_point_day`)
  - Diárias padrão (`default_billing_days`)
  - Pontos padrão (`default_quantity_points`)
- Nova aba/seção **"Composição técnica (BOM)"**: CRUD de `product_bom_items` (buscar componentes por produto OU por categoria/família de inventário).
- Atualizar zod schema em `productSchema`.

---

## 3. Frontend — Editor de proposta
Arquivo principal: `src/components/proposals/ProposalItemsManager.tsx` e modal de edição de item.
- Quando o item tem `billing_type = 'point_day'` (herdado do produto ou trocado manualmente):
  - Esconder `quantity` puro.
  - Exibir três inputs: **Pontos**, **Diárias**, **Preço por ponto-dia**.
  - Linha de cálculo em tempo real:
    `3 pts × 2 diárias × R$ 397 = R$ 2.382`
- `calculateItemTotals` (em `src/services/supabase/proposal-items.ts`):
  - Branch para `point_day`: `total = quantity_points * billing_days * unit_price_point_day * (1 - discount%)`.
- Garantir um único registro por produto (não criar linhas múltiplas).

---

## 4. Visualização cliente / PDF / link público
Arquivos: `ProposalPreview.tsx`, `ProposalPDFViewer.tsx`, `PublicProposal*`, snapshots.
- Renderizador de linha de item, quando `billing_type = 'point_day'`:
  ```
  LEGAL™ Core Indoor
  3 pontos × 2 diárias
  R$ 397 / ponto-dia
  Total: R$ 2.382
  ```
- Snapshot de aceite (`proposal_acceptance_snapshot` / bundle público) precisa serializar os 3 campos novos para que o histórico mostre o mesmo cálculo.

---

## 5. Compatibilidade
- Itens `one_time` / `recurring` / com unidade "dia" continuam usando `quantity × unit_price` — sem mudança.
- Migração de dados: nenhuma alteração em registros existentes; apenas novas colunas nullable e check constraint expandida.
- Edge functions de PDF / sync ERP (Umma, Human) precisam apenas ler `total` já calculado; só mudam se renderizam descrição linha-a-linha (vamos auditar `generate-proposal-pdf` e ajustar o render de item).

---

## 6. Itens fora de escopo (futuro)
- UI de bulk apply do modelo Ponto-dia para Outdoor/Prime/Access Point — basta cadastrar cada produto com `billing_type = 'point_day'`.
- Pricing dinâmico por antecedência sobre `unit_price_point_day` (pode reaproveitar `proposal_dynamic_pricing` posteriormente).

---

## Arquivos impactados (resumo)
**Backend / DB**
- Nova migração: constraint + colunas em `products` e `proposal_items`, tabela `product_bom_items` + RLS, ajuste do trigger de totais e do RPC `orchestrate_proposal_financials`.

**Services**
- `src/services/supabase/products.ts` (schema + tipos)
- `src/services/supabase/proposal-items.ts` (`calculateItemTotals`, `calculateProposalTotal`)
- `src/services/operations/inventoryProposalBridge.ts` (reserva = pontos, BOM expand)
- Novo: `src/services/supabase/product-bom.ts`

**UI**
- `src/components/products/*` (form de produto + aba BOM)
- `src/components/proposals/ProposalItemsManager.tsx` + modal de item
- `src/components/proposals/ProposalPreview.tsx`, `ProposalPDFViewer.tsx`, `PublicProposal*`
- Edge function `generate-proposal-pdf` (render de linha)

## Riscos
- Trigger novo no `proposal_items` precisa coexistir com o cálculo client-side (`calculateItemTotals`) — usaremos o trigger como fonte de verdade e o client-side só para preview.
- Reserva de estoque: garantir que a função existente não multiplique duas vezes por `quantity` quando o item é `point_day`.
- Snapshots antigos (`proposals.snapshot`) sem campos `point_day` — renderer precisa fallback para layout atual.
