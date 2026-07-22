# NSEC-1.2-CHG-027 — Final Residual Smoke (Activities + Proposals + Storage)

**Status:** `FINAL RESIDUAL SMOKE BLOCKED`
**Data:** 2026-07-22
**Escopo:** smoke read+dynamic mínimo em `public.activities`, `public.proposals` e bucket `opportunity-files`.

## 1. Contexto e ponto de corte
Após CHG-026 (`CRITICAL UPDATE/DELETE HOMOLOGADO`), este smoke visa apenas identificar bloqueadores de GO em três superfícies residuais. Não homologa matriz por papel, UPDATE/DELETE dessas superfícies, envio, PDF, assinatura, aceite, workflow, automação ou anexos reais.

## 2. Activities — pre-flight
- RLS habilitada (`relrowsecurity=true`).
- 4 policies: SELECT (visibility), INSERT (`organization_id = get_user_organization_id()`), UPDATE, DELETE (todas escopadas por `organization_id`).
- Colunas NOT NULL sem default: `owner_user_id`, `type`, `title`, `organization_id`. Payload mínimo neutro: `type='note'`, `title=<marker>`, `status='pending'`, `is_automated=false`, `organization_id`, `opportunity_id`, `owner_user_id`.
- 16 triggers. Inspecionadas as 14 funções expostas ao INSERT: **nenhuma usa `pg_net`, `pg_notify` ou `extensions.http`** — todas gravam em tabelas internas (interactions, filas de score, indicators, workflow). Totalmente transacional. Rollback seguro.
- Sem trigger de validação same-tenant entre `organization_id` e `opportunity_id`.

## 3. Proposals — pre-flight
- RLS habilitada.
- 4 policies: SELECT (`user_can_access_proposal`), INSERT (`organization_id IN (SELECT ... FROM organization_members WHERE user_id=auth.uid() AND status='active')`), UPDATE, DELETE (admins).
- Colunas NOT NULL: `opportunity_id`, `organization_id`, `status` (default `'draft'`) e vários numéricos com default 0. Payload neutro: `organization_id`, `opportunity_id`, `status='draft'`, `content=jsonb_build_object('marker', <marker>)`.
- 22 triggers; das 13 disparadas em INSERT (AFTER/BEFORE): nenhuma usa `pg_net`, `pg_notify` ou `extensions.http`. Rollback seguro.
- Sem trigger de validação same-tenant entre `organization_id` e `opportunity_id`.

## 4. Storage — pre-flight
Buckets:

| Bucket | Público | Uso |
|---|---|---|
| `avatars` | público | uploads de avatar (imagem pública por design) |
| `organization-logos` | público | logos organizacionais públicos por design |
| `product-images` | público | mídia pública de produtos |
| `proposal-layouts` | público | assets de template público (risco residual documentado em sprint anterior) |
| `opportunity-files` | **privado** | anexos internos por oportunidade |
| `proposal-pdfs` | **privado** | PDFs de propostas |

Policies do bucket privado `opportunity-files`:
- SELECT/INSERT/DELETE exigem `(storage.foldername(name))[1] IN (organizations do caller)`.
- Path canônico: `<organization_id>/<arquivo>`.
- Tenant-scoped em todas as três operações.

Bucket selecionado para smoke: `opportunity-files`.

## 5. Ferramentas temporárias criadas
- `public.nsec12_probe_activity_insert_smoke(uuid,uuid,text)` — SECURITY INVOKER, `search_path=public`, whitelist Owner A/B + Org A/B + Opp A/B + prefixo, rollback interno via `RAISE 'NSEC12_ROLLBACK'`.
- `public.nsec12_probe_proposal_insert_smoke(uuid,uuid,text)` — idêntico, payload draft.
- Edge Function `nsec12-canary-027` — emite JWTs de Owner A/B via admin API + password reset descartável, chama as duas RPCs, executa smoke de Storage.
- Nenhuma nova policy, trigger ou schema. Nenhuma fixture nova.

## 6. Resultado dos 12 cenários

### Activities
| Probe | Caller | Org | Opp | Esperado | Obtido |
|---|---|---|---|---|---|
| A1 | Owner A | Org A | Opp A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A2 | Owner B | Org B | Opp B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A3 | Owner A | Org A | Opp B | BLOCKED | ❌ ALLOWED_ROLLED_BACK |
| A4 | Owner B | Org B | Opp A | BLOCKED | ❌ ALLOWED_ROLLED_BACK |

