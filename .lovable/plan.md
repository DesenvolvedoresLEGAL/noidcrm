
# Régua de Qualificação — Plano de Implementação

## Visão geral

Hoje a qualificação comercial está **hardcoded** em `src/lib/qualification/` (score, blockers, classificação, motivos de desqualificação). Funciona para a LEGAL, mas não é configurável.

A proposta é introduzir um **motor configurável multi-tenant** (`qualification_frameworks`) que:

- Substitui gradualmente o cálculo hardcoded sem quebrar Sprints 1–5 já entregues.
- Permite que cada organização configure critérios, pesos, campos, faixas de score, bloqueios, motivos e automações.
- Vem com um **template LEGAL** aplicado automaticamente para organizações que já estão usando a qualificação atual (backfill seguro).

A interface fica em **Configurações > Personalizado > Régua de Qualificação**.

---

## Arquitetura

```text
qualification_frameworks (1) ──┬── qualification_criteria (N)
                               │       └── qualification_criterion_fields (N)
                               ├── qualification_score_ranges (N)
                               ├── qualification_blocking_rules (N)
                               ├── qualification_disqualification_reasons (N)
                               └── qualification_automations (N)
```

Engine TS puro em `src/lib/qualification/engine/` consome o framework + valores da oportunidade e devolve `{ score, range, blockers, missingFields, missingCriteria, recommendation, canAdvance }`. Mesmo formato do `QualificationScoreResult` atual, para não quebrar UI já feita.

---

## Sprints

### Sprint 1 — Schema base + RLS
Migração criando as 6 tabelas acima com `organization_id`, `GRANT` para `authenticated`/`service_role`, RLS por organização, triggers `updated_at`, `created_by`/`updated_by`. Soft-archive (`is_active`). Tabela `qualification_audit_log` para Sprint 11.

### Sprint 2 — Engine configurável + serviços
- `src/services/qualification/frameworksService.ts` (CRUD framework + filhos).
- `src/lib/qualification/engine/computeScore.ts` — versão configurável de `qualificationScore.ts`.
- `src/lib/qualification/engine/resolveFieldValue.ts` — resolve `field_source` (native_opportunity, native_company, native_contact, custom_field, form_field).
- `src/lib/qualification/engine/getRecommendation.ts` — substitui `qualificationRecommendation.ts` lendo critérios pendentes.
- Mantém os arquivos antigos como **fallback** quando a org não tiver framework ativo (zero regressão).
- Hook `useActiveQualificationFramework(pipelineId)` + refactor de `useOpportunityQualificationScore` para preferir o framework configurado.

### Sprint 3 — Settings > Personalizado: shell da página
- Nova rota `/app/settings/custom/qualification` (ou seguir o padrão existente de Personalizado).
- Card na página atual de Personalizado.
- Layout com 8 abas: Visão Geral, Critérios, Campos Obrigatórios, Classificações, Regras de Bloqueio, Motivos de Desqualificação, Automações, Templates.
- Permission gate `SettingsGate requiredLevel="full"` (admin/owner) — Sprint 12.

### Sprint 4 — Aba Visão Geral
KPIs (status, funis origem/destino, score mínimo, contadores), botões Editar / Ativar-Inativar / Duplicar / Aplicar template, timestamp.

### Sprint 5 — Aba Critérios
CRUD com drag-to-reorder, pesos, alerta soft quando soma ≠ 100. Sem bloquear salvar.

### Sprint 6 — Aba Campos Obrigatórios
Form modal por campo: source, field_key (combobox lendo `custom_fields`/nativos/forms), pontos, obrigatório para score, obrigatório para avanço, validation_type, invalid_values (lista). Reuso de mesmo campo em múltiplos critérios.

### Sprint 7 — Aba Classificações
CRUD de faixas com validação (sem overlap, cobertura 0–100), color picker semântico, flags `is_sql` / `is_priority`.

### Sprint 8 — Aba Regras de Bloqueio
CRUD por `action_key` (mover funil/etapa, criar proposta, qualificar, handoff, alterar responsável, gerar contrato). Mensagens custom. Engine de avaliação chamada de `useStageChangeGuard` / handoff.

