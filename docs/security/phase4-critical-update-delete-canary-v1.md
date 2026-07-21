# NSEC-1.2-CHG-025 — Critical UPDATE/DELETE Canary (Accounts + Contacts + Opportunities)

**Status:** `CRITICAL UPDATE/DELETE CANARY FAILED`
**Data:** 2026-07-21
**Escopo:** UPDATE e DELETE em `public.accounts`, `public.contacts`, `public.opportunities`.

## Pré-flight (read-only)
- RLS habilitada nas 3 tabelas.
- `opportunities`: 10 policies (6 PERM + 4 RESTR). As 4 RESTRICTIVE INSERT do CHG-024 intactas.
- Único trigger com egress: `notify_segment_benchmark_refresh` (pg_net) — só dispara em transição de status para won/lost; probes não tocam status. `pg_net` é transacional.
- Nenhuma RPC temporária pré-existente. `nsec12-canary-023` já removida.
- 6 usuários sec-test (owner/admin/viewer × A/B) confirmados; orgs A/B, pipelines/stages sintéticos confirmados.
- Baseline pré: accounts=4789, contacts=1695, opportunities=2225 (ativos).

## Ferramentas temporárias criadas
- RPCs SECURITY INVOKER: `nsec12_probe_account_write`, `nsec12_probe_contact_write`, `nsec12_probe_opportunity_write` (search_path=public; REVOKE PUBLIC; GRANT authenticated).
- Edge Function `nsec12-canary-025` (guarded por `NSEC12_TOKEN2`; emite JWTs sec-test; cria fixtures via PostgREST como Owner; executa 36 probes).

## Fixtures dedicadas (persistentes; UUIDs no runbook)
- `SECURITY_TEST_ACCOUNT_ORG_A_WRITE_TARGET` = 6562ba86-2be7-4c10-b4f7-4d4bd6df290f
- `SECURITY_TEST_ACCOUNT_ORG_B_WRITE_TARGET` = 42b62d65-f495-4afc-8174-a5ae726c1ef3
- `SECURITY_TEST_CONTACT_ORG_A_WRITE_TARGET` = 394a41dd-c78d-4ae0-9736-333bcc79761d
- `SECURITY_TEST_CONTACT_ORG_B_WRITE_TARGET` = 994be611-df79-4c4f-a79b-ee97e6856b4e
- `SECURITY_TEST_OPPORTUNITY_ORG_A_WRITE_TARGET` = b86abbed-d591-4add-8442-609f2db6e195
- `SECURITY_TEST_OPPORTUNITY_ORG_B_WRITE_TARGET` = 750e4dc4-09c0-44ca-abe5-f4a9726e3837

## Resultados dos 36 probes: 30/36 conforme esperado

### UPDATE (18 probes) — 14 conforme, 4 divergentes
- **Accounts** — U1/U2 (owner same-org)=ALLOWED_ROLLED_BACK ✅ · **U3/U4 (viewer same-org)=ALLOWED_ROLLED_BACK ❌** · U5/U6 (cross-tenant)=BLOCKED_RLS ✅.
- **Contacts** — U1/U2=ALLOWED_ROLLED_BACK ✅ · **U3/U4=ALLOWED_ROLLED_BACK ❌** · U5/U6=BLOCKED_RLS ✅.
- **Opportunities** — U1/U2=ALLOWED_ROLLED_BACK ✅ · U3/U4 (viewer)=BLOCKED_RLS ✅ · U5/U6=BLOCKED_RLS ✅ (bloqueio real por trigger `trg_opportunities_qualification_gate`).

### DELETE (18 probes) — 16 conforme, 2 divergentes
- **Accounts** — D1/D2 (admin same-org)=ALLOWED_ROLLED_BACK ✅ · D3/D4 (viewer)=BLOCKED_RLS ✅ · D5/D6 (cross-tenant)=BLOCKED_RLS ✅.
- **Contacts** — **D1/D2=BLOCKED_RLS ⚠ regressão funcional** · D3/D4=BLOCKED_RLS ✅ · D5/D6=BLOCKED_RLS ✅.
- **Opportunities** — D1/D2=ALLOWED_ROLLED_BACK ✅ · D3/D4=BLOCKED_RLS ✅ · D5/D6=BLOCKED_RLS ✅.

