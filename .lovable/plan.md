# Sprint NOID-VERTICAL 0.1 — Product Blueprint v1

## Objetivo

Criar **um único artefato**: `docs/product/noid-revenueos-for-events-product-blueprint-v1.md`, seguindo integralmente o briefing aprovado e as correções obrigatórias (hierarquia de evidência, validação prévia de paths, apêndice de evidências, respeito ao freeze).

## O que NÃO será feito (freeze)

- Nenhum arquivo funcional será criado, editado ou removido.
- Nenhuma migration, RPC, RLS, edge function, secret, seed ou dado será tocado.
- Nenhuma memória (`mem://*`) será criada, editada ou removida.
- Nenhuma configuração de plataforma será alterada.
- Nenhum tenant/template/organização será criado.
- Verificação: `git status --short` continuará mostrando **apenas** o novo arquivo em `docs/product/`.

## Auditoria read-only já realizada nesta sprint (evidências para o Apêndice A)

Nível de confiança conforme briefing: schema em produção > migrations > tipos > código funcional > rota/componente/hook > testes > docs > dumps.

- **Rotas** — `src/App.tsx` mapeado (≈180+ rotas): `/app/*`, `/app/settings/*`, `/app/intelligence/*`, `/app/gtm/*`, `/admin/*`, públicas `/p/:token`, `/f/:token`, `/agendar-demo`, `/docs`.
- **Páginas** — `src/pages/` (Opportunities, Forecast, RevenueCommandPage, Proposals, ProposalEditor, ProposalPublicView, Products, Accounts, Contacts, Leads, Activities, Reports, OTEReport, Insights, Automation, Onboarding, AcceptInvitation, Login, Signup, Support, Community, Trash, Roleplay, DynamicDashboardPage, NotificationsHistory, MigrationAuditPage, etc.).
- **Settings** — `NoidInventoryBackupPage`, `EventrixInventorySettings`, `QualificationFrameworkPage`, `PipelineSettings`, `SalesConfigPage`, `PermissionSettings`, `NotificationPreferences`, `CustomFields`, `CustomForms`, `ProposalLayouts`, `ProposalTemplateEditor`, `LossReasons`, `Integrations`, `Origins`, `Industries`, `BusinessUnits`, `DataManagement`, `Account`, `ApiKeysSettings`, `ProductSettings`, `ProductCategories`.
- **NOID Intelligence (interno)** — `noid-intelligence/*` (Hub, Agents, Builder, Simulator, Outcomes, Approvals, Runs, Metrics, Environments, Permissions, McpRegistry, DecisionRules, LearningPerformance, HeadlessHumanoidLab) + placeholders (Orquestrações/Logs/Ferramentas/Memórias).
- **Kairós** — `src/pages/intelligence/KairosHub.tsx`, serviços `src/services/intelligence/{autopilot,qualifiedQueue,revenueAttribution,sdrCopilot,coverage}.ts`, edge functions `kairos-*`.
- **Apollo** — `src/services/enrichment/apolloService.ts`, `apolloPreview.ts`, `src/services/intelligence/apollo{EndpointMatrix,BrowserParity,Invisible}.ts`, `src/pages/intelligence/ApolloRoi.tsx`, edge functions `apollo-*`.
- **Experimentais** — `Vibe`, `Optimization`, `Experiments`, `Playbooks`, `WinLossHub`, `Graph`, `Memories`, Skills Library.
- **Qualificação** — `src/lib/qualification/{qualificationScore,qualificationRecommendation,disqualifyReasons}.ts` + testes.
- **Admin HUMANOID** — `/admin/*` (organizations, users, forensic, revenue, analytics, logs, audit, trash, backup, ai, infrastructure, control-room, trace, plans, revenue-integrity).
- **Contagens referenciais** — `supabase/migrations/` ≈ **688 arquivos**; `supabase/functions/` ≈ **272 diretórios**. Tratadas como referência, **não** como fato de "todas em uso".
- **Documentos de segurança** — `docs/security/phase1-rls-audit.md`, `phase2-tenant-isolation.md`, `storage-classification.csv`, `.github/workflows/tenant-isolation.yml`, `supabase/migrations-staged/storage/*`. Tratados como **evidência documental**, não como prova de proteção ativa em produção.
- **Dump** `database/dumps/00_table_list.sql`: **baixa confiança** (snapshot possivelmente desatualizado). Não usado como fonte primária.

