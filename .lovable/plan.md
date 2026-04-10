

# Sprint 1.2 — Simulador + Dry Run + Validação Assistida

## Resumo

Construir o Simulation Studio do NOID Intelligence: uma área dedicada onde o usuário pode testar agentes em ambiente seguro, visualizar deliberação e plano de tools, rodar dry runs sem efeitos reais, receber validação assistida com scoring, e manter histórico de simulações com feedback.

## Arquitetura

```text
┌──────────────────────────────────────────────────┐
│           AgentSimulatorPage.tsx                  │
│  ┌────────────┬──────────────────────────────┐   │
│  │ Scenario   │   Results Panel              │   │
│  │ Selector   │  ┌─────────────────────────┐ │   │
│  │            │  │ Context | Deliberation  │ │   │
│  │ Mode       │  │ Tools   | Output        │ │   │
│  │ Selector   │  │ Validation | Timeline   │ │   │
│  │            │  └─────────────────────────┘ │   │
│  │ [Simular]  │                              │   │
│  └────────────┴──────────────────────────────┘   │
│                      │                           │
│                      ▼                           │
│         run-agent-simulation (edge fn)           │
│         └─ Lovable AI (deliberation)             │
│         └─ validate + score                      │
│         └─ persist run + report                  │
└──────────────────────────────────────────────────┘
```

---

## 1. Database — Migration

4 novas tabelas com RLS por `organization_id`:

- **`ai_agent_simulation_runs`** — registra cada simulação com payloads de contexto, deliberação, tool plan, output, validação, tokens, custo, duração
- **`ai_agent_test_scenarios`** — cenários reutilizáveis (sintéticos, snapshot real, payload manual)
- **`ai_agent_validation_reports`** — relatórios consolidados com score (0-100), status (passed/review_required/blocked), issues e recomendações
- **`ai_agent_simulation_feedback`** — rating (1-5) e notas humanas por simulação

FKs para `ai_agents`, `ai_agent_versions`, `profiles`. Índices por agent, version, workspace, status, created_at.

Seed de ~8 cenários template (proposta visualizada, oportunidade parada, atividade vencida, conta VIP, etc.).

## 2. Edge Function: `run-agent-simulation`

Função principal — recebe agent_id, version_id, scenario e execution_mode.

Pipeline interno:
1. **Pre-check** — versão existe, builder minimamente configurado
2. **Context build** — monta contexto a partir do cenário (sintético ou real)
3. **Deliberation** — chama Lovable AI (`google/gemini-2.5-flash`) com system+deliberation prompts + contexto, retorna decisão estruturada (objetivo, hipótese, confiança, risco, ação sugerida)
4. **Tool planning** — seleciona tools do arsenal, monta payloads, aplica guardrails
5. **Output preview** — gera output final via generation prompt (email draft, nota, etc.)
6. **Review** — aplica review prompt para auto-avaliação
7. **Validation assisted** — scoring em 5 dimensões (config 20%, coerência 25%, segurança 25%, qualidade output 20%, completude 10%), classificação final
8. **Persist** — salva `ai_agent_simulation_runs` + `ai_agent_validation_reports` + auditoria

Dry run: nenhum side effect real. Todo output é preview.

## 3. Edge Functions auxiliares

- **`save-test-scenario`** — CRUD de cenários reutilizáveis
- **`submit-simulation-feedback`** — salva rating + notas
- **`list-simulation-history`** — histórico paginado por agent/version

## 4. Types (ai-agents.ts)

Adicionar:
- `SimulationExecutionMode`, `SimulationRunStatus`, `ValidationOverallStatus`
- `AgentSimulationRun`, `AgentTestScenario`, `AgentValidationReport`, `AgentSimulationFeedback`
- Labels e colors para os novos status

## 5. Service + Hooks

- `simulatorService.ts` — funções para invocar edge functions
- `useAgentSimulator.ts` — `useRunSimulation()`, `useSimulationHistory()`, `useTestScenarios()`, `useSaveScenario()`, `useSubmitFeedback()`

## 6. Frontend — Simulation Studio

### Rota: `/app/settings/noid-intelligence/agents/:id/simulator`

**Layout em 2 colunas:**

**Coluna esquerda — Configuração:**
- Seleção de cenário (templates, salvos, manual)
- Modo de execução (preview_only, dry_run, guarded_test desabilitado)
- Botão "Simular"
- Histórico de runs recentes

**Coluna direita — Resultados (6 abas):**
1. **Contexto** — entidades, fontes, memória, sinais, campos ausentes
2. **Deliberação** — objetivo inferido, hipóteses, risco, confiança, ação sugerida, raciocínio
3. **Plano de Tools** — tools selecionadas, payloads, quais bloqueadas/aprovação
4. **Preview de Saída** — email gerado, nota, próximo passo, formato humano + JSON
5. **Validação** — score, status, bloqueios, warnings, recomendações, checklist
6. **Timeline** — etapas com duração, tokens, custo estimado

**Badge de segurança:** "Nenhuma ação real será executada" em dry_run.

**Feedback:** Modal de rating (1-5) + notas após cada simulação.

### Componentes:
- `AgentSimulatorPage.tsx` (página principal)
- `SimulationScenarioPanel.tsx` (seleção de cenário + modo)
- `SimulationResultsPanel.tsx` (abas de resultado)
- `SimulationFeedbackModal.tsx` (rating + notas)
- `SimulationHistoryList.tsx` (histórico)

### Integração com Builder:
- Botão "Simular" no header do AgentBuilderPage
- Na aba Resumo: últimas simulações, último score, data

## 7. Routing (App.tsx)

Adicionar rota lazy:
```
/app/settings/noid-intelligence/agents/:id/simulator → AgentSimulatorPage
```

---

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migration | 4 tabelas + RLS + seeds de cenários |
| Create | `supabase/functions/run-agent-simulation/index.ts` |
| Create | `supabase/functions/save-test-scenario/index.ts` |
| Create | `supabase/functions/submit-simulation-feedback/index.ts` |
| Create | `src/pages/settings/noid-intelligence/AgentSimulatorPage.tsx` |
| Create | `src/components/noid-intelligence/simulator/SimulationScenarioPanel.tsx` |
| Create | `src/components/noid-intelligence/simulator/SimulationResultsPanel.tsx` |
| Create | `src/components/noid-intelligence/simulator/SimulationFeedbackModal.tsx` |
| Create | `src/components/noid-intelligence/simulator/SimulationHistoryList.tsx` |
| Create | `src/services/ai-agents/simulatorService.ts` |
| Create | `src/hooks/useAgentSimulator.ts` |
| Edit | `src/types/ai-agents.ts` — novos tipos de simulação |
| Edit | `src/App.tsx` — rota do simulador |
| Edit | `src/pages/settings/noid-intelligence/AgentBuilderPage.tsx` — botão simular |
| Edit | `src/components/noid-intelligence/builder/BuilderSummaryTab.tsx` — últimas simulações |

