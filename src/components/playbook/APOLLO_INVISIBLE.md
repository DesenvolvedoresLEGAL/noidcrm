# Apollo Invisible Mode — KAI.15

Apollo deixou de ser uma ação operacional clicada pelo usuário. Passa a ser
um provider interno do Kairós, acionado automaticamente pelo Autopilot e
pelos fluxos de qualificação.

## Princípio

O usuário não escolhe quando rodar Apollo. O Kairós decide.

Critério canônico (`fn_apollo_should_run` + `apollo_auto_enrichment_rules`):

1. `enabled = true`
2. `relationship_status ∈ allowed_relationship_status` (default `new_prospect`)
3. `priority_score ≥ minimum_priority_score` (default 180)
4. `quality_label ∈ allowed_quality_labels` (default `high_confidence|usable`)
5. `domain IS NOT NULL` quando `required_domain = true`
6. `decision_maker_status NOT IN ('found','revealed')`
7. `fn_apollo_credits_used_today < max_apollo_credits_per_day`
8. Em lote: créditos usados no batch `< max_apollo_credits_per_batch`

Qualquer falha → `apollo_enrichment_audit.apollo_status = 'skipped'` com `skip_reason`.

## Departamentos por ICP

Mapa em `supabase/functions/_shared/apollo-icp-departments.ts`. Usado para
priorizar a busca de cargos relevantes:

| ICP            | Departamentos                                  |
|----------------|------------------------------------------------|
| AGÊNCIAS       | Marketing, Eventos, Operações, Compras         |
| ORGANIZADORES  | Eventos, Operações, Compras                    |
| MONTADORAS     | Operações, Compras, Projetos                   |
| PATROCINADORES | Marketing, Trade Marketing, Eventos            |
| EXPOSITORES    | Marketing, Eventos, Trade, Compras (fallback)  |

Cargos ignorados: Estagiário, Assistente, Analista Júnior.

## Contact Score

`computeContactScore`:

- email válido: +30
- telefone: +20
- senioridade (Head/Director/Manager): +20 (intermediário: +10)
- LinkedIn: +15
- cargo combinando ICP departments: +15

Maior score recebe `is_primary = true` automaticamente quando
`auto_select_primary_contact = true`.

## Edge functions

- `kairos-apollo-invisible` — núcleo. Recebe `prospect_id` + `batch_run_id?`.
  Executa elegibilidade, enriquece via `run-apollo-enrichment`, revela com
  `reveal-apollo-contact` (até `max_contacts_per_company`), grava
  `apollo_enrichment_audit`, atualiza `kairos_qualified_queue`
  (`apollo_status`, `contacts_found`, `primary_contact_*`).
- `kairos-apollo-estimate` — dry-run de elegibilidade para um lote.
- `kairos-autopilot-process` — no estágio `apollo` chama
  `kairos-apollo-invisible` em vez do enrichment direto.

## Auditoria & eventos

- `apollo_enrichment_audit` — uma linha por execução ou skip.
- `system_events`: `apollo_enrichment_started`, `apollo_enrichment_completed`,
  `apollo_skipped`, `decision_maker_found`, `contact_revealed`.
- Página `Apollo ROI` (`/intelligence/apollo-roi`) com KPIs (custo/decisor,
  taxa de aproveitamento, ROI) e tabela das últimas execuções.

## Garantias

Apollo **NUNCA**:

- cria oportunidade, conta ou contato no CRM
- importa o prospect
- dispara e-mail ou WhatsApp

Saída exclusiva: atualização da Qualified Queue + `apollo_enrichment_audit`.
Promoção ao CRM permanece manual via `kairos-promote-to-crm` (KAI.13).
