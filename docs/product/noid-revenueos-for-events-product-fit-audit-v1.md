# NOID RevenueOS for Events — Product Fit Audit v1

| Campo | Valor |
|---|---|
| Status | APROVADO PARA REVISÃO EXECUTIVA |
| Versão | v1.0 |
| Data | 2026-07-20 |
| Owner | Produto + Engenharia + Segurança |
| Commit auditado | `4115734591d0d19c078f39f2b2542a77e7a5e936` |
| Branch | `edit/edt-331a1e34-6530-41a2-9ee3-f76e50a6315f` |
| Ambiente | Produção Lovable Cloud (ref `urihdqturaebhiefwjnw`) — leitura de metadados apenas |
| Natureza | Read-only. Nenhum código funcional, migration, RLS, RPC, Edge Function, secret ou dado alterado. |
| Fonte executiva | `docs/product/noid-revenueos-for-events-product-blueprint-v1.md` |
| Freeze | 19/07/2026 → 18/08/2026 respeitado |

---

## 1. Resumo executivo

O NOID RevenueOS possui **estrutura ampla e madura** (413 tabelas RLS-enabled, 1049 policies, 379 funções `SECURITY DEFINER`, 66 views, 272 diretórios de Edge Functions, 688 migrations, 190 páginas React, 302 hooks, 188 services e 98 padrões de rota únicos declarados em `src/App.tsx`). No entanto, **maturidade estrutural não equivale a prontidão comercial**. A auditoria identifica um núcleo de Revenue Core operável, cercado por módulos internos (LEGAL/HUMANOID) e experimentais que não podem ser expostos ao primeiro cliente externo, além de bloqueadores concretos em **onboarding, isolamento comprovado em staging, storage público, landing e visibilidade do repositório**.

**Recomendação final: GO CONDICIONAL.**
O NOID pode receber o primeiro Cliente Fundador **após** resolver os P0 listados na Seção 14 e executar as sprints NOID-SECURITY (isolamento em staging), 0.3 (Events Template + ocultação) e NOID-GTM (landing/oferta).

---

## 2. Metodologia

Auditoria read-only, baseada na hierarquia de evidências definida no Blueprint v1 (Seção 4). Fontes usadas nesta sprint:

- Introspecção de schema via consultas SQL somente-leitura (`information_schema`, `pg_catalog`, `pg_policies`, `storage.buckets`).
- Leitura de `src/App.tsx`, `src/pages/**`, `src/components/**`, `src/hooks/**`, `src/services/**`.
- Inventário macro por contagem de arquivos (`find`, `rg`).
- Documentação de segurança já versionada (`docs/security/*`).
- Blueprint v1 como fonte de verdade das decisões APROVADAS.

Nenhum comando destrutivo, nenhuma alteração em banco, nenhum teste que injete dados. Onde a evidência não é convergente, o item é classificado `NECESSITA AUDITORIA` e recebe `confidence=MÉDIO` ou `BAIXO` na matriz CSV.

---

## 3. Limitações da auditoria

1. **Sem ambiente de staging isolado.** A confirmação de isolamento multi-tenant (Fase 2 da sprint anterior) permanece com artefatos *staged*, não executados. Qualquer afirmação de isolamento comprovado depende de execução da suíte `src/test/security/tenant-isolation/**` em Supabase dedicado.
2. **Sem execução de fluxos operacionais.** Não foi reproduzido nenhum fluxo end-to-end (signup, aceite, proposta, forecast) nesta sprint.
3. **Sem auditoria forense do histórico Git.** A revisão do repositório (Fase 7) é preliminar.
4. **Sem homologação de reconciliação numérica.** Forecast × Revenue Command × Dashboard × OTE × Win/Loss compartilham `commercial_won_revenue_view`; a reconciliação operacional definitiva não foi provada nesta sprint.
5. **Sem confirmação da visibilidade real do repositório GitHub.** Registrado como bloqueador P0 que exige verificação executiva.
6. **Build/typecheck/lint/testes automatizados não foram executados** — instalar dependências está proibido pelo freeze. Registro da limitação em Fase 9.

