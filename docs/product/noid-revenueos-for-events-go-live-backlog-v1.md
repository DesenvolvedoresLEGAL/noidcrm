# NOID RevenueOS for Events — Backlog de GO LIVE v1

| Campo | Valor |
|---|---|
| Versão | v1.0 |
| Data | 2026-07-20 |
| Commit auditado | `4115734591d0d19c078f39f2b2542a77e7a5e936` |
| Fonte executiva | Product Blueprint v1 |
| Audit companion | `noid-revenueos-for-events-product-fit-audit-v1.md` |
| Matriz | `noid-revenueos-for-events-capability-matrix-v1.csv` |
| Freeze | 19/07/2026 → 18/08/2026 respeitado |

Este backlog **NÃO** implementa nada. É a lista priorizada e verificável do que precisa acontecer antes/depois de receber o primeiro Cliente Fundador.

---

## P0 — Bloqueadores do primeiro cliente fundador

### P0-01 · Isolamento multi-tenant homologado em staging
- **Domínio:** Segurança / Multi-tenancy.
- **Problema:** 413 tabelas com RLS e 1.049 policies são evidência estrutural, não operacional. A suíte `src/test/security/tenant-isolation/**` (7 arquivos, 12 usuários × 6 papéis) nunca foi executada em ambiente isolado.
- **Evidência:** `docs/security/phase2-tenant-isolation.md`; `.github/workflows/tenant-isolation.yml`; ausência de projeto Supabase dedicado.
- **Impacto:** Vazamento cross-org indetectado. Sem isso, nenhuma afirmação de isolamento é defensável.
- **Risco:** ALTO.
- **Correção recomendada:** Provisionar Supabase dedicado, aplicar schema, executar `bunx vitest run src/test/security/tenant-isolation`, publicar relatório assinado.
- **Arquivos/superfícies afetadas:** N/A (execução em staging externo).
- **Dependências:** Credenciais Supabase staging + secrets GitHub.
- **Owner sugerido:** Segurança + Engenharia.
- **Critério de aceite:** Todos os 7 arquivos de teste retornam verde em 100% dos cenários; relatório versionado em `docs/security/`.
- **Validação:** Execução automática + revisão manual dos logs.
- **Executável durante o freeze?** SIM (segurança e isolamento).
- **Sprint sugerida:** NOID-SECURITY.

### P0-02 · Guard de exposição para rotas internas (LEGAL/HUMANOID)
- **Domínio:** Segurança / Governança.
- **Problema:** Módulos internos (Kairós, Apollo, NOID Intelligence Hub, Optimization, Experiments, Skills, KG, Roleplay, Vibe Selling, Community, AI Operations, 5 placeholders) são acessíveis por URL direta mesmo quando não aparecem no menu.
- **Evidência:** `src/App.tsx` linhas 934–959 e 957–959; nenhuma verificação de entitlement/plataforma específica nas rotas.
- **Impacto:** Cliente externo pode acessar ferramentas experimentais/internas.
- **Risco:** ALTO reputacional e de PI.
- **Correção recomendada:** Adicionar guard por entitlement/feature flag ou `platform_admin` no `ProtectedRoute` para todo o subárvore afetada.
- **Arquivos afetados:** `src/App.tsx`; potencialmente `src/components/ProtectedRoute.tsx`, `src/hooks/usePermissions.ts`.
- **Dependências:** Definição de entitlement `noid_internal_access` (não criar nesta sprint).
- **Owner sugerido:** Engenharia + Produto.
- **Critério de aceite:** Acessar `/app/settings/noid-intelligence/*`, `/app/intelligence/kairos`, `/app/intelligence/apollo-roi`, `/app/roleplay/*`, `/app/vibe-selling`, `/app/community`, `/app/ai-operations` com usuário Fundador (não-LEGAL) retorna 404 ou "Não autorizado".
- **Validação:** Testes E2E com 2 personas (LEGAL vs Fundador).
- **Executável durante o freeze?** SIM (ocultação e permissão são permitidas).
- **Sprint sugerida:** NOID-VERTICAL 0.3.

### P0-03 · Buckets públicos e enforcement de signed URL
- **Domínio:** Segurança / Storage.
- **Problema:** `proposal-layouts` público (contém termos de contrato); `pdf_url` de propostas ainda gravável por cliente; renome de `opportunity-files` gradual não iniciado.
- **Evidência:** `storage.buckets` (4 de 6 buckets públicos); `docs/security/storage-classification.csv`; migrations staged `05b`, `07a`, `07b`.
- **Impacto:** Vazamento de PII e dados comerciais.
- **Risco:** ALTO.
- **Correção recomendada:** Aplicar em staging as migrations `01→02→03→04→05b→06→07a`; validar; depois `07b`.
- **Arquivos:** `supabase/migrations-staged/storage/*.sql`.
- **Dependências:** Staging + P0-01.
- **Owner:** Engenharia + Segurança.
- **Critério de aceite:** `proposal-layouts` privado; `pdf_url` só via signed URL; nenhum path de `opportunity-files` contém PII.
- **Validação:** `src/test/security/tenant-isolation/storage.test.ts` cenários S1–S12 verdes.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** NOID-SECURITY.

