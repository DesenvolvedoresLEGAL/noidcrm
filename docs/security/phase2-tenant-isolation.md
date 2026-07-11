# Fase 2 — Suíte de Isolamento Multi-Tenant

**Localização:** `src/test/security/tenant-isolation/`
**Execução manual:** `bunx vitest run src/test/security/tenant-isolation`
**Execução em CI:** `.github/workflows/tenant-isolation.yml` (opt-in via secret + var de repo)

## Arquitetura da suíte

- Fixture cria e destrói 2 orgs + 12 usuários por run em **staging isolado**.
- Suíte pula tudo por padrão se `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` e
  `TEST_SUPABASE_SERVICE_ROLE_KEY` não estiverem definidas.
- Guarda anti-produção: se `TEST_SUPABASE_URL` for o mesmo host do
  `VITE_SUPABASE_URL`, a suíte aborta antes de criar qualquer fixture.
- Fixtures usam prefixo `iso-<runId>-*` e são destruídas em `afterAll`.
- Nenhuma migration de fixture é aplicada em produção.

## Escopo (7 arquivos de teste)

| Arquivo | O que valida |
|---|---|
| `data-api.test.ts` | Tabelas críticas: usuário de ORG_A nunca lê linhas de ORG_B via Data API |
| `roles.test.ts` | Matriz de papéis (owner/admin/manager/sales/viewer/cs) segue ADR-002; bloqueio de escalação |
| `rpcs.test.ts` | RPCs com `p_organization_id` rejeitam ID forjado; anon não pode chamar RPC autenticada |
| `views.test.ts` | As 10 views corrigidas na Fase 1 não expõem dados cross-org |
| `storage.test.ts` | Buckets multi-tenant (`opportunity-files`, `proposal-pdfs`) isolados |
| `realtime.test.ts` | Assinaturas realtime não recebem mudanças cross-org |
| `invite-switch.test.ts` | Membro em 2 orgs enxerga apenas dados do org ativo |

## Habilitação em CI

1. Criar projeto Supabase **exclusivo para testes**.
2. No repositório, adicionar:
   - Secret `TEST_SUPABASE_URL`
   - Secret `TEST_SUPABASE_ANON_KEY`
   - Secret `TEST_SUPABASE_SERVICE_ROLE_KEY`
   - Variable `TENANT_ISOLATION_ENABLED = "true"`
3. Aplicar as mesmas migrations de produção no projeto de teste.
4. Rodar o workflow manualmente e conferir 100% verde antes de habilitar o cron diário.

## Restrições respeitadas

- ✅ Nenhuma fixture persistente em produção
- ✅ Usuários de teste criados apenas via `auth.admin` em staging
- ✅ Teardown obrigatório em `afterAll`
- ✅ Guarda anti-produção dupla (env vazio + comparação de host)
- ✅ Zero dado ou usuário de teste em produção