### Proposals
| Probe | Caller | Org | Opp | Esperado | Obtido |
|---|---|---|---|---|---|
| P1 | Owner A | Org A | Opp A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| P2 | Owner B | Org B | Opp B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| P3 | Owner A | Org A | Opp B | BLOCKED | ❌ ALLOWED_ROLLED_BACK |
| P4 | Owner B | Org B | Opp A | BLOCKED | ❌ ALLOWED_ROLLED_BACK |

### Storage (bucket `opportunity-files`)
| Probe | Ação | Esperado | Obtido |
|---|---|---|---|
| S1 | Owner A write→read→delete→read no path `<org_a>/…` | ALLOWED_AND_CLEANED | ✅ write=200, read=200, delete=200, read_after=404 |
| S2 | Owner B write→read→delete→read no path `<org_b>/…` | ALLOWED_AND_CLEANED | ✅ write=200, read=200, delete=200, read_after=404 |
| S3 | Owner A tenta write no path `<org_b>/…` | BLOCKED_RLS | ✅ 403 `new row violates row-level security policy` |
| S4 | Owner B tenta write no path `<org_a>/…` | BLOCKED_RLS | ✅ 403 `new row violates row-level security policy` |

**8/12 conforme esperado. 4/12 divergentes (A3, A4, P3, P4).**

## 7. Findings

### SEC-023 — Activities aceitam `opportunity_id` de outro tenant (HIGH/OPEN)
Owner A conseguiu preparar INSERT em `public.activities` com `organization_id = ORG_A` e `opportunity_id = OPP_B` (pertencente a ORG_B). A policy `Org members insert activities` valida apenas `organization_id`. Não existe CHECK constraint nem trigger que valide `opportunities.organization_id = activities.organization_id`. Rollback impediu persistência real, mas o INSERT atinge o commit lógico. Evidência: A3, A4 = `ALLOWED_ROLLED_BACK`.

### SEC-024 — Proposals aceitam `opportunity_id` de outro tenant (HIGH/OPEN)
Mesmo padrão da SEC-023 em `public.proposals`. Policy `Org members can insert proposals` valida somente pertencimento do `organization_id` ao caller; nenhum guard verifica `opportunities.organization_id`. Evidência: P3, P4 = `ALLOWED_ROLLED_BACK`.

Ambos são análogos ao SEC-014 (pipeline/stage) e SEC-018 (account/contact) já resolvidos em `opportunities` via policies RESTRICTIVE em CHG-015 e CHG-024. Correção prevista fora deste smoke (autorização separada obrigatória).

## 8. Baseline pré/pós
Pré: accounts=4791, contacts=1697, opportunities=2227, activities_CHG027=0, proposals_CHG027=0, storage_CHG027=0.
Pós: accounts=4791, contacts=1697, opportunities=2227, activities_CHG027=0, proposals_CHG027=0, storage_CHG027=0, interactions com marker CHG027 nos últimos 10 min = 0.
Fixtures WRITE_TARGET intactas.

## 9. Efeitos derivados
- Zero persistência em `activities` ou `proposals` (rollback interno das RPCs).
- Zero objetos remanescentes em `opportunity-files`.
- Zero egress: nenhum trigger com `pg_net`/`http`/`pg_notify` foi acionado, e mesmo os disparados foram integralmente revertidos.
- Zero envio de e-mail, PDF, Slack ou webhook.
- Zero alteração de dado real.
- `nsec12-provision-fixtures`, policies e secrets compartilhados preservados.

## 10. Estado das ferramentas
Preservadas conforme mandato (vazamento detectado → não executar cleanup):
- `public.nsec12_probe_activity_insert_smoke` — ATIVA.
- `public.nsec12_probe_proposal_insert_smoke` — ATIVA.
- Edge Function `nsec12-canary-027` — ATIVA (endpoint disponível, restrita por `NSEC12_TOKEN2`).
- Código local em `supabase/functions/nsec12-canary-027/index.ts` — presente.

## 11. Bloqueadores
- **SEC-023** e **SEC-024** — evidência concreta de aceitação cross-tenant de `opportunity_id` em activities e proposals. Bloqueadores conforme mandato (`activity cross-tenant permitida`, `proposal cross-tenant permitida`).

## 12. Riscos residuais (backlog pós-remediação)
- Matriz completa por papel (admin/manager/sales/viewer/cs) em activities e proposals.
- UPDATE/DELETE de activities e proposals.
- Validação same-tenant de `account_id`/`contact_id` em activities (não coberto neste smoke).
- Fluxos comerciais: PDF, envio, assinatura, aceite, cobrança, publicação de link.
- Anexos reais em `proposal-pdfs` (bucket privado, mesmo modelo tenant-first — não coberto neste smoke).

