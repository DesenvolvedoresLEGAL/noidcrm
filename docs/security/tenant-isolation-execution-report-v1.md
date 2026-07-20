# Tenant Isolation Execution Report v1

**Sprint:** NOID-SECURITY 1.0 — Fases 2–7
**Status:** **NÃO EXECUTADO — bloqueado por ausência de projeto Supabase de staging.**

## 1. Escopo

A suíte automatizada em `src/test/security/tenant-isolation/**` foi construída
na Fase 2 (sprint anterior) e cobre:

- `fixture.ts` — cria 2 organizações e 12 usuários sintéticos em um projeto
  Supabase **exclusivo de staging** (via `TEST_SUPABASE_URL`,
  `TEST_SUPABASE_SERVICE_ROLE_KEY`, `TEST_SUPABASE_ANON_KEY`), com guarda
  anti-produção comparando o host de teste ao host de `VITE_SUPABASE_URL`.
- `data-api.test.ts` — SELECT cross-org em 8 tabelas críticas.
- `roles.test.ts` — matriz de papéis (owner/admin/manager/sales/viewer/cs)
  contra `can_view_all` e tentativas de escalada em `organization_members`.
- `rpcs.test.ts` — RPCs `get_user_organization_id`,
  `calculate_forecast_accuracy_v2`, `get_forecast_snapshots_v2`,
  `get_forecast_v2_health_check`, `get_org_seat_metrics` recebendo
  `p_organization_id` forjado.
- `views.test.ts` — 10 views de Revenue Core (`commercial_won_revenue_view`,
  `commission_eligibility_view`, `unified_timeline`,
  `v_unified_won_revenue_v2`, `kairos_apollo_performance_summary`, etc.).
- `realtime.test.ts` — canal `postgres_changes` de ORG_B não recebe INSERT em
  `opportunities` da ORG_A.
- `invite-switch.test.ts` — usuário dual-org lê apenas o org ativo.

## 2. Motivo do bloqueio

O projeto Supabase de staging **não foi provisionado até o momento desta
sprint**. As variáveis `TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY` e
`TEST_SUPABASE_SERVICE_ROLE_KEY` não estão configuradas no sandbox Lovable e
o agente **não pode criar um projeto Supabase novo** — a operação exige
console humano na conta Supabase da organização.

O prompt desta sprint é explícito:

> Caso o projeto de staging ainda não exista e a ferramenta não possa criá-lo:
> - Não utilizar produção como fallback.
> - Produzir instrução humana de provisionamento.
> - Marcar a sprint como bloqueada para execução dos testes.

Portanto, **nenhuma migration foi aplicada, nenhuma organização sintética foi
criada e nenhum teste da suíte foi executado nesta sprint**. Em vitest local,
a suíte se auto-skipa via `fixtureEnabled()`.

## 3. Guardas anti-produção — verificadas

Antes de qualquer execução futura, as seguintes guardas já estão no código e
foram revisadas:

| Local | Guarda | Verificado |
| --- | --- | --- |
| `src/test/security/tenant-isolation/fixture.ts` | Compara `new URL(TEST_SUPABASE_URL).host` com `new URL(VITE_SUPABASE_URL).host` e aborta se iguais | ✅ |
| `scripts/apply-migrations-staging.sh` | Aborta se `TEST_SUPABASE_URL` ou `TEST_SUPABASE_DB_URL` contêm `urihdqturaebhiefwjnw` | ✅ |
| `scripts/staging-smoke-tests.sh` | Mesma guarda | ✅ (revisar antes do primeiro uso) |
| `.github/workflows/tenant-isolation.yml` | Compara host `TEST_SUPABASE_URL` vs `VITE_SUPABASE_URL` e aborta se iguais; só roda quando `vars.TENANT_ISOLATION_ENABLED == 'true'` | ✅ |

Reforço adicional aplicado nesta sprint: `.env.staging.example` documenta
`PROD_SUPABASE_PROJECT_REF=urihdqturaebhiefwjnw` como valor sentinela para
qualquer futuro comparador.

## 4. Resultados por dimensão

| Dimensão | Total planejado | Executado | Aprovado | Reprovado |
| --- | --- | --- | --- | --- |
| Data API SELECT cross-org | 8 tabelas críticas + varredura genérica | 0 | 0 | 0 |
| Roles (6 papéis × 2 orgs) | 12 asserts | 0 | 0 | 0 |
| RPCs cross-org | 4 RPCs + anon | 0 | 0 | 0 |
| Views Revenue Core | 10 views | 0 | 0 | 0 |
| Realtime cross-org | 1 canal | 0 | 0 | 0 |
| Convite / switch de org | 1 cenário | 0 | 0 | 0 |
| **Total** | **≥ 36** | **0** | **0** | **0** |

Vazamentos encontrados: **N/A — suíte não executada**.

## 5. Policies `USING (true)` e SECURITY DEFINER

Também **não classificadas em profundidade nesta sprint**, pois a metodologia
aprovada exige reproduzir cada policy contra as fixtures multi-tenant em
staging. O inventário estático permanece em `docs/security/phase1-rls-audit.md`
e `docs/security/linter-warning-matrix.csv`.

Ação humana para desbloquear:

1. Provisionar projeto Supabase de staging conforme
   `docs/security/staging-provisioning-guide.md`.
2. Popular variáveis no GitHub Environment `staging` e localmente em
   `.env.staging` (nunca commitado).
3. Rodar `scripts/apply-migrations-staging.sh` seguido de
   `scripts/staging-smoke-tests.sh`.
4. Executar `bunx vitest run src/test/security/tenant-isolation --reporter=verbose`.
5. Preencher este relatório com resultados reais e atualizar
   `security-findings-v1.csv`.

## 6. Conclusão parcial

- **P0-01 (isolamento multi-tenant em staging):** permanece **ABERTO**.
- Nenhum vazamento cross-tenant foi comprovado — mas também nenhum foi
  desmentido em execução real. A auditoria estática da Fase 1 (10 views
  corrigidas com `security_invoker=on`) segue válida como mitigação parcial,
  não substitui homologação.
