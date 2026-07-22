# Post-GO Hardening Backlog v1

**Emitido junto ao:** `SECURITY GO CONDICIONAL — PROJETO ÚNICO` (NSEC-1.2-CHG-030)
**Data (UTC):** 2026-07-22

Este backlog organiza as ações necessárias para elevar o NOID de
`SECURITY GO CONDICIONAL — PROJETO ÚNICO` para um estado que permita
escala externa. Nenhum item aqui foi executado nesta CHG — todos ficam
aguardando autorização explícita futura (mudanças YELLOW ou ação
humana externa ao sandbox).

## Legenda

- **Owner:** HUMANOID (ação humana externa) ou Agente (mudança YELLOW).
- **Bloqueia escala externa:** sim = impede onboarding massivo /
  operação sem guardrails; não = melhoria contínua.
- **Estado inicial:** `PENDING` para todos.

---

## P0 — AÇÃO HUMANA PRIORITÁRIA

### P0.1 — SEC-001: Repositório privado ou aceite executivo
- **Finding:** SEC-001 (HIGH / OPEN)
- **Owner:** HUMANOID
- **Condição de aceite:** Repositório GitHub marcado como privado
  **ou** aceite executivo formal registrado em documento assinado.
- **Impacto:** Exposição de estrutura interna e reconhecimento por
  terceiros.
- **Bloqueia escala externa:** sim
- **Estado:** PENDING

### P0.2 — SEC-002: Remover `.env` do tracking
- **Finding:** SEC-002 (HIGH / OPEN)
- **Owner:** HUMANOID
- **Condição de aceite:** `git rm --cached .env` executado em checkout
  local + `.gitignore` atualizado + `.env.example` sanitizado mantido.
- **Impacto:** Higiene de repositório; risco baixo (apenas
  publishable), mas mistura ambientes.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

### P0.3 — SEC-004: Scan full-history do Git
- **Finding:** SEC-004 (MEDIUM / OPEN)
- **Owner:** HUMANOID
- **Condição de aceite:** `gitleaks --log-opts=--all` (ou
  `trufflehog`) executado em runner confiável sem hits ativos;
  qualquer hit rotacionado.
- **Impacto:** Secret antigo em blob histórico continua acessível
  enquanto repositório for público.
- **Bloqueia escala externa:** sim (enquanto SEC-001 estiver aberto)
- **Estado:** PENDING

### P0.4 — Confirmar principals de evidência sem acesso funcional
- **Finding:** Guardrail CHG-029 / CHG-030
- **Owner:** HUMANOID
- **Condição de aceite:** Revisão trimestral confirmando que Owner A e
  Owner B seguem sem `organization_members`, sem `user_roles` e nunca
  emitiram JWT em produção.
- **Impacto:** Preserva integridade da evidence retention.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

---

## P1 — ANTES DE ESCALA EXTERNA

### P1.1 — SEC-005: Staging independente
- **Finding:** SEC-005 (CRITICAL / BLOCKED)
- **Owner:** HUMANOID
- **Condição de aceite:** Projeto Supabase de staging provisionado,
  secrets `TEST_SUPABASE_*` cadastrados no GitHub Environment
  `staging`, suíte `src/test/security/tenant-isolation` 100% verde.
- **Impacto:** Sem staging não é possível homologação end-to-end nem
  elevação para GO irrestrito.
- **Bloqueia escala externa:** sim
- **Estado:** PENDING

### P1.2 — SEC-006: Storage completo e `proposal-pdfs`
- **Finding:** SEC-006 (HIGH / BLOCKED)
- **Owner:** Agente (YELLOW) após P1.1
- **Condição de aceite:** Migrations `supabase/migrations-staged/storage/01…07b`
  aplicadas em staging, buckets sensíveis privados, signed URLs
  homologadas, `pdf_url` migrado para path tenant-aware.
- **Impacto:** Bucket `proposal-pdfs` pode expor PDFs; fluxo público
  sem signed URL curta.
