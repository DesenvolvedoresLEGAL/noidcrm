## P0 Hotfix — Bloquear bypass de qualificação PRÉ VENDAS → VENDAS

### Diagnóstico
O gate `validateQualificationGate` existe (via `useQualificationFramework` / `qualification_frameworks` + `qualification_blocking_rules`), mas é aplicado em pontos isolados. O bypass ocorre porque:
- Drag-and-drop no Kanban e mudança de etapa no header da oportunidade não chamam o gate consistentemente.
- A função de Passagem de Bastão (handoff/duplicate para VENDAS) valida apenas estado visual.
- Custom form values do checklist não são clonados nem expostos como read-only no funil VENDAS.

### Escopo de arquivos (exploração antes de editar)
- `src/services/qualification/frameworksService.ts`, `src/hooks/useQualificationFramework.ts`, `src/hooks/useOpportunityQualificationScore.ts`, `src/lib/qualification/*`
- `src/services/crm/opportunities.ts` (updateOpportunity / stage moves)
- `src/components/KanbanColumn.tsx` + Kanban DnD handler
- `src/components/opportunity/OpportunityDetailModal.tsx` (stage picker, botão Qualificar, aba Formulários, bloco lateral)
- Serviços/edge functions de handoff/duplicate (procurar `handoff`, `duplicate-opportunity`, `passagem`)
- `custom_form_values` / `custom_forms` scoping por pipeline

### Implementação

**1. Gate único (`src/lib/qualification/gate.ts` novo)**
- Função `validateQualificationGate({ opportunityId, targetStageId, targetPipelineId, action })` que retorna `{ ok, blockers[], score, classification, pendingFields[], pendingCriteria[] }`.
- Reusa framework ativo + score + checklist + blocking_rules.
- Edge identifica stages "qualificado/handoff" via `stages.is_qualified_stage` ou key match.

**2. Aplicar gate em todos os pontos (P0.8)**
- `services/crm/opportunities.ts → updateOpportunity`: se mudança de stage atinge stage qualificado/handoff → chamar gate; rejeitar com erro tipado `QUALIFICATION_GATE_BLOCKED` contendo payload.
- Kanban DnD (`KanbanColumn` + parent): no catch do erro, reverter card e abrir `QualificationGateModal`.
- `OpportunityDetailModal` stage picker e botão Qualificar: idem.
- Server-side: trigger DB em `opportunities` que bloqueia UPDATE para stage qualified/handoff_status quando `crm_validate_qualification_gate(opportunity_id)` retorna false. Garante que nenhuma RPC/edge function escape.

**3. Passagem de Bastão (P0.2)**
- Localizar serviço/edge `handoff` ou `duplicate-opportunity-to-sales`. Adicionar primeira etapa: `validateQualificationGate`. Se falhar, abortar antes de qualquer INSERT.
- Mesma validação replicada em RPC server-side (`crm_handoff_to_sales`) com SECURITY DEFINER + check.

**4. Checklist em VENDAS — Opção A + clonagem leve (P0.4)**
- Ao criar oportunidade VENDAS no handoff: copiar `custom_form_values` do PRÉ VENDAS para a nova `opportunity_id`, marcando `source_opportunity_id` e `is_readonly_handoff = true` (nova coluna).
- Ajustar query da aba Formulários para incluir esses values e renderizar o formulário em modo read-only quando `is_readonly_handoff`.
- Form escopado a PRÉ VENDAS continua escopado; renderização em VENDAS usa os values clonados.

**5. Bloco "Resumo da Qualificação" em VENDAS (P0.5)**
- Componente `QualificationSummaryCard` no detalhe da oportunidade, visível quando `source_opportunity_id` existe ou quando há values clonados. Lê os campos canônicos (evento, data, local, conexões, equipamentos, etc.) do checklist clonado + score/classificação herdados.

**6. Marcação de oportunidades já criadas indevidamente (P0.6)**
- Migration: query `opportunities` em pipeline VENDAS com `source_opportunity_id` apontando para PRÉ VENDAS sem checklist completo → setar `handoff_status='qualification_missing'`.
- UI: alerta no topo do detalhe quando `handoff_status='qualification_missing'`, com botão admin "Reverter para Pré-vendas".

**7. Auditoria (P0.7)**
- Tabela `qualification_framework_audit_log` já existe. Inserir eventos:
  - `qualification_gate_blocked` (no catch do gate, server-side).
  - `handoff_approved` (no sucesso da passagem).
  - `checklist_transferred` (na clonagem dos values).

### Migrations (DB)
1. `stages.is_qualified_stage boolean default false` — flag explícito (popular via heurística de nome).
2. `custom_form_values.source_opportunity_id uuid`, `custom_form_values.is_readonly_handoff boolean default false`.
3. `opportunities.handoff_status` (se não existir): enum/text com `pending|approved|qualification_missing`.
4. Função `public.crm_validate_qualification_gate(_opportunity_id uuid, _target_stage_id uuid)` SECURITY DEFINER, `search_path=public`, retorna jsonb com `{ok, blockers, score, ...}`.
5. RPC `public.crm_handoff_to_sales(_opportunity_id uuid)` que: valida gate, cria opp em VENDAS, clona custom_form_values, registra auditoria. Atômica.
6. Trigger `trg_opportunities_qualification_gate` BEFORE UPDATE em `opportunities`: se nova stage tem `is_qualified_stage=true` ou `handoff_status` mudou para approved, exigir gate ok.
7. Backfill `handoff_status='qualification_missing'` em VENDAS sem checklist completo.
8. GRANTs apropriados.

### Critérios de aceite (mapeados)
1–7: trigger DB + gate client; 8–10: clonagem + read-only + Resumo; 11: auditoria; 12: nenhum módulo de receita/forecast alterado (somente add-only).

### Riscos
- Trigger DB pode bloquear automações legítimas existentes — mitigar com bypass para `service_role` em workflows controlados auditados (ex.: workflow rules que já passaram pelo gate).
- Clonagem de form_values precisa idempotência para reexecução da passagem.
- Stage detection: usar flag `is_qualified_stage` + fallback por nome/key para evitar falso positivo.

### Próximos passos
Confirmar o plano e seguir com migrations + edits. Não vou tocar Forecast/OTE/Win-Loss/Proposals/Revenue Command.