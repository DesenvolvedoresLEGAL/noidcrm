
# PRICE AUDIT MAY 2026 — Scope Hardening

Pausar correções. Resolver o problema de escopo: a auditoria está tratando como divergentes propostas que são clones operacionais, versões antigas ou propostas não vencedoras vinculadas ao mesmo cliente/oportunidade. Nenhuma correção será aplicada nesta rodada.

## Achados do diagnóstico

Quatro propostas citadas, todas com `pricing_breakdown_snapshot`:

| Proposta | Conta | Opp Title | Opp Status | Proposal Status | accepted_at | approved_amount |
|---|---|---|---|---|---|---|
| PROP-2026-00717 | Organica Digital | ORGANICA DIGITAL NA PROXXIMA 2026 | won | accepted | 2026-05-14 | 1.313,40 |
| PROP-2026-00732 | Organica Digital | ORGANICA DIGITAL NA PROXXIMA 2026 | new | sent | — | 1.194,00 |
| PROP-2026-00739 | Ntsds Brasil | NETSEEDS NA MEDICAL CANNABIS FAIR 2026 | won | accepted | 2026-05-18 | 1.313,40 |
| PROP-2026-00758 | Ntsds Brasil | NETSEEDS NA MEDICAL CANNABIS FAIR 2026 | new | sent | — | 1.313,40 |

Conclusão: cada par é (sales/won + accepted) e (operacional/clone, sent, sem accept). O usuário trata o clone operacional (00758, 00732) como a "proposta vigente" do ciclo operacional, mas a vencedora contábil é a accepted/won. A auditoria atual entra em ambas e classifica como divergente — precisa segregar escopo.

## Escopo desta rodada

1. Schema: adicionar campos de vínculo/escopo em `proposal_financial_audit_items`.
2. RPC `run_proposal_financial_audit`: ranking por oportunidade + por conta+título + classificação `audit_scope_status`.
3. UI: KPIs e tabela separando escopo vs fora-de-escopo, drawer com evidências de vínculo.
4. Dry-run de maio 2026 e validação dos quatro casos.
5. Nada de `apply_*`, ERP, Pix, banco, provider, total_amount.

## 1. Migração de schema

`ALTER TABLE proposal_financial_audit_items` adicionar:

- `is_winning_proposal boolean DEFAULT false`
- `is_superseded boolean DEFAULT false`
- `is_duplicate_candidate boolean DEFAULT false`
- `is_operational_clone boolean DEFAULT false`
- `proposal_rank_for_opportunity integer`
- `proposal_selection_reason text`
- `source_proposal_id uuid` (lido de `proposals.source_proposal_id` se existir; senão NULL)
- `duplicated_from_proposal_id uuid` (idem `duplicated_from_proposal_id`/`cloned_from_proposal_id`)
- `superseded_by_proposal_id uuid`
- `audit_scope_status text DEFAULT 'in_scope'` com CHECK em: `in_scope`, `out_of_scope_duplicate`, `out_of_scope_superseded`, `out_of_scope_draft`, `out_of_scope_old_version`, `out_of_scope_non_winning`, `needs_scope_review`
- Índice em `(audit_run_id, audit_scope_status)`

Adicionar em `proposal_financial_audit_runs`:

- `in_scope_count integer DEFAULT 0`
- `out_of_scope_count integer DEFAULT 0`
- `needs_scope_review_count integer DEFAULT 0`
- `out_of_scope_delta numeric(14,2) DEFAULT 0`
- `in_scope_delta numeric(14,2) DEFAULT 0` (= `total_detected_delta` apenas dos in_scope)

A migração detecta colunas opcionais (`source_proposal_id`, `duplicated_from_proposal_id`, `superseded_by_proposal_id`) em `proposals` via `information_schema` antes de referenciá-las, para não quebrar se ainda não existirem.

## 2. RPC `run_proposal_financial_audit` (v3)

Mantém a v2 (regra de desconto manual aplicada à canonical) e adiciona, antes da escrita do item:

**a. Coleta de evidências de fechamento** por proposta candidata:

```text
has_accept = (status IN ('accepted','approved','won') OR accepted_at IS NOT NULL)
has_snapshot = approval_snapshot IS NOT NULL AND approval_snapshot::text <> '{}'
has_approved_amount = approved_amount IS NOT NULL
has_payment_intent = EXISTS payment_intent linked
has_erp_sync = EXISTS erp_billing linked
opp_is_won = opportunity.status IN ('won','ganha','closed_won')
```

**b. Ranking por oportunidade** (`window function ROW_NUMBER() OVER (PARTITION BY opportunity_id ORDER BY ...)`):

Score (maior vence):
1. has_accept → +1000
2. opp_is_won AND has_accept → +500
3. has_snapshot → +100
4. has_approved_amount → +50
5. has_payment_intent OR has_erp_sync → +30
6. mais recente por `accepted_at`, senão `sent_at`, senão `created_at` → desempate

`is_winning_proposal = (rank = 1 AND score >= 100)`. Sem evidência mínima (score < 100) → todas da opp ficam `needs_scope_review`.

**c. Classificação `audit_scope_status`**:

