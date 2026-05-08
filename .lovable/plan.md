
# Sprint PRICE 1.0 — Tabela de Preço Dinâmica da Proposta

Cria uma camada de condições comerciais válidas por período. Cada proposta passa a ter `valor base`, uma tabela de tiers por data, e um `valor vigente` calculado automaticamente — visível no editor, no link público e no PDF. Preparado para integrar pagamento e conciliação ERP em sprints futuras.

## 1. Banco de dados (1 migration)

### Novas tabelas
- **`proposal_dynamic_pricing_rules`** — 1 regra por (organization_id, proposal_id). Campos: `enabled`, `base_amount`, `currency`, `status` (`draft|active|expired|disabled|requires_requote`), `current_tier_id`, `current_amount`, `next_tier_id`, `next_amount`, `last_calculated_at`, `notes`, auditoria.
- **`proposal_dynamic_pricing_tiers`** — N tiers por regra. Campos: `tier_order`, `label`, `starts_at`, `ends_at`, `adjustment_type` (`base_amount|fixed_price|percent_adjustment|fixed_adjustment`), `adjustment_value`, `final_amount`, `is_current`, `is_expired`. Constraint impede `ends_at < starts_at`.
- **`proposal_dynamic_pricing_events`** — log: `event_type` (`created|updated|tier_activated|tier_expired|proposal_repriced|disabled|manual_override`), `previous_amount`, `new_amount`, `message`, `metadata jsonb`.

### Alteração em `proposals`
Adicionar (idempotente): `dynamic_pricing_enabled`, `dynamic_pricing_current_amount`, `dynamic_pricing_status`, `dynamic_pricing_snapshot jsonb`, `dynamic_pricing_last_calculated_at`.

### Índices
- `(organization_id, proposal_id)` em todas as três tabelas.
- `(pricing_rule_id, tier_order)` em tiers.
- `(proposal_id, created_at desc)` em events.

### RLS (helpers existentes do projeto)
- **SELECT**: `user_belongs_to_organization(organization_id)` em todas.
- **INSERT/UPDATE em rules e tiers**: organização + papel comercial autorizado (`admin|owner|sales_manager|closer`), via `has_role`.
- **DELETE / disable / manual_override**: somente `admin|owner`.
- **events**: INSERT pelo backend (RPCs `SECURITY DEFINER`); SELECT por organização.

### Triggers
- `set_updated_at` nas duas tabelas mutáveis.
- `trg_dynamic_pricing_tier_overlap_guard` (BEFORE INSERT/UPDATE em tiers): rejeita sobreposição de intervalos de datas dentro da mesma `pricing_rule_id`.
- `trg_dynamic_pricing_tier_compute_final_amount` (BEFORE INSERT/UPDATE): calcula `final_amount` a partir do `base_amount` da regra e do tipo/valor de ajuste.

### RPCs `SECURITY DEFINER` (`search_path = public`)
1. **`calculate_proposal_dynamic_price(p_proposal_id uuid, p_reference_at timestamptz default now())`** — retorna struct com `current_*`, `previous_*`, `next_*`, `status`, `message`. Marca tiers expirados, atualiza `current_tier_id`, `current_amount`, `next_*`, `last_calculated_at`. Se passou do último tier → `status = requires_requote`. Registra evento `tier_activated` quando há virada.
2. **`apply_dynamic_price_to_proposal(p_proposal_id uuid, p_reference_at timestamptz default now())`** — chama #1 → atualiza `proposals.dynamic_pricing_current_amount`, `dynamic_pricing_status`, `dynamic_pricing_snapshot` (jsonb completo) e `dynamic_pricing_last_calculated_at`. **Não** mexe em `total_amount` quando proposta tem itens (regra do projeto: net value vem dos itens). Registra evento `proposal_repriced`.

### Integração INV 1.4
Helper `_resolve_dynamic_pricing_base(p_proposal_id)` que retorna o valor da proposta **após** ajuste por ocupação (lê `proposal_items.inventory_adjusted_unit_price` agregado se existirem snapshots; senão usa `total_amount`). Esse helper é chamado pelas RPCs ao recalcular `base_amount` quando o usuário pede "Sincronizar valor base".

## 2. Backend TypeScript

### Tipos e schemas (`src/lib/proposals/dynamicPricing.ts`)
- Enums (`status`, `adjustment_type`, `event_type`).
- Zod schemas: `dynamicPricingRuleSchema`, `dynamicPricingTierSchema`, helpers `formatBRL`, `tiersOverlap`, `findCurrentTier`.

### Serviço (`src/services/proposals/proposalDynamicPricing.ts`)
- `getDynamicPricing(proposalId)` — retorna `{ rule, tiers, currentCalculation }`.
- `saveDynamicPricingRule(payload)` — upsert rule + replace tiers (transação client-side com cleanup).
- `calculateDynamicPrice(proposalId, referenceAt?)` — chama RPC #1.
- `applyDynamicPrice(proposalId)` — chama RPC #2.
- `listDynamicPricingEvents(proposalId)`.
- `disableDynamicPricing(proposalId)` — rule.status='disabled', enabled=false, registra evento.