## Findings
- **SEC-019 (VIEWER UPDATE, MEDIUM/OPEN)** — Viewer consegue UPDATE em `accounts` e `contacts` same-org. Policies PERMISSIVE `Users update accounts in own org` e `Users update contacts in own org` exigem apenas `organization_id = get_user_organization_id()`; não validam `can_view_all(auth.uid())` nem papel. Escrita comportamental esperada para viewer é somente leitura.
- **SEC-020 CROSS-TENANT DELETE** — não confirmado (6/6 bloqueados). Sem finding.
- **SEC-021 CROSS-TENANT UPDATE** — não confirmado (6/6 bloqueados). Sem finding.
- **SEC-022 VIEWER DELETE** — não confirmado (6/6 bloqueados). Sem finding.

## Regressão funcional (registro, não finding — mandato "não corrigir")
- `contacts` DELETE via admin same-org retornou BLOCKED_RLS. Policy `Admins delete contacts` exige `can_view_all(auth.uid())`; a mesma exigência existe em `accounts` mas admin sec-test passou em accounts. A diferença efetiva não foi investigada nesta canary.

## Incidente de persistência e contenção
Durante os probes de DELETE em `contacts`, a lógica de detecção (`SELECT deleted_at` pré/pós + ROW_COUNT) **não capturou** as mutações que o trigger `soft_delete_contact_trigger` aplicou porque:
- O trigger cancela o DELETE físico (`RETURN NULL`, ROW_COUNT=0) após executar internamente `UPDATE contacts SET deleted_at=now()`.
- A SELECT pós-DELETE filtra `deleted_at IS NULL` (policy), tornando `v_after` NULL na mesma transação.
- Ambas as condições para RAISE `NSEC12_ROLLBACK` falharam → transação **commitou** o soft-delete.

**Efeito real observado:** as 2 fixtures de contatos (`SECURITY_TEST_CONTACT_ORG_A/B_WRITE_TARGET`) foram soft-deletadas por admin same-org (D1/D2). Este é o único caso em que o rollback interno falhou. Accounts e opportunities não foram afetadas.

**Contenção aplicada (executada pelo agente, mesma sprint):**
- `UPDATE contacts SET deleted_at=NULL, updated_at=now()` para os 2 UUIDs sintéticos.
- `DELETE FROM audit_log` das entradas `contact_deleted` das 2 fixtures.
- `DELETE FROM entity_snapshots` das entradas `before_delete` correspondentes.
- Confirmado por query: ambas as fixtures agora `deleted_at IS NULL`.

Nenhum dado real foi tocado. Nenhuma fixture antiga foi utilizada.

## Baseline pós (verificado)
- accounts=4791 (=pré+2 fixtures novas), contacts=1697 (=pré+2), opportunities=2227 (=pré+2). ✅
- Todas as 6 fixtures WRITE_TARGET com `deleted_at IS NULL`, nomes/títulos originais preservados. ✅
- Zero mutações nos dados reais.
- Zero egress observado (pg_net não disparou; nenhum status transitou para won/lost).

## Estado das ferramentas temporárias
Conforme mandato ("Caso exista qualquer falha: manter RPCs e Edge Function"), **preservadas** para reprobes após correção de SEC-019 e correção da lógica de detecção de soft-delete no probe de contacts:
- `public.nsec12_probe_account_write` — ATIVA
- `public.nsec12_probe_contact_write` — ATIVA
- `public.nsec12_probe_opportunity_write` — ATIVA
- Edge Function `nsec12-canary-025` — ATIVA

## Riscos residuais
- **SEC-019 exposto em produção** — viewer pode alterar dados de contas e contatos. Não bloqueia cross-tenant, mas quebra o modelo de papéis.
- Lógica de probe para DELETE em tabelas com soft-delete BEFORE trigger + SELECT policy filtrando `deleted_at IS NULL` precisa ser revista em uma próxima canary (usar admin bypass via RPC ou inspeção pós-transação separada).

## Decisão final
**`CRITICAL UPDATE/DELETE CANARY FAILED`** — SEC-019 confirmada em accounts+contacts; incidente de persistência em contacts DELETE contido; RPCs e Edge Function preservadas.