## Estrutura do blueprint (23 seções + Apêndice A)

1. Resumo Executivo — definição oficial, fronteira NOID x Eventrix, versão Fundadores.
2. ICP primário + secundário, comprador, usuário, qualificação, desqualificação, anti-ICP.
3. Segmentos P1 e P2 com ficha (processo, dores, campos, riscos, indicadores, aderência).
4. Taxonomia de 22 dores (sintoma, impacto, momento, persona, tratamento, métrica, status).
5. Proposta de valor: promessa agressiva + institucional, por persona, por segmento, diferenciais.
6. Fluxos canônicos — pipelines de pré-vendas e vendas (PROPOSTO), ficha por etapa, fluxos transversais.
7. Campos verticais de eventos (identificação, datas, localização, escopo, comercial, relacionamento).
8. Framework de qualificação vertical (18 itens + pesos + cortes + comparação com produto atual).
9. Automações verticais (14 automações, com gatilho, condições, ação, aprovação, status).
10. Dashboards por persona (SDR, Closer, Gestor, Owner) — com status EXISTENTE/PROPOSTO/NECESSITA AUDITORIA.
11. Métricas oficiais (pré-vendas, vendas, verticais, gestão) + fontes já comprovadas.
12. Escopo do Revenue Core (core obrigatório, configurável, add-ons futuros, internos, experimentais).
13. Itens candidatos a ocultação no 1º ciclo — sem ocultar nada agora; documenta caminho.
14. Fora do escopo — nunca entra no Revenue Core; fronteiras Eventrix / HumanERP.
15. NOID Events Template (PROPOSTO) — estrutura, critérios de qualidade, uso.
16. Critérios de implantação — 12 fases, informações obrigatórias, limites, saneamento.
17. Critérios de sucesso dos Clientes Fundadores — implantação binária, adoção com baseline, resultado após baseline; regras do programa (sem promessa percentual).
18. Product Fit Audit — critérios da Sprint 0.2 (PRONTO/CONFIGURAR/CORRIGIR/ADAPTAR/OCULTAR/FUTURO), sem executar aqui.
19. Governança do freeze — permitido/proibido + árvore de decisão.
20. Brief comercial de 20/07/2026 — o que vender/não vender, oferta, CTA, papéis.
21. Riscos e dependências — matriz com mitigação, owner e gate.
22. Decisões em aberto — opções + recomendação inicial + momento de decisão.
23. Roadmap imediato — 10 fases até o GO LIVE público.
- **Apêndice A** — matriz preliminar de evidências (domínio, evidência localizada, tipo, status, confiança, aprofundar em 0.2). Documentos de segurança marcados como *evidência documental* e não como prova operacional. Contagens de migrations/functions declaradas como referenciais.

## Regras aplicadas ao texto

- Cada afirmação sobre o produto atual usa: **EXISTENTE / PROPOSTO / NECESSITA AUDITORIA / BLOQUEADOR / RISCO / FUTURO / FORA DO ESCOPO**.
- Nenhuma feature é dada como "pronta" apenas por existir rota, componente ou nome no código.
- Nenhuma capacidade é afirmada com base em memórias (`mem://*`); memórias serviram só de contexto.
- Documentos de segurança são citados como evidência documental — sua efetividade depende de execução da suíte contra staging (item mapeado em Riscos e no Apêndice).
- Nenhuma promessa percentual, ROI numérico ou case comercial é feita.

## Entregável final

Um único novo arquivo:

```text
docs/product/noid-revenueos-for-events-product-blueprint-v1.md
```

## Verificação de freeze pós-escrita

- `git status --short` deve listar **exclusivamente** esse arquivo (Untracked).
- `git diff --stat` deve retornar vazio.
- Nada em `src/`, `supabase/`, `.github/`, `scripts/`, `mem://`, `docs/security/`, `database/`, `public/`, `package.json`, `bun.lockb`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig*.json`.

Aprove para eu escrever o arquivo em build mode.
