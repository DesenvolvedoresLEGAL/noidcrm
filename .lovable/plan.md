

## Reestruturação Completa da Página de Playbooks

### Resumo
Transformar a página de Playbooks de um board estático para um **sistema executável** com 3 tabs: Estratégia (playbooks atuais melhorados), Execução (Lead Sourcing Engine / "Caramelo"), e Performance (métricas de ROI e conversão).

### O que muda

**Header** atualizado com subtítulo "Construa, execute e escale sua máquina de receita" e botões "Gerar com IA" + "Novo Playbook".

**Tab Estratégia** — O board atual, mas cada PlaybookCard passa a mostrar: ICP associado, canal principal, última execução e ROI estimado.

**Tab Execução** — Nova seção "Lead Sourcing Engine" com:
- Botão "+ Nova Busca de Leads"
- Seletor de playbook (Evento/Expositores, Diretórios, Busca geográfica, Seed expansion, Lista importada)
- Bloco ICP (seletor de ICP existente com resumo: segmento, região, porte)
- Inputs dinâmicos que mudam conforme o tipo de busca
- Config de execução (score mínimo, importar automático, criar oportunidades, atribuir SDR)
- Botão "Executar Caramelo"
- Tabela de resultados com: Empresa, Origem, Cidade, Score, Sinais, Status, e coluna "Por que é um bom lead"
- Ações por linha: Aprovar, Rejeitar, Criar oportunidade

**Tab Performance** — Dashboard com: leads gerados por playbook, conversão para oportunidade, conversão para venda, CAC por playbook, ROI. Reaproveita dados do ranking existente + novas métricas.

### Banco de dados

Nova tabela `lead_searches` para armazenar buscas executadas:
- `id`, `organization_id`, `user_id`
- `search_type` (event, directory, geo, seed, import)
- `icp_id` (FK para icp_profiles)
- `config` (JSONB — inputs dinâmicos + configurações de execução)
- `status` (pending, running, completed, failed)
- `results_count`, `approved_count`
- `created_at`, `completed_at`

Nova tabela `lead_search_results` para resultados individuais:
- `id`, `search_id` (FK para lead_searches)
- `company_name`, `origin`, `city`, `state`
- `score` (0-100)
- `signals` (JSONB)
- `reason` (texto — "por que é um bom lead")
- `status` (pending, approved, rejected, converted)
- `opportunity_id` (FK nullable)
- `created_at`

RLS: ambas com policy de acesso por `organization_id` via membership check.

### Edge Function

Nova edge function `lead-sourcing` que:
1. Recebe `search_type`, `icp_id`, `config`, `organization_id`
2. Cria registro em `lead_searches`
3. Usa IA (Lovable AI gateway, gemini-2.5-flash) para gerar/pontuar leads com base no ICP e tipo de busca
4. Salva resultados em `lead_search_results`
5. Retorna resultados

### Arquivos a criar/editar

| Arquivo | Ação |
|---|---|
| `src/pages/intelligence/PlaybooksHub.tsx` | Refatorar: 3 tabs (Estratégia, Execução, Performance) |
| `src/components/playbook/PlaybookCard.tsx` | Adicionar ICP, canal, última execução, ROI |
| `src/components/playbook/LeadSourcingEngine.tsx` | **Novo** — Tab Execução completa |
| `src/components/playbook/LeadSearchForm.tsx` | **Novo** — Formulário dinâmico de busca |
| `src/components/playbook/LeadResultsTable.tsx` | **Novo** — Tabela de resultados com ações |
| `src/components/playbook/PlaybookPerformance.tsx` | **Novo** — Tab Performance com métricas |
| `src/hooks/useLeadSourcing.ts` | **Novo** — Hooks para buscas e resultados |
| `supabase/functions/lead-sourcing/index.ts` | **Novo** — Edge function de lead sourcing |
| Migration SQL | **Novo** — Tabelas `lead_searches` e `lead_search_results` |

### Detalhes técnicos

- ICPs vêm da tabela `icp_profiles` já existente
- Inputs dinâmicos renderizados condicionalmente pelo `search_type`
- A edge function usa o ICP (segmento, porte, região, pain_points) como contexto para a IA gerar/pontuar leads
- Resultados com score e justificativa ("reason") gerados pela IA
- Ação "Criar oportunidade" insere diretamente na tabela `opportunities` e linka o `lead_search_results.opportunity_id`
- Tab Performance agrega dados de `lead_searches`, `lead_search_results`, `playbook_executions` e `ai_playbooks`