- `status IN ('draft')` → `out_of_scope_draft`
- `superseded_by_proposal_id IS NOT NULL` (quando coluna existe) → `out_of_scope_superseded`
- `duplicated_from_proposal_id IS NOT NULL` AND outra mais nova com `has_accept` → `out_of_scope_duplicate`
- não vencedora da opp (rank > 1) com vencedora `has_accept` → `out_of_scope_non_winning`
- não vencedora da opp, mais antiga, sem evidência → `out_of_scope_old_version`
- vencedora ou única → `in_scope`
- sem evidência alguma na opp → `needs_scope_review`

**d. Detecção de clone operacional** (caso NETSEEDS/ORGÂNICA): segundo passo de ranking por `(account_id, normalize(opportunity.title))`. Quando há duas opportunities ativas com mesmo cliente+título e uma é `won` (accepted) e a outra `new` (sem accept) com proposta `sent`, a `sent` recebe `is_operational_clone = true` e `audit_scope_status = needs_scope_review` (não bloqueia, mas tira do balde de divergência financeira). `proposal_selection_reason` registra o motivo textual ("clone operacional do ciclo onboarding").

**e. Totais do run**: `in_scope_*`, `out_of_scope_*`, `needs_scope_review_*` recomputados ao final. `total_detected_delta` permanece como soma geral; `in_scope_delta` é o número que a UI usa por padrão.

## 3. Service e hook (frontend)

- `proposalFinancialAuditService.ts`: estender `AuditItem` com os novos campos; `AuditItemFilters` ganha `scopeStatus?: AuditScopeStatus | 'all_in_scope'` (default = in_scope + needs_scope_review).
- `listAuditItems`: filtro padrão `audit_scope_status IN ('in_scope','needs_scope_review')`.
- `useAuditRuns`/`useAuditItems`: sem mudança de assinatura externa.

## 4. UI — `PriceAuditPage.tsx`

KPIs (cards), separados:
- Total auditado
- In scope
- Fora de escopo
- Needs scope review
- Divergências reais (= in_scope com `max_delta > 0.01`)
- Delta in_scope (R$)
- Delta fora de escopo (R$) — card secundário/cinza

Tabela:
- Nova coluna **Escopo** (badge): In scope / Duplicada / Substituída / Versão antiga / Não vencedora / Rascunho / Revisar escopo
- Toggle "Mostrar fora de escopo" (default off)
- Filtro de status financeiro só conta in_scope

Drawer da proposta — nova seção "Vínculo & Escopo":
- opportunity_id, opp title, opp status
- proposal status, created_at, sent_at, accepted_at
- has_snapshot, has_approved_amount, has_payment_intent, has_erp_sync
- source_proposal_id / duplicated_from_proposal_id / superseded_by_proposal_id (links)
- rank_for_opportunity, is_winning_proposal, is_operational_clone
- proposal_selection_reason

Botões `Apply` ficam desabilitados quando `audit_scope_status != 'in_scope'`, com tooltip "Fora de escopo — revisar vínculo antes de corrigir".

## 5. Dry-run de validação

Rodar `run_proposal_financial_audit(2026-05-01, 2026-05-31, dry_run=true)` e validar:

- PROP-2026-00717 (Organica, opp won, accepted) → `is_winning_proposal=true`, `in_scope`
- PROP-2026-00732 (Organica, opp new, sent) → `is_operational_clone=true`, `needs_scope_review`
- PROP-2026-00739 (Netseeds, opp won, accepted) → `is_winning_proposal=true`, `in_scope`
- PROP-2026-00758 (Netseeds, opp new, sent) → `is_operational_clone=true`, `needs_scope_review`
- PROP-2026-00755 (OGGI) → continua `divergent`/`needs_review` com a regra do desconto manual

Nenhum `apply_*` será executado. Nenhuma alteração em proposta, oportunidade, forecast, comissão, Slack, ERP, Pix ou provider.

## 6. Garantias

- Typecheck + build obrigatórios após mudanças de tipos.
- Mantém compatibilidade com itens já gravados: defaults preenchem `in_scope` para linhas antigas; a UI continua exibindo runs anteriores sem quebrar.
- Sem mudanças em `total_amount`, ERP, Pix, provider, Slack.

## Arquivos impactados

- `supabase/migrations/<novo>_price_audit_scope_hardening.sql` (schema + RPC v3)
- `src/services/proposals/proposalFinancialAuditService.ts` (tipos e filtros)
- `src/hooks/proposals/useProposalFinancialAudit.ts` (passar filtro de escopo)
- `src/pages/settings/system/PriceAuditPage.tsx` (KPIs, coluna Escopo, toggle, drawer)
- `src/integrations/supabase/types.ts` (regenerado pela migração)

## Riscos

- Detecção de "clone operacional" depende de igualdade normalizada do título da opp; falsos positivos possíveis em títulos idênticos legítimos — por isso cai em `needs_scope_review`, nunca em `out_of_scope` duro.
- Colunas `source_proposal_id`/`duplicated_from_proposal_id`/`superseded_by_proposal_id` podem não existir em todos os ambientes; RPC usa detecção dinâmica para não falhar.

## Fora de escopo

Provider financeiro, Pix público, ERP real, baixa financeira, mock de pagamento, qualquer `apply_proposal_financial_audit_item`.