---

## 4. Inventário macro

Contagens obtidas via introspecção do repositório e do banco no commit auditado:

| Categoria | Contagem | Fonte |
|---|---:|---|
| Padrões de rota declarados (`<Route path=`) | 98 únicos (177 ocorrências) | `rg` em `src/App.tsx` |
| Páginas React | 190 | `find src/pages -name '*.tsx'` |
| Componentes | 1.059 | `find src/components -name '*.tsx'` |
| Hooks | 302 | `find src/hooks` |
| Services | 188 | `find src/services` |
| Diretórios de Edge Functions | 272 | `ls supabase/functions` |
| Migrations | 688 | `ls supabase/migrations` |
| Migrations staged (não aplicadas) | 8 | `supabase/migrations-staged/` |
| Tabelas no schema `public` | 413 | `information_schema.tables` |
| Tabelas com `organization_id` | 408 | `information_schema.columns` |
| Tabelas com RLS habilitada | 413 (100%) | `pg_class.relrowsecurity` |
| Tabelas sem RLS | 0 | idem |
| Policies em `public` | 1.049 | `pg_policies` |
| Views | 66 | `information_schema.views` |
| Materialized views | 1 | `pg_matviews` |
| Rotinas em `public` (functions/procs) | 170 | `information_schema.routines` |
| Funções `SECURITY DEFINER` | 379 | `pg_proc.prosecdef` |
| Policies com `USING (true)` sem checagem de org | 27 | `pg_policies` |
| Buckets de Storage | 6 (4 públicos, 2 privados) | `storage.buckets` |
| Placeholders (`NoidPlaceholder`) | 5 rotas | `rg` em `src/App.tsx` |

**Não interpretar como garantia de uso operacional.** É inventário do repositório e do schema.

---

## 5. Mapa de exposição

Classificação dos 98 padrões de rota únicos declarados em `src/App.tsx` (linhas 385–1280):