### P0-04 · Signup público fechado durante ciclo Fundadores
- **Domínio:** Auth.
- **Problema:** `/signup` aberto ao público. Blueprint 12.1 exige entrada exclusiva por convite.
- **Evidência:** `src/App.tsx:386`.
- **Impacto:** Registros indesejados, enumeração de tenants, poluição de dados.
- **Risco:** MÉDIO.
- **Correção:** Redirecionar `/signup` para `/agendar-demo` OU exibir gate por token.
- **Arquivos:** `src/pages/Signup.tsx`, `src/App.tsx`.
- **Dependências:** —
- **Owner:** Produto + Engenharia.
- **Critério de aceite:** Acesso a `/signup` sem token/convite não cria conta.
- **Executável durante o freeze?** SIM (correção P0).
- **Sprint sugerida:** 0.3A.

### P0-05 · Aceite de convite homologado
- **Domínio:** Auth / Multi-tenancy.
- **Problema:** Fluxo `/accept-invitation/:token` não foi reproduzido com TTL, single-use, isolamento cross-org.
- **Evidência:** RPC `get_invitation_by_token` presente; `user_invitations`.
- **Impacto:** Convite expirado aceito, single-use quebrado, token vaza organization_id.
- **Risco:** MÉDIO.
- **Correção:** Reproduzir end-to-end em staging.
- **Owner:** Engenharia + Segurança.
- **Critério de aceite:** Token expirado rejeita; single-use enforced; convite mostra apenas dados necessários.
- **Executável durante o freeze?** SIM (é validação).
- **Sprint sugerida:** NOID-SECURITY / 0.3A.

### P0-06 · Onboarding assistido para Fundador
- **Domínio:** Onboarding.
- **Problema:** `/onboarding` atual mistura self-service e operação manual. Fundador precisa ser criado com pipelines Eventos, framework de qualificação e motivos de perda verticais já configurados.
- **Evidência:** `src/pages/Onboarding.tsx`; `onboarding_status`.
- **Impacto:** Fundador chega em produto vazio ou inconsistente.
- **Risco:** ALTO comercial.
- **Correção:** Definir runbook operacional LEGAL + Events Template semear organização.
- **Dependências:** P0-02 (ocultação), Sprint 0.3 (Template).
- **Owner:** Produto + Engenharia.
- **Critério de aceite:** Um Fundador criado zero-a-utilizável em ≤ 60 minutos, sem alteração de código.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** 0.3.

### P0-07 · Plano Fundador separado do fluxo self-service
- **Domínio:** Billing.
- **Problema:** Não há isolamento entre plano interno (Fundador) e planos public-facing. Trial pode bloquear Fundador.
- **Evidência:** `plans`, `plan_entitlements`, `billing_subscriptions`, `trial_blocks`.
- **Impacto:** Fundador bloqueado por trial ou faturado indevidamente.
- **Risco:** ALTO comercial.
- **Correção:** Definir plano interno "Founder" com entitlements adequados; configurar tenants manualmente; nenhum checkout público ativo.
- **Owner:** Produto + Engenharia.
- **Critério de aceite:** Fundador nunca é bloqueado por trial; nenhum caminho de checkout public-facing ativo antes de NOID-GTM.
- **Executável durante o freeze?** SIM (configuração + productização).
- **Sprint sugerida:** 0.3A.

### P0-08 · Importação de dados reproduzida com isolamento
- **Domínio:** Dados / Multi-tenancy.
- **Problema:** Import CSV existe mas não foi reproduzido end-to-end (dedupe, rollback, isolamento).
- **Evidência:** `import_logs`; `/app/settings/data-management`.
- **Impacto:** Fundador não pode ingressar sua base histórica com segurança.
- **Correção:** Reproduzir com dataset sintético; validar dedupe, rollback e RLS.
- **Owner:** Engenharia.
- **Critério de aceite:** 1.000 linhas importadas com dedupe funcional, log completo, zero rows cross-org.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** 0.3A.

### P0-09 · Landing sem claims não comprovados
- **Domínio:** GTM.
- **Problema:** Blueprint 21 registrou bloqueador: provas sociais e claims sem evidência.
- **Impacto:** Reputacional + jurídico.
- **Correção:** Remover ou substituir por cases reais autorizados.
- **Owner:** Marketing + Produto + Fundador.
- **Critério de aceite:** Nenhum cliente/depoimento/estatística sem lastro comprovável.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** NOID-GTM.

