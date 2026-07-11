# Fase 1 — Auditoria estática de RLS/Policies/Views

**Data:** 2026-07-11
**Escopo:** schema `public`
**Fonte:** consultas read-only em `pg_class`, `pg_policies`, `information_schema`, `pg_views`, `pg_proc`
**Matriz completa:** [`rls-audit-matrix.csv`](./rls-audit-matrix.csv) (413 tabelas)

---

## Resumo executivo

| Verificação | Resultado |
|---|---|
| Tabelas em `public` sem RLS habilitado | **0** ✅ |
| Tabelas com zero policies | **0** ✅ |
| Tabelas com `organization_id` expostas ao `anon` via SELECT | **0** ✅ |
| Funções `SECURITY DEFINER` sem `search_path` fixado | **0** ✅ |
| Policies com `USING (true)` para `authenticated`/`public` | **4** (revisadas — 3 catálogos globais + 1 endpoint discovery) |
| Views/materialized views com `security_invoker=off` acessíveis a `authenticated` | **10** 🔴 **BLOQUEADOR** |

---

## 1.1 Tabelas & RLS

413 tabelas `public.*`. Todas com `rls_enabled=true` e ≥1 policy. Nenhum GRANT `SELECT` para `anon` sobre tabela com `organization_id`. Matriz por tabela em CSV anexo (colunas: `relname, rls_enabled, force_rls, has_organization_id, has_user_col, policies, cmds, anon_select, authenticated_grant, service_role_grant`).

## 1.2 Policies permissivas

Policies `USING (true)` fora de `service_role`:

| Tabela | Policy | Roles | Justificativa |
|---|---|---|---|
| `disposable_email_domains` | Anyone can read | public | Lookup global de domínios descartáveis. **OK.** |
| `plans` | Publicly readable | public | Catálogo público de planos. **OK.** |
| `plan_entitlements` | Publicly readable | public | Catálogo público. **OK.** |
| `apollo_endpoint_discovery` | apollo_endpoint_discovery_read_all | authenticated | Tabela sem `organization_id` — catálogo global de endpoints descobertos. **OK.** |

Demais 20 policies `USING(true)` são exclusivas de `service_role` (que já bypassa RLS por design). **OK.**

## 1.3 Funções SECURITY DEFINER

Todas as funções `prosecdef=true` em `public` possuem `SET search_path = public` no `proconfig`. **OK.**

## 1.4 Views — 🔴 BLOQUEADOR CRÍTICO

Views/materializadas sem `security_invoker=on` **e** com GRANT `SELECT` para `authenticated`/`anon` executam a query como o **owner** da view, ignorando o RLS das tabelas-base. Isso permite que qualquer usuário autenticado (de qualquer organização) leia dados de todas as organizações via essas views.

**10 views afetadas** (todas expõem `organization_id` e leem de `opportunities`/`proposals`/`activities`/`kairos_*`, que são multi-tenant):

- `commercial_won_revenue_view`
- `commercial_won_revenue_historical_view`
- `commission_eligibility_view`
- `unified_timeline`
- `v_opportunity_accepted_proposal_v2`
- `v_proposals_normalized_v2`
- `v_unified_won_revenue_v2`
- `kairos_apollo_performance_summary`
- `kairos_gtm_performance_summary`
- `kairos_revenue_attribution_summary`

**Fix aplicado (migration):** `ALTER VIEW ... SET (security_invoker = on)` em todas as 10 views. Após o fix, o RLS das tabelas-base passa a valer e cada usuário vê apenas dados da própria organização.

`mv_notification_admin_metrics` (materialized view) não tem GRANT para `authenticated`/`anon` — só `service_role`. **OK.**

Views com `security_invoker=on` (57): auditadas — todas confiam no RLS das tabelas-base. **OK.**

## 1.5 GRANTs em tabelas com `organization_id`

Nenhuma tabela com `organization_id` concede `SELECT` a `anon`. **OK.**

---

## Bloqueadores encontrados

1. 🔴 **10 views expondo dados cross-org** — corrigido via migration `2026-07-11 fix view security_invoker`.

## Próxima fase

Fase 2 — Suíte automatizada de isolamento em `src/test/security/tenant-isolation/`.