### Sprint 9 — Aba Motivos de Desqualificação
CRUD com categoria e accountability. **Compatibilidade**: na disqualify modal atual (`DisqualifyLeadModal`), passar a ler desses motivos via service; fallback para `DISQUALIFY_REASONS` se framework vazio.

### Sprint 10 — Aba Automações
Toggles + parâmetros para: ao desqualificar (mover etapa, fechar, duplicar Remarketing, evitar duplicidade, log), ao atingir score (notificar, sugerir handoff), ao ficar abaixo (criar tarefa, alertar gestor). Reaproveita o pipeline atual de remarketing já implementado.

### Sprint 11 — Aba Templates + Template LEGAL
- `src/lib/qualification/templates/legal.ts` — seed completo (critérios, pesos, campos, faixas, bloqueios, motivos, automações conforme spec).
- Card "LEGAL Eventos e Conectividade" com modal de confirmação.
- Edge function / RPC `apply_qualification_template` para criar tudo em uma transação por organização.
- **Migração de bootstrap**: ao rodar Sprint 1, aplicar automaticamente o template LEGAL para organizações que já tenham o `Checklist Obrigatório de Qualificação` ativo — garante zero regressão.

### Sprint 12 — Integração com a oportunidade (refactor)
- `QualificationScoreCard` e `OpportunitySidebar` passam a ler do engine configurável via `useOpportunityQualificationScore` (sem mudar API pública do hook).
- `QualificationGateModal` mostra mensagens do `qualification_blocking_rules` ativo.
- Editor de formulários ganha toggle "Este formulário alimenta uma régua de qualificação" + seletor de framework/critérios.

### Sprint 13 — Auditoria/Histórico
- Estender `timeline-logger.ts` (eventos já existem: `qualification_score_updated`, `sales_handoff_blocked`, `lead_disqualified`) para incluir `framework_id` e `framework_version`.
- Persistir snapshots em `qualification_audit_log` (mudanças de framework) e em `timeline_events` (eventos por oportunidade).

### Sprint 14 — Permissões
- Novas permissões: `qualification_framework.{view,create,update,delete,apply_template,manage_rules}`.
- Mapear para roles existentes via `has_role` / `usePermissions`.
- Sidebar de Configurações esconde o item para perfis não-admin; oportunidade continua mostrando score.

---

## Compatibilidade e não-quebra

- **Sprints 1–5 já entregues continuam funcionando**: o engine antigo permanece como fallback até a org ter `is_active=true` em um framework. UI consome `useOpportunityQualificationScore`, cuja API não muda.
- **Propostas, Vendas, Forecast, OTE, Win/Loss, Revenue Command**: nenhuma alteração. O motor só substitui a fonte de cálculo de qualificação.
- **Campos personalizados e formulários**: nenhum campo é removido. Régua referencia campos por `field_source` + `field_key`.
- **DisqualifyLeadModal / Remarketing**: continuam operando com fallback se framework não tiver motivos cadastrados.
- **Multitenant**: tudo escopado por `organization_id` + RLS.

---

## Riscos

| Risco | Mitigação |
|---|---|
| Divergência entre engine antigo e novo | Engine novo importa as mesmas constantes (`QUALIFICATION_KEYS`) e tem suíte de testes comparando saídas para o template LEGAL |
| Org sem framework após deploy | Migração de bootstrap aplica LEGAL automaticamente em orgs que já usam o checklist |
| Quebra de regras de bloqueio existentes | Bloqueio só ativa se `qualification_blocking_rules.is_active=true`; se vazio, mantém comportamento atual (score≥75 + checklist) |
| Performance no kanban | `useActiveQualificationFramework` com `staleTime: 5min` e dedupe por pipeline |

---

## Entregáveis por sprint

Cada sprint termina com: migration (se houver), código, testes unitários do engine quando aplicável, e atualização de `.lovable/plan.md`. Smoke test manual após Sprint 12.

---

## O que **não** está no escopo

- Editor visual de fórmulas de score (apenas pesos).
- Versionamento histórico de frameworks (Sprint futura — hoje só audit log de mudanças).
- A/B test de réguas.
- Tradução i18n da régua (textos em pt-BR).

Pronto para implementar a partir do Sprint 1?