## 13. Dados reais intocados
Confirmado: zero mutação em accounts/contacts/opportunities/activities/proposals reais; zero objeto persistente em storage; contagens pré=pós.

## 14. Decisão

**`FINAL RESIDUAL SMOKE BLOCKED`** — SEC-023 e SEC-024 confirmadas. Cleanup das ferramentas suspenso para permitir reprobe pós-remediação (autorização separada exigida).

---

## NSEC-1.2-CHG-028 — Remediação SEC-023 / SEC-024

**Data:** 2026-07-22
**Classe:** AMARELA controlada
**Status:** `NSEC-1.2-CHG-028 VALIDATED — FINAL RESIDUAL SMOKE HOMOLOGADO`

### Pre-flight
- RLS ativa em `public.activities` e `public.proposals`.
- Baseline: activities=4 policies, proposals=4 policies. Nenhuma validava tenant da opportunity vinculada.
- `activities.opportunity_id` nullable; `proposals.opportunity_id` NOT NULL.
- Fixtures Opportunity Write A/B intactas, status `new`, títulos originais preservados.
- RPCs `nsec12_probe_activity_insert_smoke` e `nsec12_probe_proposal_insert_smoke` ativas, SECURITY INVOKER.
- Edge Function `nsec12-canary-027` preservada com whitelist Owner A/B hardcoded.
- Baseline pré: 0 activities CHG027 / 0 proposals CHG027.

### Policies criadas (RESTRICTIVE, FOR INSERT, TO authenticated, WITH CHECK)

`nsec12_activities_insert_opportunity_tenant_guard`
```sql
WITH CHECK (
  opportunity_id IS NULL
  OR EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = activities.opportunity_id
      AND o.organization_id = activities.organization_id
  )
)
```

`nsec12_proposals_insert_opportunity_tenant_guard`
```sql
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.opportunities o
    WHERE o.id = proposals.opportunity_id
      AND o.organization_id = proposals.organization_id
  )
)
```

### Rollback documentado
```sql
DROP POLICY IF EXISTS nsec12_activities_insert_opportunity_tenant_guard ON public.activities;
DROP POLICY IF EXISTS nsec12_proposals_insert_opportunity_tenant_guard ON public.proposals;
```

### Reprobes (8/8 conforme esperado)

| Probe | Cenário | Esperado | Obtido |
|---|---|---|---|
| A1 | Owner A / Org A / Opp A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A2 | Owner B / Org B / Opp B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| A3 | Owner A / Org A / Opp B | BLOCKED | ✅ BLOCKED_RLS |
| A4 | Owner B / Org B / Opp A | BLOCKED | ✅ BLOCKED_RLS |
| P1 | Owner A / Org A / Opp A | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| P2 | Owner B / Org B / Opp B | ALLOWED_ROLLED_BACK | ✅ ALLOWED_ROLLED_BACK |
| P3 | Owner A / Org A / Opp B | BLOCKED | ✅ BLOCKED_RLS |
| P4 | Owner B / Org B / Opp A | BLOCKED | ✅ BLOCKED_RLS |

### Storage
Não reexecutado. PASS da CHG-027 (S1/S2/S3/S4) preservado.

### Baseline pós
- activities CHG027 = 0
- proposals CHG027 = 0
- Opportunities Write A/B: `status='new'`, títulos originais, `organization_id` inalterado.
- Zero dado real alterado. Zero egress externo.

### Cleanup
- `nsec12_probe_activity_insert_smoke` — DROP concluído (pg_proc = 0).
- `nsec12_probe_proposal_insert_smoke` — DROP concluído (pg_proc = 0).
- Edge Function `nsec12-canary-027` — deploy removido + código local removido.
- Policies novas ativas. `nsec12-provision-fixtures` preservada.

### Findings
- **SEC-023 — RESOLVED** via `nsec12_activities_insert_opportunity_tenant_guard`.
- **SEC-024 — RESOLVED** via `nsec12_proposals_insert_opportunity_tenant_guard`.

### Riscos residuais (backlog pós-GO)
- Matriz completa por papel (manager/sales/viewer/cs) para activities e proposals INSERT.
- UPDATE/DELETE em activities e proposals.
- Fluxos comerciais completos (PDF, envio, assinatura, aceite, cobrança, link público).
- Bucket `proposal-pdfs` privatização (staged, não aplicada).

### Decisão
`NSEC-1.2-CHG-028 VALIDATED — FINAL RESIDUAL SMOKE HOMOLOGADO`
