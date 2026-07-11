# Suíte de Isolamento Multi-Tenant

Suíte de testes end-to-end que valida isolamento entre organizações do NOID RevenueOS
em um ambiente **isolado de teste/staging**. Nunca rode contra produção.

## Pré-requisitos

Definir as variáveis de ambiente apontando para um projeto Supabase de teste:

```bash
export TEST_SUPABASE_URL="https://<staging-ref>.supabase.co"
export TEST_SUPABASE_ANON_KEY="eyJ..."
export TEST_SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

Guardas anti-produção:
- Se qualquer uma das 3 variáveis estiver ausente, **toda a suíte é pulada**.
- Se `TEST_SUPABASE_URL` coincidir com `VITE_SUPABASE_URL` (host igual), a suíte
  aborta imediatamente antes de criar qualquer fixture.

## Execução

```bash
bunx vitest run src/test/security/tenant-isolation
```

## O que a suíte cobre

| Arquivo | Cobertura |
|---|---|
| `data-api.test.ts` | Cross-org via Data API em tabelas críticas |
| `roles.test.ts` | Matriz de papéis (owner/admin/manager/sales/viewer/cs) |
| `rpcs.test.ts` | RPCs privilegiadas rejeitam `organization_id` forjado |
| `views.test.ts` | 10 views/reports não expõem dados cross-org |
| `storage.test.ts` | Buckets `opportunity-files` e `proposal-pdfs` |
| `realtime.test.ts` | Assinaturas realtime não recebem mudanças cross-org |
| `invite-switch.test.ts` | Membro em 2 orgs só vê dados do org ativo |

## Fixture

- 2 organizações (`ORG_A`, `ORG_B`) com slug `iso-<runId>-<a|b>`
- 12 usuários (6 papéis × 2 orgs) com emails `iso-<runId>-<A|B>-<role>@example.test`
- Criados via `auth.admin.createUser` com email já confirmado
- Login individual gera JWT para cada usuário; cada teste usa o client autenticado adequado
- `teardownFixture` roda em `afterAll` e apaga: membros, usuários auth, organizações

## Falha do teardown

Se o teardown falhar por qualquer motivo (rede, timeout), sobra lixo no staging com
prefixo `iso-`. Para limpar manualmente:

```sql
delete from public.organization_members where organization_id in (
  select id from public.organizations where slug like 'iso-%'
);
delete from public.organizations where slug like 'iso-%';
-- e no auth.users (via admin API): user.email like 'iso-%@example.test'
```

## Nunca em produção

A suíte foi projetada para exigir opt-in explícito via env. O fluxo padrão de CI
(sem as env vars definidas) pula todos os testes sem falhar. **Só habilite as env
vars em jobs de CI que apontem para um Supabase dedicado a testes.**