### P0-10 · Termos, Privacidade, DPA e SLA
- **Domínio:** Legal.
- **Problema:** Textos genéricos; DPA/SLA ausentes.
- **Correção:** Redação com apoio jurídico; alinhar LGPD + multi-tenancy.
- **Owner:** Legal + Produto.
- **Critério de aceite:** Fundador assina contrato + DPA + SLA no ato da implantação.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** NOID-GTM.

### P0-11 · Decisão sobre visibilidade do repositório e higiene do `.env`
- **Domínio:** Segurança / PI.
- **Problema:** `.env` está versionado (contém apenas publishable/anon Supabase e Firebase), `.gitignore` não protege `.env`. Visibilidade do repositório GitHub não confirmada nesta sprint.
- **Evidência:** `git ls-files .env` retorna o arquivo; `.gitignore` inspecionado.
- **Correção:** Decisão executiva sobre visibilidade + adicionar `.env` ao `.gitignore` + auditoria forense do histórico se público + rotação preventiva se necessária.
- **Owner:** Fundador + Engenharia + Segurança.
- **Critério de aceite:** Repositório privado OU auditoria forense assinada + rotação completa; `.gitignore` cobre `.env`, `.env.local`, `.env.*.local`.
- **Executável durante o freeze?** SIM.
- **Sprint sugerida:** NOID-SECURITY.

---

## P1 — Necessário para o primeiro ciclo

Formato resumido; detalhe em `noid-revenueos-for-events-capability-matrix-v1.csv`.

- **P1-01 Reset de senha end-to-end** (AUTH-003) — reproduzir em staging.
- **P1-02 Central SDR PACE multi-métrica** (CRM-003) — auditar metas/PACE, remover dependência de Kairós.
- **P1-03 Oportunidades — trigger uppercase + campos verticais** (CRM-004) — validar; adicionar `custom_fields` no template.
- **P1-04 Atividades — regra unificada "próxima atividade"** (CRM-006).
- **P1-05 Framework qualificação vertical** (QUAL-001) — criar no template.
- **P1-06 Propostas edição + PDF layout Eventos** (PROP-001).
- **P1-07 Forecast reconciliação** (FORECAST-001) — provar UI→hook→view.
- **P1-08 Revenue Command reconciliação** (REVCMD-001) — bater com Forecast/Dashboard/OTE.
- **P1-09 Dashboards em org limpa** (DASH-001..003) — testar 0 registros.
- **P1-10 Win/Loss motivos verticais** (WINLOSS-001) — configurar no template.
- **P1-11 Reports v2 rastreio de fontes** (REPORTS-001).
- **P1-12 Automações homologadas** (AUTOM-001) — provar idempotência.
- **P1-13 Notificações v2** (NOTIF-001) — auditar links quebrados, remover referências internas.
- **P1-14 Trial nunca aplicado a Fundador** (BILLING-002).
- **P1-15 Docs curadas para Eventos** (DOCS-001) — remover Kairós/Apollo/Autonomous.

---

## P2 — Productização posterior ao primeiro cliente

- **P2-01 Contatos** (CRM-002) — manter atual; melhorias posteriores.
- **P2-02 Backup Inventário NOID** (IMPEXP-002) — configurável, ocultável.
- **P2-03 Suporte e tickets** (SUPPORT-001) — auditoria completa.
- **P2-04 Revisão caso-a-caso das 3 policies `USING(true)` remanescentes** (não legítimas como service_role).
- **P2-05 Melhorias de UX no template Eventos.**

---

## P3 — FUTURO (fora do primeiro ciclo)

- Integração operacional NOID → Eventrix homologada.
- Renovação, expansão e CS avançado.
- OTE avançado além do básico.
- Marketplace de Skills / MCP público.
- Autonomous mode em produção externa.
- Community pública.

---

## Itens OCULTAR (Sprint 0.3)

Rotas e módulos a esconder por default do NOID Events Template. **Não excluir código** — apenas guard + ausência no menu:

- `/app/intelligence/kairos` e subseções (Kairós Hub, Autopilot, Coverage, Revenue Attribution, SDR Copilot).
- `/app/intelligence/apollo-roi` (Apollo Reveal/ROI).
- `/app/intelligence/optimization` (Optimization Hub).
- `/app/intelligence/experiments` (Experiments Hub).
- `/app/intelligence/skills`, `/app/intelligence/skills/:id`, `/app/intelligence/skills/:id/playground`.
- `/app/intelligence/knowledge-graph`.
- `/app/intelligence/win-loss` — **manter para cliente** (é Revenue Core), mas curar labels.
- `/app/settings/noid-intelligence/*` (15 rotas):
  - `noid-intelligence` (Hub), `agents`, `agents/new`, `agents/:id`, `agents/:id/builder`, `agents/:id/simulator`, `agents/:id/outcomes`, `orchestrations`, `approvals`, `runs/:runId`, `logs`, `metrics`, `tools`, `memories`, `environments`, `permissions`, `mcp-registry`, `decision-rules`, `learning`, `hh-lab`.
