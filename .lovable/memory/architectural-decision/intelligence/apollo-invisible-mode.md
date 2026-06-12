---
name: Apollo Invisible Mode
description: KAI.15 — Apollo é provider interno do Kairós, não ação manual. Regras + auditoria + ROI.
type: architectural-decision
---

KAI.15: Apollo deixa de ser botão e passa a ser camada invisível acionada
pelo Autopilot e fluxos do Kairós.

- Decisão centralizada em `fn_apollo_should_run(prospect_id, org)` +
  configuração em `apollo_auto_enrichment_rules` (1 linha/org).
- Regras default: enabled=true, minimum_priority_score=180, required_domain,
  allowed_relationship_status=`{new_prospect}`, max_contacts/company=3,
  max_credits/day=500, max_credits/batch=200, auto_select_primary=true,
  auto_reveal=true.
- Edge `kairos-apollo-invisible` executa enrich + reveal, calcula
  Contact Score (email 30 + phone 20 + seniority 20 + linkedin 15 + ICP role 15),
  marca primary, grava `apollo_enrichment_audit` e atualiza
  `kairos_qualified_queue` (`apollo_status`, `contacts_found`,
  `primary_contact_*`).
- Edge `kairos-apollo-estimate` faz dry-run (eligibility + créditos
  estimados vs limite diário/batch).
- `kairos-autopilot-process` chama `kairos-apollo-invisible` no estágio
  `apollo` em vez de `run-apollo-enrichment` direto.
- Departamentos por ICP em `supabase/functions/_shared/apollo-icp-departments.ts`
  (AGÊNCIAS/ORGANIZADORES/MONTADORAS/PATROCINADORES/EXPOSITORES). Fallback
  EXPOSITORES. Cargos ignorados: estagiário/assistente/junior.
- Eventos `system_events`: apollo_enrichment_started/completed/skipped,
  decision_maker_found, contact_revealed.
- UI: `ApolloInvisibleSettingsCard` + `ApolloKpiBar` na aba Autopilot,
  página `/app/intelligence/apollo-roi`.
- Garantias: nunca cria opportunity/account/contact CRM, nunca dispara
  email/WhatsApp. Saída exclusiva = Qualified Queue + audit.
