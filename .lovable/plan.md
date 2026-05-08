# PRICE 1.0.1 — Automação da Tabela de Preço Dinâmica por Antecedência

## Objetivo
Substituir a configuração manual de tiers da Tabela Dinâmica (PRICE 1.0) por geração automática a partir da diferença entre a data de pagamento e o primeiro dia do evento. Modo manual fica como fallback admin/owner.

## Regra comercial oficial
| Antecedência | Ajuste |
|---|---|
| 30+ dias | -10% |
| 21–29 dias | 0% |
| 10–20 dias | +10% |
| 4–9 dias | +20% |
| 0–3 dias | +30% |
| Pós-evento | +50% (configurável: surcharge / requires_requote / block_payment) |

A validade da proposta passa a ser sempre `event_start_date`.

---

## 1. Banco de dados (1 migration)

### 1.1 Alterar `proposal_dynamic_pricing_rules`
Adicionar colunas:
- `pricing_mode text default 'manual'` (`manual` | `event_antecedence`)
- `event_start_date date`
- `auto_generated boolean default false`
- `show_expired_tiers boolean default true`
- `post_event_policy text default 'surcharge'` (`surcharge` | `requires_requote` | `block_payment`)

CHECK constraints para os enums textuais.

### 1.2 Nova tabela `proposal_dynamic_pricing_factor_rules`
Configuração por organização das faixas oficiais:
- `id`, `organization_id`, `name`, `label`
- `min_days_before_event int` (nullable = sem limite inferior)
- `max_days_before_event int` (nullable = sem limite superior; `-1` = pós-evento)
- `adjustment_type text default 'percent'` (`percent` | `fixed`)
- `adjustment_value numeric default 0`
- `sort_order int`, `status text default 'active'` (`active` | `inactive`)
- `created_by`, `updated_by`, `created_at`, `updated_at`

RLS:
- SELECT: membros da organização (helper `get_user_organization_id`)
- INSERT/UPDATE: `has_role(admin|owner)` + organização correta
- Sem DELETE (apenas inativar via `status`)

### 1.3 Seed automático
Trigger em `organizations` (AFTER INSERT) + função `seed_default_pricing_factor_rules(p_org_id)` chamada também via backfill para orgs existentes, criando as 6 faixas oficiais.

### 1.4 RPCs

**`generate_event_antecedence_pricing_for_proposal(p_proposal_id uuid, p_force_regenerate boolean default false)`**
- Valida tenant via `get_user_organization_id`
- Resolve `event_start_date` da proposta ou da `opportunity` vinculada (campo `event_start_date` / `event_date`); se ausente → erro controlado `EVENT_DATE_MISSING`
- Atualiza `proposals.valid_until = event_start_date`
- Calcula `base_amount` usando `total_amount` atual da proposta (já inclui ajuste de ocupação INV 1.4 quando presente)
- Upsert em `proposal_dynamic_pricing_rules` com `pricing_mode='event_antecedence'`, `auto_generated=true`, `enabled=true`, `status='active'`
- Limpa tiers `auto_generated=true` quando `p_force_regenerate` ou se `base_amount`/`event_start_date` mudou
- Gera 6 tiers a partir de `proposal_dynamic_pricing_factor_rules` ativos da org, com janelas:
  - `30+`: `-infinito` até `event - 30d 23:59:59`
  - `21–29`: `event - 29d 00:00` → `event - 21d 23:59:59`
  - `10–20`: `event - 20d 00:00` → `event - 10d 23:59:59`
  - `4–9`: `event - 9d 00:00` → `event - 4d 23:59:59`
  - `0–3`: `event - 3d 00:00` → `event 23:59:59`
  - `pós`: `event + 1d 00:00` → `null`
- `final_amount` = `base + percent` ou `base + fixed`
- Chama `calculate_proposal_dynamic_price`
- Atualiza `proposals.dynamic_pricing_*` (snapshot, current_amount, status, last_calculated_at)
- Registra eventos `created`/`updated` e `tier_activated`
- Retorna JSON com `proposal_id`, `base_amount`, `event_start_date`, `current_days_before_event`, `current_amount`, `current_factor`, `current_label`, `next_amount`, `next_label`, `status`, `message`

**`calculate_proposal_dynamic_price`** (atualizar)
- Suporta `pricing_mode='event_antecedence'` além do `manual`
- Quando pós-evento e `post_event_policy='requires_requote'` → status `requires_requote`
- Identifica vigente, anterior expirado, próxima virada e pós-evento

**`apply_dynamic_price_to_proposal`** (atualizar)
- Quando rule ativa, usa `dynamic_pricing_current_amount` como total efetivo

`SECURITY DEFINER` + `SET search_path=public` em todas as RPCs.

---

## 2. Backend TS

- `src/lib/proposals/dynamicPricing.ts`: adicionar
  - `proposalDynamicPricingFactorRuleSchema` (Zod)
  - `eventAntecedencePricingGenerationSchema` (Zod)
  - tipos `PricingMode`, `PostEventPolicy`, `TierStatus` (`expired|current|next|future|post_event`)
  - helper `tierStatusFromDates(starts_at, ends_at, now)`
- `src/services/proposals/proposalDynamicPricing.ts`: adicionar
  - `generateEventAntecedencePricing(proposalId, forceRegenerate?)`
  - `listFactorRules(orgId)` / `upsertFactorRule(payload)` / `setFactorRuleStatus(id, status)`
