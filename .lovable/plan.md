# Sprint INV 1.4 — Ocupação como Fator de Preço

Cria o motor de fator comercial baseado em ocupação real do inventário no período operacional. Não toca ainda em "tabela dinâmica por data" — apenas no fator de ocupação, snapshot por item de proposta, sinalização de aprovação e visibilidade comercial.

## 1. Banco de dados (1 migration)

### Tabela `inventory_pricing_rules`
Conforme proposto, com RLS por `organization_id`:
- Policies: `SELECT` para qualquer membro da org (`organization_id = get_user_organization_id()`); `INSERT/UPDATE/DELETE` exigem `has_role(auth.uid(),'admin')` OR `has_role(auth.uid(),'owner')`.
- Trigger `update_updated_at_column` em UPDATE.
- Trigger `set_updated_by` (se existir helper, senão `auth.uid()` no INSERT/UPDATE).
- Index `(organization_id, status, min_occupancy_rate)`.

### Seed por organização
Função `public.seed_inventory_pricing_rules(p_org uuid)` (SECURITY DEFINER, search_path public) que insere as 4 regras padrão (Baixa, Moderada, Alta, Crítica) se a org ainda não tiver nenhuma. Chamada:
- Loop inicial em todas as `organizations` existentes para popular.
- Trigger `AFTER INSERT ON organizations` para popular novas orgs.

### Snapshot em `proposal_items`
```sql
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS inventory_occupancy_rate numeric,
  ADD COLUMN IF NOT EXISTS inventory_pricing_factor numeric,
  ADD COLUMN IF NOT EXISTS inventory_adjustment_amount numeric,
  ADD COLUMN IF NOT EXISTS inventory_adjusted_unit_price numeric,
  ADD COLUMN IF NOT EXISTS inventory_risk_level text,
  ADD COLUMN IF NOT EXISTS inventory_pricing_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb;
```

### RPC `calculate_inventory_pricing_factor`
SECURITY DEFINER, `SET search_path = public`. Lógica:
1. Lê snapshot via `get_inventory_availability_snapshot(start, end, category, family, requested)` (já existente da INV 1.3) → `available`, `pre_reserved`, `reserved`, `operational`, `risk_level`.
2. Recalcula `occupancy_rate` agregando `get_inventory_capacity_by_period`.
3. Busca regra ativa em `inventory_pricing_rules` da org, com match por `(category_id, family_id)` e faixa `min_occupancy_rate <= rate AND (max_occupancy_rate IS NULL OR rate <= max_occupancy_rate)`. Ordem de prioridade: regra com `category+family` > só `category` > só `family` > global. Fallback: zero adjustment.
4. Calcula `adjustment_amount` (percent ou fixed) e `adjusted_amount`.
5. Retorna estrutura completa (rule_id, fator, valores, max_discount_percent, requires_approval, message PT-BR).

GRANT EXECUTE TO authenticated.

## 2. Backend TS

### `src/services/operations/inventoryPricing.ts`
- `calculatePricingFactor(payload)` → chama RPC.
- `listPricingRules()`, `createPricingRule()`, `updatePricingRule(id, patch)`, `deactivatePricingRule(id)` (UPDATE status='inactive').

### `src/lib/operations/inventoryPricing.ts`
Schemas Zod:
- `inventoryPricingRuleSchema` (name, category_id?, family_id?, min/max_occupancy_rate, price_adjustment_type, price_adjustment_value, max_discount_percent?, requires_approval, risk_level, status).
- `inventoryPricingFactorPayloadSchema` (start_date, end_date, category_id?, family_id?, requested_quantity > 0, base_amount >= 0).
- Helpers: `RISK_TO_BADGE`, `formatPricingFactor`, `derivePricingSnapshot(unitPrice, qty, factorResult)`.

### `src/hooks/operations/useInventoryPricing.ts`
- `useInventoryPricingRules()`
- `useCreateInventoryPricingRule()`, `useUpdateInventoryPricingRule()`, `useDeactivateInventoryPricingRule()` (invalida query key).
- `useInventoryPricingFactor(payload, { enabled })` — query key `['inventory','pricing','factor', payload]`, `staleTime: 30s`.

## 3. Frontend