- **Bloqueia escala externa:** sim
- **Estado:** PENDING

### P1.3 — SEC-007: Invitations end-to-end
- **Finding:** SEC-007 (HIGH / BLOCKED)
- **Owner:** Agente (YELLOW) após P1.1
- **Condição de aceite:** Cenários dinâmicos de aceite (TTL, single-use,
  replay, concorrência, cross-org, role escalation) executados em
  staging com 100% aprovado.
- **Impacto:** Onboarding externo automatizado inseguro.
- **Bloqueia escala externa:** sim
- **Estado:** PENDING

### P1.4 — SEC-008: Classificar policies `USING(true)`
- **Finding:** SEC-008 (MEDIUM / OPEN)
- **Owner:** Agente (GREEN análise + YELLOW ajustes)
- **Condição de aceite:** 27 policies classificadas em
  LEGITIMA_SERVICE_ROLE / LEGITIMA_GLOBAL_READ /
  LEGITIMA_PLATFORM_ADMIN / RISCO / CORRIGIR, com justificativa
  individual registrada.
- **Impacto:** Policy com `USING(true)` pode permitir escrita
  indevida.
- **Bloqueia escala externa:** parcial
- **Estado:** PENDING

### P1.5 — SEC-009: SECURITY DEFINER crítico
- **Finding:** SEC-009 (MEDIUM / OPEN)
- **Owner:** Agente (YELLOW por função)
- **Condição de aceite:** Todas as funções `SECURITY DEFINER` chamadas
  por frontend/edge/views Revenue Core auditadas com `search_path`
  fixo e validação de membership.
- **Impacto:** Função com `search_path` mutável pode ser sequestrada.
- **Bloqueia escala externa:** parcial
- **Estado:** PENDING

---

## P2 — HARDENING FUNCIONAL

### P2.1 — Matriz manager/sales/cs (UPDATE completo)
- **Finding:** Superfície não homologada (accounts/contacts/opportunities)
- **Owner:** Agente (YELLOW após P1.1)
- **Condição de aceite:** Matriz completa por papel executada em
  staging (não em produção).
- **Bloqueia escala externa:** não
- **Estado:** PENDING

### P2.2 — Activities/proposals por papel
- **Finding:** Superfície não homologada
- **Owner:** Agente (YELLOW após P1.1)
- **Condição de aceite:** Matriz por papel em staging.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

### P2.3 — UPDATE/DELETE activities/proposals
- **Finding:** Superfície não homologada
- **Owner:** Agente (YELLOW após P1.1)
- **Condição de aceite:** Cenários same-org e cross-tenant homologados
  em staging.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

### P2.4 — Relações adicionais de activities
- **Finding:** Superfície não homologada
- **Owner:** Agente (YELLOW após P1.1)
- **Condição de aceite:** Vínculos com contact, account, deal, user
  homologados tenant-aware.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

### P2.5 — Propostas completas
- **Finding:** Superfície não homologada (PDF, envio, assinatura,
  aceite, cobrança, link público)
- **Owner:** Agente (YELLOW após P1.1 e P1.2)
- **Condição de aceite:** Fluxos completos homologados em staging.
- **Bloqueia escala externa:** sim (para uso externo do fluxo PDF)
- **Estado:** PENDING

### P2.6 — Revisão periódica de policies e buckets
- **Owner:** HUMANOID + Agente (GREEN mensal)
- **Condição de aceite:** Revisão trimestral registrada; qualquer
  regressão dispara mudança YELLOW.
- **Bloqueia escala externa:** não
- **Estado:** PENDING

---

## Regras gerais

- Nenhum item deste backlog pode ser executado sem autorização
  explícita da HUMANOID.
- Toda ação YELLOW segue o protocolo em
  `docs/security/single-project-change-protocol-v1.md`.
- Progresso deve ser registrado em novos documentos versionados; este
  backlog permanece imutável como fotografia da emissão do GO.