- `src/hooks/proposals/useProposalDynamicPricing.ts`: novo `useGenerateEventAntecedencePricing` + invalidations
- Novo `src/hooks/proposals/usePricingFactorRules.ts`

---

## 3. Frontend

### 3.1 `ProposalDynamicPricingPanel` (refatorar)
- Se proposta tem `event_start_date` → renderiza modo automático por padrão (sem o comercial precisar ativar):
  - Header: "Modo: automático por antecedência do evento"
  - Cards: Evento começa em / Dias até o evento / Valor base / Valor vigente / Faixa vigente / Próxima virada
  - Tabela read-only: Faixa | Período | Ajuste | Valor | Status (`Expirada`/`Vigente`/`Próxima`/`Futuro`/`Pós evento`)
  - Ações: Recalcular tabela / Aplicar valor vigente / Ver configurações da regra
- Botão "Trocar para modo manual" visível só para admin/owner; preserva editor existente da PRICE 1.0
- Chamada automática a `generate_event_antecedence_pricing_for_proposal` ao abrir/salvar proposta com event_start_date e sem rule auto

### 3.2 Configuração de faixas (admin/owner)
Nova rota em Settings (ex.: `Settings → Propostas → Faixas de Antecedência`) reusando padrão de páginas de settings existentes. CRUD sobre `proposal_dynamic_pricing_factor_rules` (campos: nome, dias min/max, ajuste, label, status).

### 3.3 Link público (`ProposalPublicView` + `PublicProposalDynamicPricingBanner`)
- Header/card principal usa `dynamic_pricing_current_amount` quando `dynamic_pricing_enabled=true`
- Label pequeno: "Valor vigente hoje" (ou "Valor vigente hoje, já com ajuste por antecedência" se ajuste ≠ 0)
- Bloco "Condições de Pagamento" passa a "Condições Financeiras" agregando:
  - Condição Comercial Vigente / Valor vigente hoje / Faixa aplicada / Evento começa em / Valor válido até / Próxima atualização / Tabela de antecedência / Forma de pagamento / Cronograma
- Botão final: **"Aprovar proposta com valor vigente"**
- Botão pagamento (PRICE 1.1): **"Pagar valor vigente"**

### 3.4 PDF (`PdfDynamicPricingSection`)
- Nova seção "Condição Comercial por Antecedência" com colunas: Antecedência | Ajuste | Valor | Status
- Cláusula obrigatória: *"A condição comercial é calculada automaticamente pela antecedência entre a data de pagamento e o primeiro dia do evento. O valor vigente no momento da emissão da cobrança prevalece sobre valores anteriores já expirados."*

---

## 4. Integração PRICE 1.1 (pagamentos)
- `create_proposal_payment_intent`: quando rule ativa (manual ou event_antecedence), `expected_amount = proposals.dynamic_pricing_current_amount`
- Pix, validação manual, cobrança complementar permanecem inalterados (já consomem `expected_amount`)
- Bloquear geração de Pix quando `dynamic_pricing_status='requires_requote'` ou `post_event_policy='block_payment'` e pós-evento

---

## 5. Detalhes técnicos

- Idempotência: rerun de `generate_event_antecedence_pricing_for_proposal` com mesmos `base_amount`+`event_start_date` não recria tiers; só recalcula snapshot
- Soft-update: tiers manuais (`auto_generated=false`) são preservados ao alternar para manual
- Memo cross-tenant: factor rules sempre filtradas por `organization_id` ativa
- Eventos `proposal_dynamic_pricing_events` ganham types: `auto_generated`, `event_date_changed`, `post_event_reached`
- Compat PRICE 1.0: rules existentes ficam com `pricing_mode='manual'` por default (zero quebra)

---

## 6. Arquivos

**Migration (1)**: `supabase/migrations/<ts>_dynamic_pricing_event_antecedence.sql`

**Novos**:
- `src/components/settings/PricingFactorRulesPage.tsx`
- `src/hooks/proposals/usePricingFactorRules.ts`
- `src/components/proposals/AutoAntecedencePricingTable.tsx` (sub-componente read-only)

**Editados**:
- `src/lib/proposals/dynamicPricing.ts`
- `src/services/proposals/proposalDynamicPricing.ts`
- `src/hooks/proposals/useProposalDynamicPricing.ts`
- `src/components/proposals/ProposalDynamicPricingPanel.tsx`
- `src/components/proposals/PublicProposalDynamicPricingBanner.tsx`
- `src/components/proposals/PdfDynamicPricingSection.tsx`
- `src/services/proposals/proposalPaymentsService.ts` (apenas garantir uso de `dynamic_pricing_current_amount`)
- `src/pages/ProposalPublicView.tsx` (label header + botão)
- `src/pages/ProposalEditor.tsx` / `ProposalEditorModal.tsx` (auto-trigger de geração)
- Rotas de Settings para a nova página

---

## 7. Riscos
- Propostas sem `event_start_date` → não geram tabela automática (erro controlado, fallback manual)
- Mudança de `event_start_date` força regeneração (eventos auditados)
- Necessário backfill de seed das factor rules para orgs existentes
- Garantir que `dynamic_pricing_current_amount` é sempre consistente antes de gerar payment intent

## 8. Critérios de aceite
Cobertos os 20 itens do escopo, com typecheck/build verdes e PRICE 1.0/1.1 intactas (rules existentes seguem em `pricing_mode='manual'`).