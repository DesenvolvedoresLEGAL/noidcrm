# NOID Security — Single-Project Security Model v1

**Sprint:** NOID-SECURITY 1.2
**Escopo:** modelo de segurança operacional para o cenário em que o NOID
RevenueOS opera dentro de **um único projeto Lovable Cloud** (ref
`urihdqturaebhiefwjnw`), sem staging externo, atendendo simultaneamente:
produção real da LEGAL, banco de dados, Auth, Storage, Edge Functions e
validações sintéticas de segurança.

Este documento **não** substitui a homologação em ambiente separado. Ele
formaliza como reduzir riscos de forma responsável, mensurável e reversível
dentro da limitação atual.

## 1. Contexto Lovable Cloud

- Um único projeto Supabase gerenciado.
- Preview e "live" compartilham o mesmo backend.
- Não há mecanismo nativo, nesta fase, para clonar dados/policies para
  staging paralelo dentro do plano operacional aprovado.
- As sprints NOID-SECURITY 1.0 e 1.1 documentaram que provisionamento de
  staging externo depende de decisão fora do sandbox do agente.
- Decisão executiva: prosseguir com hardening controlado no projeto único.

## 2. Baseline read-only (Fase 0)

Data/horário UTC: `2026-07-20T16:12:41Z`
Branch: `edit/edt-9e611c89-ba86-421a-89e7-cd754409e6c5`
Commit-base: `a0bfa343`

Contagens (mascaradas, sem PII):

| Superfície | Valor |
| --- | --- |
| Organizações | 8 |
| Memberships | 32 |
| Profiles | 38 |
| User roles | 45 |
| Oportunidades ativas (deleted_at IS NULL) | 2.202 |
| Propostas | 811 |
| Atividades | 4.480 |
| Accounts | 4.876 |
| Contatos | 1.729 |
| Convites | 2 |
| Tabelas em `public` | 413 |
| Tabelas com RLS habilitada | 413 (100%) |
| Policies em `public` | 1.049 |
| Policies com `USING (true)` | 23 |

Buckets:

| Bucket | Público |
| --- | --- |
| avatars | sim |
| opportunity-files | não |
| organization-logos | sim |
| product-images | sim |
| proposal-layouts | sim |
| proposal-pdfs | não |

## 3. Limitações conhecidas

- Ausência de staging separado → validação dinâmica ocorre no mesmo backend
  da operação real.
- Rollback de policies/RPCs depende de migrations aditivas e reversíveis;
  não há "reset seguro".
- Backup automático depende do plano Lovable Cloud; não há evidência de
  restore point-in-time gerenciável pelo agente.
- Testes destrutivos são proibidos.

## 4. Princípio de mudança mínima

1. Uma superfície por vez.
2. Aditivo antes de restritivo.
3. Reversível antes de definitivo.
4. Sintético antes de real.
5. Observação após cada mudança.

## 5. Classificação VERDE / AMARELO / VERMELHO

Referência: seção "Classificação obrigatória das mudanças" do briefing
NOID-SECURITY 1.2. Resumo operacional:

- **VERDE** — auditoria read-only, guards de rota, feature flags,
  ocultação de módulos, criação de organizações/usuários sintéticos com
  prefixo `SECURITY_TEST_*`, novos buckets privados, novas tabelas/colunas
  auxiliares com default seguro, testes automatizados.
- **AMARELO** — novas policies, ajuste cirúrgico de policy existente,
  alteração de RPC ou Edge Function, novo trigger de auditoria, migração
  aditiva, enforcement progressivo de `pdf_url`, ajustes de convite.
  Exige protocolo formal (ver `single-project-change-protocol-v1.md`).
- **VERMELHO** — DROP TABLE/COLUMN, TRUNCATE, reset de banco/Auth,
  privatização simultânea de todos os buckets, reescrita ampla de RLS em
  lote, migração massiva sem rollback, force push. **Proibido nesta
  sprint.**

## 6. Processo de aprovação e rollback

- Toda mudança AMARELA passa pelo template do protocolo de mudança.
- Rollback é escrito **antes** da aplicação.
- Aplicação idempotente.
- Smoke test imediato + janela de observação.
- Reversão automática se qualquer regressão for detectada na operação real.

## 7. Uso de fixtures sintéticas

- Duas organizações: `NOID_SECURITY_ORG_A`, `NOID_SECURITY_ORG_B`.
- Prefixo `SECURITY_TEST_*` em todos os dados sintéticos.
- Domínio de e-mail: `example.com` (ou contas sintéticas controladas pela
  HUMANOID caso o Auth exija entrega real).
- Nenhum dado real é usado como fixture.
- Cleanup rastreado no `single-project-cleanup-runbook-v1.md`.

## 8. Regras específicas por superfície

### 8.1 Storage
- Novos fluxos sensíveis → bucket privado desde a origem.
- Bucket legado preservado; migração histórica somente em sprints futuras.
- Signed URLs geradas server-side, com TTL curto.
- `pdf_url` migrado em duas fases: AUDIT → ENFORCEMENT.

### 8.2 Auth
- Nenhum reset em massa.
- Signup público: auditado nesta sprint; correção definitiva pode
  permanecer na NOID-VERTICAL 0.3A, com risco explícito registrado.

### 8.3 RLS
- Revisão prioritária das ~23 tabelas do primeiro ciclo (organizações,
  memberships, roles, opportunities, proposals, etc.).
- Correção somente após reprodução com fixtures sintéticas.

### 8.4 Edge Functions
- Foco em funções chamadas por Revenue Core, propostas, convites,
  onboarding, billing, trial, importação, notificações.
- JWT + membership + org + role obrigatórios.
- Sem service role no frontend.

### 8.5 Publicações
- Nenhum publish automático sem validação humana durante a sprint.

## 9. Limite do programa Clientes Fundadores

Enquanto o projeto for único:

- Onboarding assistido pela HUMANOID.
- Número controlado de tenants externos.
- Módulos internos ocultos em três camadas (menu, rota, server-side).
- Nenhum self-service irrestrito.

## 10. Risco residual

Formalmente aceito no `single-project-residual-risk-acceptance-v1.md`:

> O NOID opera temporariamente em ambiente Lovable Cloud único, sem
> separação técnica entre desenvolvimento e produção. Alterações de
> backend são tratadas como alterações de produção, utilizando mudanças
> pequenas, aditivas, reversíveis, testadas com dados sintéticos e
> acompanhadas por protocolo de rollback.

## 11. Plano futuro

- Provisionamento de projeto Supabase de staging externo.
- Separação de ambientes (dev / staging / prod).
- Migração histórica de PDFs para bucket privado.
- Auditoria completa das 413 tabelas.
- Homologação dinâmica end-to-end conforme NOID-SECURITY 1.1 previa.

## 12. Documentos vinculados

- `single-project-change-protocol-v1.md`
- `single-project-tenant-test-report-v1.md`
- `single-project-storage-test-report-v1.md`
- `single-project-invitation-test-report-v1.md`
- `single-project-residual-risk-acceptance-v1.md`
- `single-project-security-gate-v1.md`
- `single-project-cleanup-runbook-v1.md`
