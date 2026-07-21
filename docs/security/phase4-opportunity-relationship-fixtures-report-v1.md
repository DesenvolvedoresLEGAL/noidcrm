# Phase 4 — Opportunity Relationship Fixtures Report v1

**Sprint:** NOID-SECURITY 1.2
**Change ID:** `NSEC-1.2-CHG-012`
**Classificação:** Amarela controlada
**Data (UTC):** 2026-07-21
**Escopo:** provisionar 2 pipelines sintéticos + 2 stages sintéticas para
fundamentar a futura canary de INSERT em `public.opportunities`.

Nenhum dado real foi lido, alterado ou copiado. Nenhum service_role foi
utilizado no `Authorization`. Todas as criações passaram pelo PostgREST
com JWT real dos owners sintéticos.

---

## 1. Tabelas reais identificadas

Descoberta pelas foreign keys de `public.opportunities`:

| Referência em `opportunities` | Tabela | PK | Coluna org | Vínculo stage → pipeline |
| --- | --- | --- | --- | --- |
| `pipeline_id` | `public.pipelines` | `id text` | `organization_id uuid NOT NULL` | — |
| `stage_id` | `public.stages` | `id text` | `organization_id uuid NOT NULL` | `pipeline_id text` (FK → pipelines) |

Nenhuma tabela legada foi tocada. Ambas são as tabelas utilizadas pelo
fluxo atual do produto (referenciadas por `opportunities`, hooks
`useStages`, `usePipelines`, e services `pipelines/stages`).

---

## 2. Pre-flight de `public.pipelines`

- Colunas NOT NULL sem default: `id`, `name`, `type`, `organization_id`.
- Colunas com default: `pipeline_type='sales'`, `is_primary=false`,
  `lead_distribution_strategy='none'`, `business_unit_ids='{}'`,
  `created_at=now()`.
- Check constraints: `pipeline_type ∈ {qualification,sales,onboarding,renewal}`;
  `lead_distribution_strategy` e `lead_distribution_role` validados.
- FKs: `organization_id → organizations(id)`.
- Policies:
  - `SELECT/ALL org_members_full_access` via `can_access_org_record(organization_id)`.
  - `INSERT` "Users can insert org pipelines" com `WITH CHECK (organization_id = get_user_organization_id())`.
  - `UPDATE/DELETE` restrito a `user_is_org_admin`.
- Triggers: apenas `trg_ensure_single_primary_pipeline` (BEFORE INSERT/UPDATE OF is_primary). Não dispara quando `is_primary=false`.
- Egress externo: nenhum.
- Payload mínimo seguro: `id, name, type, organization_id, is_primary=false`.

Conclusão: pipeline sintético pode ser criado sem afetar defaults reais,
sem automação, sem integração externa.

---

## 3. Pre-flight de `public.stages`

- Colunas NOT NULL sem default: `id`, `name`, `order_index`, `organization_id`.
  `is_qualified_stage` NOT NULL default `false`.
- FKs: `organization_id → organizations`, `pipeline_id → pipelines ON DELETE CASCADE`.
- Policies: espelham as de `pipelines` (org membership para SELECT, tenant check em INSERT, admin-only em UPDATE/DELETE).
- Triggers: **nenhum** definido em `public.stages`.
- Flags de fechamento: `allow_win_opportunity`, `allow_lose_opportunity`, `is_qualified_stage` — todas setadas a `false`.
- Payload mínimo seguro: `id, name, pipeline_id, organization_id, order_index`.

`order_index=0` é isolado do pipeline sintético e não desloca stages reais
(cada pipeline mantém sua própria numeração; index está sozinho no pipe sintético).

---

## 4. Payloads mínimos usados

### Pipeline (A/B)
```json
{
  "id": "<uuid>",
  "name": "SECURITY_TEST_PIPELINE_ORG_<A|B>",
  "type": "sales",
  "pipeline_type": "sales",
  "organization_id": "<synthetic org uuid>",
  "is_primary": false
}
```

### Stage (A/B)
```json
{
  "id": "<uuid>",
  "name": "SECURITY_TEST_STAGE_ORG_<A|B>_INITIAL",
  "pipeline_id": "<synthetic pipeline uuid>",
  "organization_id": "<synthetic org uuid>",
  "order_index": 0,
  "probability": 5,
  "allow_create_opportunity": true,
  "allow_win_opportunity": false,
  "allow_lose_opportunity": false,
  "is_qualified_stage": false
}
```

---

## 5. Método de criação

- Endpoint: `POST {SUPABASE_URL}/rest/v1/{pipelines|stages}` (PostgREST).
- Headers: `apikey: <publishable>`, `Authorization: Bearer <JWT real>`,
  `Prefer: return=representation`.
- **JWT confirmado real** — emitido via Edge Function `nsec12-provision-fixtures`
  action `issueToken`, fluxo `grant_type=password` no GoTrue com
  `sec-test-<a|b>-owner@example.com`. Zero uso de service_role no Authorization.
