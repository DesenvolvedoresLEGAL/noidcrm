# Sprint TEMPLATE 1.0 — Regras Comerciais nos Templates de Proposta

## Resumo

Evoluir `proposal_templates` para definir o comportamento comercial das propostas geradas a partir dele (tipo de receita, tabela dinâmica automática, validade, recorrência, exibição pública/PDF). Atualizar UI de edição, badges no card e o fluxo de criação de proposta.

## Banco (1 migração)

### `proposal_templates` — novas colunas
- `revenue_type text` — CHECK em (`one_time_event`, `one_time_non_event`, `recurring`, `short_subscription`, `subscription_with_commitment`, `service`)
- `dynamic_pricing_applicability text NOT NULL DEFAULT 'none'` — CHECK em (`automatic`, `optional`, `none`)
- `dynamic_pricing_mode text NOT NULL DEFAULT 'none'` — CHECK em (`none`, `automatic_by_valid_until`, `manual`)
- `validity_strategy text NOT NULL DEFAULT 'fixed_days_from_creation'` — CHECK em (`fixed_days_from_creation`, `proposal_valid_until`, `manual`, `event_start_date`)
- `default_validity_days integer`
- `requires_valid_until boolean NOT NULL DEFAULT false`
- `allow_recurring boolean NOT NULL DEFAULT false`
- `default_payment_mode text NOT NULL DEFAULT 'one_time'` — CHECK em (`one_time`, `recurring`, `installment`, `mixed`)
- `show_dynamic_pricing_on_public_link boolean NOT NULL DEFAULT false`
- `show_dynamic_pricing_on_pdf boolean NOT NULL DEFAULT false`
- `allow_pix_payment boolean NOT NULL DEFAULT true`
- `allow_complementary_charge boolean NOT NULL DEFAULT true`
- `template_commercial_rules jsonb NOT NULL DEFAULT '{}'::jsonb`

### `proposals` — novas colunas (espelho aplicado a partir do template)
- `revenue_type text`
- `dynamic_pricing_applicability text DEFAULT 'none'`
- `validity_strategy text`
- `payment_mode text`

(`dynamic_pricing_mode` já existe via `proposal_dynamic_pricing_rules.pricing_mode`; mantemos ali, sem duplicar.)

### Backfill
- UPDATE no template `1ª ALUGUE` (todas as orgs com esse nome) para a configuração de evento dinâmico.
- Função `seed_recommended_proposal_templates(org_id)` que insere `ALUGUE Evento`, `ASSINATURA Recorrente`, `ASSINATURA Curta Sem Fidelidade` se não existirem (idempotente por nome+org).
- Loop de backfill que chama a função para cada organização existente.
- Trigger `AFTER INSERT ON organizations` chamando a mesma função para futuras orgs.

## Backend TS

### `src/lib/proposals/proposalTemplateRules.ts` (novo)
- Constantes: `REVENUE_TYPES`, `DYNAMIC_PRICING_APPLICABILITIES`, `DYNAMIC_PRICING_MODES`, `VALIDITY_STRATEGIES`, `PAYMENT_MODES` + `LABELS`.
- `proposalTemplateCommercialRulesSchema` (Zod) com refinement: `requires_valid_until=true` ⇒ `validity_strategy ∈ {proposal_valid_until, event_start_date}`.
- Helper `templateBadges(template)` retornando `{label, variant}[]` para os 4 badges (Avulso Evento, Tabela dinâmica automática, Recorrente, Sem tabela dinâmica).

### `src/services/supabase/proposal-templates.ts`
- Estender interface `ProposalTemplate` com os campos novos.
- `applyTemplate`: ao popular a proposta, copiar `revenue_type`, `dynamic_pricing_applicability`, `validity_strategy`, `payment_mode`, e definir `valid_until` conforme `validity_strategy` + `default_validity_days`. Se `dynamic_pricing_applicability='automatic'` e `valid_until` presente, disparar `generate_event_antecedence_pricing_for_proposal`.

## Frontend

### `src/pages/settings/ProposalTemplateEditor.tsx`
- Nova seção **"Regras Comerciais do Template"** com os 12 campos do escopo (selects + switches + input numérico).
- Validação com `proposalTemplateCommercialRulesSchema`.
- Auto-coerência: ao trocar `revenue_type` para `recurring/short_subscription`, sugerir `dynamic_pricing_applicability='none'` e `allow_recurring=true`.

### `src/components/proposals/ProposalTemplatesManager.tsx`
- Card mostra badges discretos via `templateBadges()`.

### `src/components/proposals/ProposalEditorModal.tsx` (e/ou `ProposalEditor.tsx`)
- Ao aplicar template: copiar regras para a proposta (mostrar resumo).
- Se `requires_valid_until=true` e `proposal.valid_until` vazio: bloquear save com mensagem *"Este template exige validade da proposta para calcular a condição comercial."*
- Se `dynamic_pricing_applicability='none'`: ocultar `ProposalDynamicPricingPanel` e exibir aviso *"Tabela dinâmica não aplicável para este template."*
- Se `dynamic_pricing_applicability='automatic'`: chamar `useGenerateEventAntecedencePricing` automaticamente após save da proposta com `valid_until` presente.

## Arquivos impactados

- `supabase/migrations/<ts>_template_commercial_rules.sql` (novo)
- `src/lib/proposals/proposalTemplateRules.ts` (novo)
- `src/services/supabase/proposal-templates.ts` (editar interface + applyTemplate)
- `src/services/crm/proposal-templates.ts` (re-export dos novos tipos)
- `src/pages/settings/ProposalTemplateEditor.tsx` (nova seção)
- `src/components/proposals/ProposalTemplatesManager.tsx` (badges)
- `src/components/proposals/ProposalEditorModal.tsx` (aplicar regras + validação)
- `src/integrations/supabase/types.ts` (auto, pós-migração)

## Critérios de aceite cobertos

1–10 ✅ via migração + UI + applyTemplate. 11–12 ✅ via tipagem coerente (CHECKs + Zod + types.ts regenerado).

## Riscos

- Templates pré-existentes com `revenue_type IS NULL` ⇒ tratado como "sem regra"; UI mostra placeholder e não bloqueia.
- Trigger em `organizations` já tem outros seeds — adicionar com nome único pra não conflitar.
- `proposals.payment_mode` poderia colidir com lógica MRR existente — usar campo novo e não tocar nos atuais.
- Geração automática de tabela dinâmica só dispara se `valid_until` está definido após save (evita race com `event_start_date` ausente).
