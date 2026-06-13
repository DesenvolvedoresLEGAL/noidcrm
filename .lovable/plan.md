# Régua de Qualificação — Plano de Implementação (status)

## Sprint 1 — Schema base + RLS — ✅ ENTREGUE
Tabelas criadas com RLS por `organization_id`, GRANTs, triggers `updated_at`:
- `qualification_frameworks`
- `qualification_criteria`
- `qualification_criterion_fields`
- `qualification_score_ranges`
- `qualification_blocking_rules`
- `qualification_disqualification_reasons`
- `qualification_automations`
- `qualification_framework_audit_log`

## Sprint 2 — Tipos + Service + Hooks — ✅ ENTREGUE
- `src/types/qualification.ts`
- `src/services/qualification/frameworksService.ts` (listFrameworks, getActiveFramework, getFrameworkBundle, applyLegalTemplate, update helpers)
- `src/hooks/useQualificationFramework.ts`

## Sprint 3 — Página em Configurações > Personalizado — ✅ ENTREGUE
- Card "Régua de Qualificação" adicionado em `SettingsPageV3.tsx` (categoria Personalizado, `requiredLevel: 'full'`)
- Rota `/app/settings/qualification` em `App.tsx`
- Breadcrumb em `SettingsLayout.tsx`
- Permission gate via `<SettingsGate requiredLevel="full">`
- 8 abas implementadas: Visão Geral, Critérios, Campos Obrigatórios, Classificações, Regras de Bloqueio, Motivos de Desqualificação, Automações, Templates

## Sprint 4 — Aba Visão Geral — ✅ ENTREGUE
KPIs, edição inline de nome/descrição/score mínimo, botões Editar/Ativar-Inativar/Aplicar Template.

## Sprint 5 — Aba Critérios — ✅ MVP
Edição de peso (onBlur) e toggle de ativo. Alerta soft quando soma ≠ 100. Reordenar drag-and-drop fica para iteração futura.

## Sprint 6 — Aba Campos Obrigatórios — ✅ MVP (leitura)
Lista agrupada por critério com pontos, flags de score/avanço e valores inválidos. Edição CRUD completa fica para iteração futura.

## Sprint 7 — Aba Classificações — ✅ MVP (leitura)
Lista das faixas com flags SQL/Prioridade. Edição CRUD fica para iteração futura.

## Sprint 8 — Aba Regras de Bloqueio — ✅ MVP
Lista com toggle ativo/inativo por regra; CRUD completo (criar/editar) fica para iteração futura.

## Sprint 9 — Aba Motivos de Desqualificação — ✅ MVP
Lista com toggles de remarketing-default e ativo. Edição/criação CRUD fica para iteração futura.

## Sprint 10 — Aba Automações — ✅ MVP
Lista com toggle ativo/inativo. Editor visual de config fica para iteração futura.

## Sprint 11 — Template LEGAL — ✅ ENTREGUE
- RPC `apply_qualification_template_legal()` (SECURITY DEFINER) cria/substitui régua LEGAL completa para a organização do usuário
- Card "LEGAL Eventos e Conectividade" na aba Templates com modal de confirmação
- Template seeded:
  - 7 critérios somando 100 pontos
  - 14 campos (com opções, pontos por valor, valores inválidos)
  - 5 faixas de classificação
  - 1 regra de bloqueio Pré-vendas → Vendas (score 75, checklist completo, permissão válida)
  - 19 motivos de desqualificação categorizados
  - 1 automação `on_disqualify` com config para Remarketing
- Régua nasce **inativa** — sem risco para Sprints 1–5 existentes (fallback ativo)

## Sprint 12 — Integração com a oportunidade — ⏸ DIFERIDO
Mantido o engine atual (`useOpportunityQualificationScore` + `qualificationScore.ts`). Integração configurável fica para iteração futura conforme combinado (não quebrar Sprints 1–5).

## Sprint 13 — Auditoria — ⏸ DIFERIDO (tabela existe)
`qualification_framework_audit_log` criada. Hooks de log nas mutations CRUD ficam para iteração futura.

## Sprint 14 — Permissões — ✅ ENTREGUE (via SettingsGate)
Acesso à página exige `requiredLevel: 'full'` (owner/admin). Demais perfis seguem vendo o score na oportunidade normalmente.

## Compatibilidade verificada
- Nada alterado em Propostas, Forecast, OTE, Win/Loss, Revenue Command
- `DisqualifyLeadModal`, engine de score atual e Remarketing inalterados
- Régua nasce inativa por org — engine antigo continua decisor único
- Multitenant: tudo escopado por `organization_id` + RLS