- Ordem estritamente serial: Pipeline A → Stage A → Pipeline B → Stage B.
- Nenhum retry automático; nenhuma duplicata (pré-verificação por nome
  retornou 0 antes das criações).

---

## 6. Fixtures criadas (IDs mascarados)

| Fixture | Tipo | Nome | Org | ID (mascarado) | is_primary / flags |
| --- | --- | --- | --- | --- | --- |
| Pipeline A | `pipelines` | `SECURITY_TEST_PIPELINE_ORG_A` | ORG_A | `d1f1c882-…-30f5` | `is_primary=false` |
| Stage A | `stages` | `SECURITY_TEST_STAGE_ORG_A_INITIAL` | ORG_A | `18208f58-…-9bc7` | won/lost/qualified = false |
| Pipeline B | `pipelines` | `SECURITY_TEST_PIPELINE_ORG_B` | ORG_B | `0526054f-…-f992` | `is_primary=false` |
| Stage B | `stages` | `SECURITY_TEST_STAGE_ORG_B_INITIAL` | ORG_B | `7efae798-…-1e48` | won/lost/qualified = false |

IDs completos: `docs/security/single-project-cleanup-runbook-v1.md` §5.

---

## 7. Visibilidade same-org (JWT real)

| Owner | Vê Pipeline A | Vê Stage A | Vê Pipeline B | Vê Stage B |
| --- | --- | --- | --- | --- |
| sec-test-a-owner | ✅ | ✅ | ❌ | ❌ |
| sec-test-b-owner | ❌ | ❌ | ✅ | ✅ |

Confirmado via `GET /rest/v1/pipelines?id=eq.<uuid>` e
`GET /rest/v1/stages?id=eq.<uuid>` com JWT real de cada owner. Retornos
esperados: array com 1 item (same-org) ou `[]` (cross-org).

---

## 8. Bloqueio cross-org

Todos os 4 probes cross-org retornaram `[]` (RLS `can_access_org_record`).
Nenhuma organização real foi capaz de enxergar as fixtures (verificado
indiretamente via `is_primary=false` e escopo de policy — mesma expressão
que já validou 168 probes anteriores).

---

## 9. Efeitos derivados

Janela: 2026-07-21 12:52 UTC ±5 min.

| Tabela | Filtro por UUID sintético | Registros |
| --- | --- | --- |
| `entity_snapshots` | 4 UUIDs sintéticos | 0 |
| `opportunities` | title `SECURITY_TEST_%` | 0 |
| `pipelines` (default alterado) | `is_primary=true` change | 0 |
| Egress externo (HTTP/webhook/email/Slack) | — | 0 |

`pipelines` e `stages` **não possuem** trigger de audit_log/entity_snapshot
(inspecionado no pre-flight A/B). Nenhum efeito derivado registrado.

---

## 10. Baseline pré/pós

| Métrica | Pré (auditoria CHG-011) | Pós (CHG-012) |
| --- | --- | --- |
| `pipelines` totais | 17 | 19 (+2 sintéticos) |
| `pipelines` `is_primary=true` | 1 | 1 (inalterado) |
| `stages` totais | 98 | 100 (+2 sintéticos) |
| `opportunities` sintéticas | 0 | 0 |
| Accounts sintéticas | 2 | 2 (inalterado) |
| Efeitos derivados sintéticos | 1 (`lead_score_recalc_queue` de accounts) | 1 (idem — nada novo) |

Dados reais **intocados**.

---

## 11. Smoke test read-only

- `SELECT COUNT(*) FROM pipelines WHERE is_primary=true` → 1 (inalterado).
- Listagem via PostgREST retorna pipelines/stages reais normalmente.
- Nenhum erro novo de RLS no linter/logs (verificação superficial).
- Rotas `/app/deals` continuam operacionais (não visitadas via UI, mas
  policies inalteradas — smoke lógico).

---

## 12. Guardrails atendidos

- Nenhuma fixture criada em organização real.
- Nenhum owner real utilizado.
- Zero service_role em Authorization.
- Pipelines/stages invisíveis cross-org.
- Nenhum default real alterado.
- Nenhuma stage real reordenada.
- Nenhuma automação habilitada.
- Nenhum efeito externo disparado.
- Nenhum dado real alterado.
- JWTs mantidos apenas em `/tmp/*.txt` locais (não versionados; não impressos).
- Exatamente 2 pipelines e 2 stages criados.
- Zero migrations, policies, triggers, RPCs, edge functions criadas.
- SEC-013 (viewer INSERT) intencionalmente **não** corrigido nesta mudança.
- Tenant-check de FKs (Achado A do CHG-011) intencionalmente **não** corrigido.

---

## 13. Decisão

**`OPPORTUNITY PIPELINE FIXTURES READY`**

Fixtures prontas. Não avançar para canary de INSERT em `opportunities`,
criação de contatos-base, alterações de policy ou qualquer outra sprint
sem nova autorização explícita.