### Configurações de regras de preço
Nova sub-aba "Regras de Preço por Ocupação" dentro da aba "Reservas" (junto ao Calendário) ou — se houver tela de configurações já — anexar lá. Componentes:
- `InventoryPricingRulesTab.tsx` (lista/tabela + toggle status).
- `InventoryPricingRuleFormDialog.tsx` (create/edit; validações Zod). Acesso restrito por `useUserRole`/`has_role` (admin/owner).
Tabela: Nome, Faixa (`min%`–`max%`), Ajuste, Desconto máx., Aprovação, Risco, Status, ações (editar / desativar).

### Editor de proposta — `ProposalItemsManager.tsx`
Para cada item com `product_id` que tenha categoria/família de inventário:
- Hook `useInventoryPricingFactor` disparado quando o item tem `quantity > 0` e a proposta tem datas operacionais (já hoje em `proposals` via `event_start_date`/`operational_start_date` — usar o que existir).
- Bloco discreto sob o item: Capacidade `XX%`, Fator `+YY%`, Risco, Disponível X / Demandado Y, Preço base / Preço ajustado.
- Botão "Aplicar fator de ocupação" (ou aplicação automática + badge "Fator aplicado") que persiste no item:
  - `inventory_occupancy_rate`, `inventory_pricing_factor`, `inventory_adjustment_amount`, `inventory_adjusted_unit_price`, `inventory_risk_level`, `inventory_pricing_snapshot` (RPC raw + ts).
- Sinalização: se `discount_percent` > `max_discount_percent` da regra → `Alert` destrutivo "Desconto acima do permitido… aprovação necessária". Não trava nesta sprint, apenas sinaliza.

### Painel da proposta — `ProposalInventoryPanel.tsx`
Novo bloco "Impacto comercial da capacidade":
- Agrega snapshots dos `proposal_items`: ocupação média (ponderada por valor), maior risco, soma `inventory_adjustment_amount`, `requires_approval` (qualquer item true).
- Card com tabela Produto / Ocupação / Fator / Risco / Status (Aplicado | Sem ajuste).

### Visão Geral do Inventário — `InventoryOverviewTab.tsx`
Novo bloco "Pressão comercial do estoque" (ao lado de Capacidade Operacional):
- Cards: ocupação média 7d / 30d (já vem do `useInventoryCapacityByPeriod`), categorias com acréscimo ativo (categorias com risk_level >= medium), receita protegida (sum `inventory_adjustment_amount` últimos 30 dias via SELECT em `proposal_items`), propostas com desconto em cenário crítico (count proposals com algum item `inventory_risk_level='critical'` AND `discount_percent > 0`).
- RPC opcional `get_inventory_pricing_pressure(p_days int)` para evitar N queries no client.

## 4. Arquivos

**Novos**
- `supabase/migrations/<ts>_inv_1_4_pricing_rules.sql`
- `src/services/operations/inventoryPricing.ts`
- `src/lib/operations/inventoryPricing.ts`
- `src/hooks/operations/useInventoryPricing.ts`
- `src/components/operations/inventory/InventoryPricingRulesTab.tsx`
- `src/components/operations/inventory/InventoryPricingRuleFormDialog.tsx`
- `src/components/proposals/ProposalItemPricingFactorBlock.tsx` (bloco por item)
- `src/components/proposals/ProposalCapacityImpactBlock.tsx`
- `src/components/operations/inventory/InventoryPricingPressureBlock.tsx`

**Editados**
- `src/components/operations/inventory/InventoryReservationsTab.tsx` (nova sub-aba "Regras de preço")
- `src/components/proposals/ProposalItemsManager.tsx` (integra bloco por item + persistência do snapshot)
- `src/components/proposals/ProposalInventoryPanel.tsx` (novo bloco de impacto)
- `src/components/operations/inventory/InventoryOverviewTab.tsx` (bloco pressão comercial)
- `src/integrations/supabase/types.ts` (auto)

## 5. Segurança e qualidade
- RLS: leitura org-wide; mutações somente admin/owner via `has_role`.
- RPC `SECURITY DEFINER` + `SET search_path = public` (memory rule).
- Snapshot imutável: gravado no momento de aplicação, nunca recalculado retroativamente.
- Tokens semânticos do design system; nenhum HSL hardcoded.
- Sem mudanças na INV 1.3 (apenas leituras adicionais às RPCs já existentes).

## 6. Critérios de aceite
Conforme listado: tabela + RLS + seed por org, CRUD admin de regras, RPC de cálculo, snapshot persistido em `proposal_items`, sinalização de desconto acima do permitido, blocos de impacto na proposta e pressão comercial na visão geral, typecheck/build verdes, nada da INV 1.3 quebra.