| Classe | Contagem estimada | Exemplos |
|---|---:|---|
| PUBLIC | 15 | `/`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/onboarding`, `/accept-invitation/:token`, `/public/proposal/:token`, `/p/:token`, `/f/:token`, `/terms`, `/privacy`, `/agendar-demo`, `/docs`, `/docs/:category/:slug`, `/status/auth` |
| CLIENT | ~40 | `/app/dashboard`, `/app/accounts`, `/app/contacts`, `/app/opportunities`, `/app/proposals`, `/app/reports`, `/app/forecast`, `/app/revenue-command`, `/app/activities`, `/app/leads` |
| OWNER_ADMIN | ~30 | Todo `/app/settings/*` (58 rotas segundo prefix scan) |
| INTERNAL_LEGAL / EXPERIMENTAL | ~13 | `/app/settings/noid-intelligence/*` (15 subrrotas), `/app/intelligence/kairos`, `/app/intelligence/apollo-roi`, `/app/intelligence/experiments`, `/app/intelligence/skills*`, `/app/intelligence/optimization`, `/app/intelligence/knowledge-graph`, `/app/roleplay/*`, `/app/vibe-selling`, `/app/community`, `/app/ai-operations` |
| PLATFORM_ADMIN | ~18 | `/admin/*` (organizations, users, forensic, revenue, analytics, logs, audit, trash, backup, ai, infrastructure, settings, control-room, trace/:traceId, plans, plg-score, revenue-integrity) |
| PLACEHOLDER | 5 | `/app/settings/noid-intelligence/{orchestrations,logs,tools,memories}` |

**Achado crítico:** rotas internas em `/app/settings/noid-intelligence/*` e `/app/intelligence/*` **não têm entitlement/feature-flag distinto** documentado no roteamento; a proteção depende de omissão no menu, permitindo **acesso por URL direta**. Isso é classificado como P0 (INTERNAL-003, INTERNAL-004) — ver Seção 6 e matriz CSV.

Inventário completo dos 98 padrões: `rg -n '<Route\s+path=' src/App.tsx` no commit auditado.

---

## 6. Resumo do Revenue Core

O Revenue Core (Blueprint Seção 12.1) foi mapeado capacidade a capacidade em `noid-revenueos-for-events-capability-matrix-v1.csv`. Distribuição das classificações finais:

| Classificação | Quantidade |
|---|---:|
| PRONTO | 4 |
| CONFIGURAR | 3 |
| CORRIGIR | 5 |
| ADAPTAR | 11 |
| OCULTAR | 8 |
| NECESSITA AUDITORIA (marcador) | 13 |

Total de capacidades auditadas nesta sprint: **48** (não exaustivo; cobre os 23 domínios obrigatórios do Blueprint).

---

## 7. Capacidades PRONTAS

- **AUTH-001** Login email+senha.
- **ORG-002** Memberships e papéis (owner/admin/manager/sales/viewer/cs) + `has_role` DEFINER com `search_path=public`.
- **PROP-002** Link público de proposta com token (RPC `get_proposal_by_public_token`).
- **PROP-003** Aceite/recusa/expiração (state machine + trigger para outbox).
- **DEFINER-001** Hardening `SECURITY DEFINER`: 379 funções revogadas de `PUBLIC EXECUTE` (Fase 1.5).

Nenhum item PRONTO isenta a Sprint 0.3 de validar em ambiente limpo de Fundador antes da primeira demo.

---

## 8. Capacidades a CONFIGURAR

Não exigem código, apenas conteúdo/configuração no NOID Events Template:

- **CRM-005** Pipelines padrão Eventos (Pré-vendas, Vendas, Onboarding/CS).
- **QUAL-001** Framework de qualificação vertical (decisor, data limite de contratação, fornecedor oficial).
- **WINLOSS-001** Motivos de perda verticais (prazo, fornecedor oficial, orçamento cliente, cancelamento do evento).
- **IMPEXP-002** Backup Inventário NOID: manter para operação interna; ocultar do cliente.
- **AUTOM-001** Regras de workflow homologadas (não duplicar atividades).

---

## 9. Capacidades a CORRIGIR

- **PROP-004** Bucket `proposal-pdfs` — aplicar migrations `07a` (audit) e `07b` (enforcement) staged.
- **STORAGE-001** Buckets públicos (`proposal-layouts`, `organization-logos`, `product-images`, `avatars`) — privatizar `proposal-layouts` e `organization-logos` conforme decisão executiva aprovada; rename gradual `opportunity-files`.
- **ONBOARD-001** Onboarding: hoje mistura self-service com dependência operacional; para Fundador, LEGAL executa manualmente.
- **LANDING-001** Provas sociais/claims não comprovados na landing (Blueprint Seção 21 P0).
- **LEGAL-001** Termos, Privacidade, DPA e SLA — revisar/completar para Fundadores.

---

## 10. Capacidades a ADAPTAR

- **CRM-001** Empresas → campos verticais (organizador, local, pavilhão, estande) via `custom_fields`.
- **CRM-003** Central SDR → PACE multi-métrica, remover dependência de Kairós.
- **CRM-004** Oportunidades → relógio do evento, `data_evento`, `data_montagem`, `data_desmontagem`, `data_limite_contratacao` (via `custom_fields` no template).
- **PROP-001** Propostas → layout PDF vertical Eventos.
- **AUTH-002** Signup → fechar signup público durante o ciclo Fundadores; entrada apenas por convite.
- **ORG-001** Criação de organização → operação assistida pela LEGAL para Fundadores.
- **BILLING-001** Planos e entitlements → configurar plano Fundador manualmente; sem checkout público ativo.
- **BILLING-002** Trial → nunca aplicar a Fundadores.
- **AUTOM-001** Automações → regras template idempotentes.
- **DOCS-001** Docs públicas → curar conteúdo Eventos; remover referências a Kairós/Apollo/Autonomous.
- **REPO-001** Repositório → decisão executiva de visibilidade + `.gitignore` cobrindo `.env` mesmo em Lovable.

---

## 11. Capacidades a OCULTAR

Módulos internos ou experimentais que **não devem** aparecer para clientes externos no primeiro ciclo. Todos exigem guard de rota (não apenas ocultação de menu):

- **INTERNAL-001** Kairós Hub (`/app/intelligence/kairos`) e subseções (Apollo, Coverage, Autopilot, Revenue Attribution, SDR Copilot).
- **INTERNAL-002** Apollo ROI (`/app/intelligence/apollo-roi`).
- **INTERNAL-003** NOID Intelligence Hub inteiro (`/app/settings/noid-intelligence/*` — 15 rotas incluindo Agents, Builder, Simulator, Approvals, Runs, Metrics, Environments, Permissions, MCP Registry, Decision Rules, Learning, HH Lab).
- **INTERNAL-004** Optimization Hub, Experiments Hub, Skills Library/Playground, Knowledge Graph.
- **INTERNAL-005** Roleplay e Video Library.
- **INTERNAL-006** Vibe Selling.
- **INTERNAL-007** Community.
- **INTERNAL-008** AI Operations.
- **PLACEHOLDER-001** 5 rotas `NoidPlaceholder` (orchestrations, logs, tools, memories, learning).
- **AUDIT-001** `/admin/*` (18 rotas) — manter oculto para clientes, migrar telas equivalentes cliente-visible para `timeline_events`/audit próprio.

---

## 12. Capacidades FUTURAS

Fora do primeiro ciclo comercial:

- Integração operacional NOID → Eventrix homologada (existe estruturalmente; NÃO comprovada).
- Renovação/expansão/CS avançado (Blueprint 12.1 permite futuro).
- OTE avançado além do básico.
- Marketplace de skills / MCP público.
- Autonomous mode / Agentes em produção externa.
- Community pública.

---

## 13. Bloqueadores P0 (ordem de prioridade)

Lista consolidada — detalhe em `noid-revenueos-for-events-go-live-backlog-v1.md`.

1. **TENANT-001** Isolamento multi-tenant não comprovado em staging (suíte staged, não executada).
2. **INTERNAL-001..008 + PLACEHOLDER-001 + INTERNAL-003** Módulos internos acessíveis por URL direta.
3. **STORAGE-001 / PROP-004** Buckets públicos e ausência de enforcement de signed URL para `proposal-pdfs`.
4. **AUTH-002** Signup público ativo — deve ser desabilitado para o ciclo Fundadores.
5. **AUTH-004** Aceite de convite não validado end-to-end (token TTL, single-use, isolamento).
6. **ONBOARD-001** Onboarding para Fundador não é repetível sem operação manual.
7. **BILLING-001** Fluxo de plano Fundador não separado do fluxo self-service.
8. **IMPEXP-001** Importação não reproduzida com dedupe/rollback/isolamento.
9. **LANDING-001** Provas sociais e claims não comprovados.
10. **LEGAL-001** Termos/Privacidade/DPA/SLA insuficientes.
11. **REPO-001** Visibilidade do repositório e `.env` versionado (contém apenas publishable/anon; ainda assim `.gitignore` não protege `.env`).

---

## 14. Itens P1, P2 e P3

Detalhe completo no backlog. Resumo:

- **P1 (13):** reset de senha end-to-end, memberships/troca org, Central SDR, Oportunidades verticais, atividades, framework qualificação, propostas edição, PDF layouts, Forecast reconciliação, Revenue Command reconciliação, Dashboards em org limpa, Win/Loss motivos verticais, Reports v2 rastreio de fontes, PROP-004 (também classificado abaixo de STORAGE-001), automações.
- **P2 (3):** contatos (mantidos como estão), backup inventário (configurar), suporte/tickets.
- **P3 (6):** integração operacional Eventrix, renovação/expansão/CS avançado, OTE avançado, Marketplace skills/MCP, Autonomous produtivo, Community pública.

---

## 15. Segurança e isolamento multi-tenant

- **413 tabelas com RLS habilitada; 0 sem RLS.** ✅
- **408/413 tabelas têm `organization_id`.** ✅
- **1.049 policies em `public`.** ✅
- **27 policies com `USING (true)`** — 18 são `service_role` legítimos (`Service role manages X`, `apollo_*`, `kairos_*`, `cnpj_cache`), 4 são read-only para roles `anon` intencionais (`plans`, `plan_entitlements`, `disposable_email_domains`, `help_articles`), 2 são `platform_admin` restrito, 3 exigem revisão caso-a-caso (Seção 22 do backlog).
- **379 funções `SECURITY DEFINER`** com hardening da Fase 1.5 aplicado (revogação de `PUBLIC EXECUTE`; grant explícito para `authenticated`).
- **Suíte de isolamento** existe em `src/test/security/tenant-isolation/**` mas depende de projeto Supabase dedicado para execução (workflow `.github/workflows/tenant-isolation.yml` presente).

**Conclusão da Fase 6:** o produto está **estruturalmente preparado** para isolamento multi-tenant, mas **isolamento operacional só pode ser afirmado após execução da suíte em staging isolado**. Enquanto isso não ocorrer, TENANT-001 é `BLOQUEADOR — HOMOLOGAÇÃO EM STAGING NECESSÁRIA`.

Tabela de superfícies de risco (não-exaustiva):

| Superfície | Risco | Evidência | Severidade | Exploração provável | Mitigação | Gate |
|---|---|---|---|---|---|---|
| Rotas `/app/intelligence/*` e `/app/settings/noid-intelligence/*` acessíveis por URL | Cliente comum vê ferramentas internas | `src/App.tsx` 934–959 sem entitlement específico | ALTA | Baixa em produção controlada; média se URL vazar | Guard de entitlement/plataforma no `ProtectedRoute` | Antes do 1º Fundador |
| `proposal-layouts` bucket público | Layouts com PII/preços expostos | `storage.buckets` `public=true` | ALTA | Requer conhecer o path | Migration `05b` staged | NOID-SECURITY |
| `pdf_url` gravado por cliente sem enforcement | Bypass signed URL | migrations staged `07a/07b` | MÉDIA | Depende de coluna e do fluxo | Trigger audit primeiro, depois enforcement | NOID-SECURITY |
| Signup público aberto | Enumeração/pollution de tenants | `/signup` público | MÉDIA | Média | Fechar signup no ciclo Fundadores | Antes do 1º Fundador |
| `.env` versionado (publishable apenas) | Exposição de project ref | `git ls-files .env` retorna arquivo | BAIXA (conteúdo é publishable) | Baixa | Adicionar ao `.gitignore` + decisão sobre repo público | NOID-SECURITY |
| 27 policies `USING (true)` | Falsos positivos + potencial real | listagem já feita | BAIXA a MÉDIA | Depende do caso | Revisão caso-a-caso | Sprint 0.3A |

---

## 16. Autenticação e permissões

Ver capacidades AUTH-001..004 e ORG-002. Fluxos base presentes; hardening de convite e reset exige reprodução em staging (P0 AUTH-004; P1 AUTH-003).

## 17. Onboarding

**Não repetível para cliente externo sem operação manual.** Blueprint 12.1 exige capacidade de implantar Fundador sem alteração de código; hoje isso depende de scripts operacionais e ajustes no tenant. Ver ONBOARD-001.

## 18. Dados e integridade

- `opportunities` tem 113 colunas e `proposals` tem 102 — schema amplo, requer inspeção de campos legados durante a criação do Template (Sprint 0.3).
- 408/413 tabelas com `organization_id`; as 5 sem incluem catálogos globais (`plans`, `plan_entitlements`, `disposable_email_domains`, `holidays`, `industries`).
- Triggers documentados na memória (título uppercase, valid_revenue_amount, closed_at imutável) — não reverificados nesta sprint.

## 19. Importação e exportação

Import CSV existe (`/app/settings/data-management`, tabela `import_logs`), mas não foi reproduzido nesta sprint. **P0 IMPEXP-001**: exige teste com dedupe, rollback e comprovação de isolamento.

## 20. Propostas

Fluxo completo mapeado (criação, edição, PDF, layout, token público, aceite, decline, expiração). SSoT de valor líquido em memória. PROP-004 depende das migrations staged.

## 21. Forecast e reconciliação de receita

`commercial_won_revenue_view` é SSoT declarada. Correção recente alinhou Revenue Command ao pipeline sales primário. **A reconciliação operacional (Forecast × Revenue Command × Dashboard × OTE × Win/Loss × Reports v2) NÃO foi provada nesta sprint.** Continua `NECESSITA AUDITORIA OPERACIONAL` conforme Blueprint 10 e 11.5.

## 22. Revenue Command

Alinhado ao pipeline sales primário. Requer reprodução final em Sprint 0.3A.

## 23. Dashboards

Closer, CEO e Central SDR foram inventariados. **Nenhum foi validado em org limpa sem histórico** — P1.

## 24. Billing e trial

Estrutura de planos, entitlements, subscriptions, trial_blocks e organization_billing_status presente. **Fundador precisa de plano interno separado do checkout self-service** (BILLING-001 P0).

## 25. Automações

Estrutura presente. **Nenhuma automação deve ser considerada PRONTA para Fundador sem evidência de idempotência, isolamento e logs.**

## 26. Observabilidade e suporte

`audit_log`, `system_events`, `auth_audit_log`, `ai_agent_audit` presentes. Trace Viewer e Admin Audit em `/admin/*` — devem permanecer ocultos para clientes.

## 27. Adequação ao vertical de eventos

Blueprint 6 e 7 aprovaram taxonomia de dores e campos verticais. Estado atual:

| Campo vertical | Estado |
|---|---|
| Evento | EXIGE CAMPO CUSTOMIZADO |
| Organizador | EXIGE CAMPO CUSTOMIZADO |
| Local / Pavilhão | EXIGE CAMPO CUSTOMIZADO |
| Estande | EXIGE CAMPO CUSTOMIZADO |
| Fornecedor oficial / Homologação | EXIGE CAMPO CUSTOMIZADO |
| Tipo de participação | EXIGE CAMPO CUSTOMIZADO |
| Data do evento / Montagem / Desmontagem / Limite de contratação | EXIGE CAMPO CUSTOMIZADO |
| Relógio do evento | EXIGE ADAPTAÇÃO (regra derivada dos campos acima; requer componente) |
| Perdas por prazo / fornecedor oficial | EXIGE CONFIGURAÇÃO (`loss_reasons` verticais) |
| Conversão por evento/local/organizador | EXIGE ADAPTAÇÃO (view/relatório) |

Todos podem ser resolvidos por configuração + campos customizados no NOID Events Template. Nenhum exige mudança de schema principal.

## 28. Fronteira NOID x Eventrix

Confirmada — Revenue Core cobre pré-vendas, vendas, forecast, handoff. Eventrix cobre execução operacional. Existem componentes/schemas/snapshots que sugerem integração (`eventrix_inventory_*`, `product_inventory_requirements`, `proposal_inventory_demand_snapshots`), mas **integração operacional não comprovada** — continua `PROPOSTO` / `NECESSITA AUDITORIA` (Blueprint 1).

## 29. Módulos internos e experimentais

Ver Seção 11. Nenhuma exceção. Sprint 0.3 deve executar a ocultação (guard de entitlement + remoção do menu + rota fallback 404).

## 30. Landing e claims comerciais

Bloqueador P0 registrado no Blueprint 21. Auditoria detalhada deferida para NOID-GTM. Nenhum claim de segurança/AI/automação/integração pode permanecer sem evidência antes da primeira demo externa.

## 31. Risco do repositório público

Evidência coletada em modo read-only:

- `.env` está **versionado** (`git ls-files .env` retorna o arquivo).
- Conteúdo do `.env`: apenas variáveis `VITE_*` publishable (Firebase config e Supabase URL/anon key). Nenhum `service_role` ou secret privado localizado.
- `.gitignore` **não** contém regra para `.env` — regra recomendada mesmo em ambiente Lovable.
- Nenhum `service_role` hardcoded em `src/`; único match legítimo em `src/integrations/supabase/client.ts` é uma checagem defensiva.
- Nenhum dump de dados versionado localizado em `database/dumps/` (apenas DDL estrutural).
- Visibilidade real do repositório GitHub **não** foi verificada nesta sprint — exige decisão executiva.

**Recomendação:** decisão executiva sobre visibilidade + regra em `.gitignore` + auditoria forense do histórico Git (Sprint NOID-SECURITY). Não expor secrets encontrados neste documento.

## 32. Dependências externas

Firebase (opcional/mock), Supabase (Lovable Cloud), OpenAI (memórias core), Slack (aprovações), Apollo/Firecrawl/ExpoFP (uso interno LEGAL — deve ficar oculto para Fundador), Google Places, Umma ERP, Human ERP.

## 33. Critérios para o primeiro cliente fundador

Ver Seção 14 do backlog para o checklist objetivo (Sim / Sim com configuração / Sim após P0 / Não / Não comprovado).

## 34. Critérios para criação do NOID Events Template

O template pode ser materializado **após** resolver os P0 e conter:

- Pipelines Eventos (Pré-vendas, Vendas, Onboarding).
- Framework de qualificação vertical (`qualification_frameworks`).
- `loss_reasons` verticais.
- Campos customizados verticais (`custom_fields`) para Empresa e Oportunidade.
- Papéis e permissões padrão.
- Automações homologadas (regras seguras, idempotentes).
- Dashboards seguros em org limpa.
- Layout de proposta Eventos.
- Módulos internos ocultos por default.
- Dados sintéticos mínimos para demo (opcional).

O template **não** deve incorporar: itens CORRIGIR P0, itens FUTURO, itens OCULTAR, internos LEGAL, experimentais, ou capacidades `NECESSITA AUDITORIA` com risco alto.

## 35. Recomendação final

**GO CONDICIONAL.**

Justificativa: o NOID tem infraestrutura suficiente (RLS 100%, hardening DEFINER, SSoT declarada, tokens seguros de proposta, memberships/papéis) para receber cliente externo **após** resolver os 11 bloqueadores P0 da Seção 13. Nenhum P0 exige refatoração estrutural; todos podem ser resolvidos com configuração, ocultação, aplicação das migrations staged e execução da suíte em staging.

## 36. Próximas fases

1. **NOID-SECURITY** — provisionar Supabase de staging, executar suíte de isolamento, aplicar migrations staged de storage, decidir visibilidade do repositório, rotacionar se necessário.
2. **NOID-VERTICAL 0.3A** — Correções P0 do Revenue Core (signup gate, aceite de convite, onboarding assistido, billing Fundador, importação reproduzida).
3. **NOID-VERTICAL 0.3 — Events Template** — pipelines, framework, campos, motivos, automações, ocultação de módulos internos, guard de entitlement.
4. **NOID-GTM** — landing sem claims não comprovados, oferta Fundadores, termos/privacidade/DPA/SLA.

## 37. Apêndice de evidências

- `docs/product/noid-revenueos-for-events-product-blueprint-v1.md` — fonte executiva.
- `docs/security/phase1-rls-audit.md` e `rls-audit-matrix.csv`.
- `docs/security/phase1-5-linter-triage.md` e `linter-warning-matrix.csv`.
- `docs/security/phase2-tenant-isolation.md` e `phase2-approval-decisions.md`.
- `docs/security/storage-inventory.md`, `storage-classification.csv`, `storage-impact-analysis.md`, `storage-migration-plan.md`, `storage-rollback-plan.md`, `storage-post-migration-checklist.md`.
- `docs/security/staging-provisioning-guide.md`, `scripts/staging-smoke-tests.sh`.
- `src/App.tsx` (rotas), `src/test/security/tenant-isolation/**` (suíte).
- Supabase catalog: 413 tabelas, 1049 policies, 379 funções DEFINER, 66 views, 6 buckets, 27 policies `USING(true)`.
- Commit auditado `4115734591d0d19c078f39f2b2542a77e7a5e936`.