- `/app/roleplay/*` (roleplay, sessions, videos).
- `/app/vibe-selling`.
- `/app/community`.
- `/app/ai-operations`.
- `/admin/*` (18 rotas) — permanece platform_admin apenas.
- 5 rotas `NoidPlaceholder`: orchestrations, logs, tools, memories (dentro de `noid-intelligence`) + qualquer outro placeholder identificado.

---

## Itens CONFIGURAR (Sprint 0.3 — Events Template)

Entram no template sem alteração de código:

- Pipelines padrão: Pré-vendas Eventos, Vendas Eventos, Onboarding Eventos.
- Etapas padrão por pipeline.
- Framework de qualificação vertical.
- `loss_reasons` verticais (prazo, fornecedor oficial, orçamento cliente, cancelamento evento, homologação, decisor não engajado).
- `disqualification_reasons` verticais.
- Origens (`lead_sources`) padrão para Eventos.
- Motivos de ganho (`win_reasons`) verticais.
- Papéis padrão + `permission_sets` mínimos.
- Feature flags de módulos ocultos (todos OFF por default).
- Automações homologadas (regras seguras — apenas as validadas).
- Layout de proposta Eventos.
- Dados sintéticos mínimos para demo (opcional, sinalizado).

---

## Itens ADAPTAR (Sprint 0.3)

Exigem pequenos ajustes verticais:

- `custom_fields` verticais em Accounts, Contacts, Opportunities:
  - Empresa: `organizador`, `local_evento`, `pavilhao`, `tipo_participacao`.
  - Contato: `funcao_evento` (comprador / decisor técnico / operacional).
  - Oportunidade: `data_evento`, `data_montagem`, `data_desmontagem`, `data_limite_contratacao`, `estande_numero`, `fornecedor_oficial_status`.
- Relógio do evento — componente derivado dos campos acima (exibição, não regra nova).
- Dashboards com labels adaptadas (SDR Eventos, Closer Eventos).
- Docs públicas: remover referências Kairós/Apollo/Autonomous; adicionar seção Eventos.
- Signup fechado / entrada por convite.
- Landing: claims comprovados.

---

## Itens FUTURO (não trabalhar no ciclo Fundadores)

- Integração NOID → Eventrix operacional homologada.
- Marketplace de Skills / MCP público.
- Autonomous em produção externa.
- Community pública.
- OTE avançado além do básico.
- Renovação/expansão/CS avançado com relógio próprio.

---

## Checklist objetivo — Primeiro Cliente Fundador

| Requisito | Estado |
|---|---|
| Criar organização externa | Sim, após P0-06 (Onboarding assistido) |
| Convidar usuários | Sim, após P0-05 (aceite validado) |
| Aplicar permissões | Sim (ORG-002 PRONTO) |
| Configurar pipelines | Sim, após P0-06 + Template |
| Importar empresas e contatos | Sim, após P0-08 |
| Importar/criar oportunidades | Sim, após P0-08 |
| Criar atividades | Sim (CRM-006) |
| Executar qualificação | Sim, após QUAL-001 no template |
| Realizar handoff | Sim, com framework configurado |
| Criar proposta | Sim (PROP-001) |
| Enviar proposta | Sim (PROP-002 PRONTO) |
| Visualizar proposta pública | Sim (PROP-002 PRONTO) |
| Registrar aceite | Sim (PROP-003 PRONTO) |
| Fechar oportunidade | Sim, com validação P1-08 |
| Visualizar Forecast | Sim, com reconciliação P1-07 |
| Visualizar Revenue Command | Sim, com reconciliação P1-08 |
| Visualizar dashboards | Sim, após P1-09 (org limpa) |
| Exportar dados | Sim, após P0-08 e portabilidade LGPD |
| Bloquear por inadimplência | Não aplicável a Fundador (P0-07) |
| Separar módulos internos | Sim, após P0-02 |
| Operar sem dados da LEGAL | Sim, após P0-02 + Template |
| Investigar erros | Sim internamente; cliente não vê `/admin/*` |
| Encerrar contrato e devolver dados | Sim, após P0-08 (export) |

---

## Regras do backlog

- Cada P0 tem critério de aceite verificável.
- Nenhum item cria funcionalidade fora do escopo.
- Preferência absoluta por configuração antes de código.
- Preferência por ocultação antes de correção de módulo não vendável.
- Nenhuma estimativa de prazo neste documento — quem estima é a próxima sprint.