### Hooks (`src/hooks/proposals/useProposalDynamicPricing.ts`)
- `useProposalDynamicPricing(proposalId)`
- `useSaveProposalDynamicPricingRule()`
- `useCalculateProposalDynamicPrice()`
- `useApplyProposalDynamicPrice()`
- `useProposalDynamicPricingEvents(proposalId)`
- `useDisableProposalDynamicPricing()`
- Invalidam `['proposal', id]` e `['proposal-dynamic-pricing', id]`.

## 3. Frontend

### Editor interno
- **`ProposalDynamicPricingPanel.tsx`** — novo bloco no `ProposalEditorModal`/`ProposalEditor`. Exibe: status badge, valor base (com botão "Sincronizar com fator INV"), valor vigente, próxima virada, última atualização, ações (Ativar/Desativar tabela, Recalcular agora, Aplicar valor vigente), histórico de eventos.
- **`DynamicPricingTierEditor.tsx`** — tabela editável com validações em tempo real (nome obrigatório, fim ≥ início, sem sobreposição, valor final ≥ 0, alerta de "buraco entre faixas"). Recalcula `final_amount` no client conforme tipo de ajuste.

### Link público (`ProposalPublicView`)
- **`PublicProposalDynamicPricingBanner.tsx`** — antes de "Condições de Pagamento". Estados:
  - **Ativa**: "Valor vigente hoje: R$ X / Válido até DD/MM HH:mm / Próxima atualização: R$ Y em DD/MM" + cláusula fixa de pagamento fora do prazo + texto discreto do valor anterior expirado.
  - **Expirada/`requires_requote`**: aviso destacado "Esta condição comercial expirou. Nova cotação necessária." (esconde botão de aprovação ou desabilita).
- Botão de aprovação muda label para **"Aprovar proposta com valor vigente"** quando dynamic pricing está ativo. Payload de aprovação inclui `current_tier_id`, `current_amount`, `dynamic_pricing_snapshot`.

### PDF (`ProposalPDFViewer` / generator)
- **`PdfDynamicPricingSection.tsx`** — seção "Condição Comercial Dinâmica" antes de "Condições de Pagamento". Tabela de tiers + cláusula obrigatória sobre data efetiva de pagamento.

### Pequenos ajustes
- `ProposalPreview.tsx` e `ProposalVisualizarTab.tsx`: render do banner em modo de visualização interna.
- `ProposalCapacityImpactBlock` (INV 1.4): adicionar link "Aplicar como base da tabela dinâmica" quando snapshot já existir.

## 4. Estrutura visual do painel

```text
┌────────────────────────────────────────────────────────┐
│ Tabela de Preço Dinâmica            [Ativa] [⋯ Ações] │
├────────────────────────────────────────────────────────┤
│ Valor base:  R$ 3.714,00   [Sincronizar com fator INV] │
│ Vigente hoje: R$ 3.714,00  até 08/05 23:59             │
│ Próxima virada: R$ 4.085,40 em 09/05 00:00             │
├────────────────────────────────────────────────────────┤
│ # │ Condição          │ Início │ Fim   │ Tipo │ Valor │
│ 1 │ Antecipado        │ -      │ 06/05 │ %    │ -10%  │
│ 2 │ Padrão            │ 07/05  │ 08/05 │ base │ R$ X  │
│ 3 │ Fora do prazo     │ 09/05  │ 10/05 │ %    │ +10%  │
│ + Adicionar condição                                   │
├────────────────────────────────────────────────────────┤
│ Eventos recentes (5 últimos)                           │
└────────────────────────────────────────────────────────┘
```

## 5. Critérios de aceite (resumido)
- Tabelas + RLS criadas; trigger anti-sobreposição funciona.
- Snapshot na proposta atualizado por `apply_dynamic_price_to_proposal`.
- `requires_requote` quando passa do último tier.
- Painel no editor, banner público e seção PDF renderizam estados correto/expirado/próxima virada.
- Botão público usa "valor vigente" e payload contém snapshot.
- Base respeita ajuste de ocupação (INV 1.4) quando existe.
- Typecheck + build passam; INV 1.4 intacto.

## Arquivos
**Migration**: 1 nova (tabelas, RLS, triggers, RPCs, alter `proposals`).
**Novos**: `src/lib/proposals/dynamicPricing.ts`, `src/services/proposals/proposalDynamicPricing.ts`, `src/hooks/proposals/useProposalDynamicPricing.ts`, `ProposalDynamicPricingPanel.tsx`, `DynamicPricingTierEditor.tsx`, `PublicProposalDynamicPricingBanner.tsx`, `PdfDynamicPricingSection.tsx`.
**Editados**: `ProposalEditorModal.tsx`, `ProposalEditor.tsx`, `ProposalPublicView.tsx`, `ProposalPDFViewer.tsx`, `ProposalPreview.tsx`, `ProposalCapacityImpactBlock.tsx`, `src/integrations/supabase/types.ts` (auto).

## Riscos
- Sobreposição de datas mal validada → mitigado por trigger DB + validação UI.
- Conflito com cálculo de totais por itens → não tocamos em `total_amount` quando há itens; apenas snapshot.
- Performance do recálculo em listagens → recálculo só on-demand e ao salvar tiers.
