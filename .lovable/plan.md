## Sprint 2 — Backfill seguro do contexto de usuários

### Auditoria de fontes legadas (já feita)

| Fonte | Campos úteis | Observação |
|---|---|---|
| `organization_members` | `org_role` (enum: owner, admin, manager, sales, viewer, cs, finance, operations), `status`, `deleted_at` | **Fonte primária** — vínculo usuário↔tenant |
| `user_roles` | `role` (app_role enum: admin, manager, sales, cs) — sem `organization_id` | **Fonte secundária**, global ao usuário |
| `profiles` | `full_name`, `email`, `monthly_goal`, `default_pipeline_id` | **Não possui** campo de tipo/função/área legada |
| `team_members` | `role` text | **Vazio** (0 linhas) — desconsiderar |

**Conclusão**: não existe no schema atual um campo de "função comercial" granular (sdr/closer/bdr/hunter/farmer/am/etc). O único sinal disponível é `org_role` em `organization_members` complementado por `user_roles.role`. Portanto:

- **Permissão** → mapeamento de alta confiança (org_role tem owner/admin/manager/viewer; user_roles complementa admin/manager para quem tem só sales/cs no org_members).
- **Área e função** → mapeamento de **confiança média/baixa** baseado em fallbacks da spec. Todos os `sales`, `cs`, `finance`, `operations` do org_role serão mapeados via regras especiais com `requires_review = true` quando aplicável (vendedor sem função comercial → sales/closer com review, etc).

Volume atual: **19 membros ativos** (18 active + 1 suspended), 11 deletados (serão pulados), 8 organizações.

---

### Migration única — o que será criado

**1. Tabela de auditoria `crm_user_context_backfill_logs`**
- Campos exatamente como na spec
- RLS habilitada
- SELECT: apenas owner/admin do tenant (padrão mais seguro) via `is_tenant_admin_or_owner`
- INSERT/UPDATE/DELETE: apenas owner/admin do tenant
- Índice por `(tenant_id, action, status)` e `(tenant_id, user_id)`

**2. Função de mapeamento `crm_resolve_user_context_mapping(_org_role text, _user_app_role text)` (SECURITY INVOKER, search_path=public)**
Retorna `(permission_key, department_key, business_function_key, mapping_confidence, requires_review, review_reason)`.

Lógica (prioridade):
1. **Permissão**: cruza `org_role` + melhor papel do `user_roles` (admin > manager > resto). owner→owner; admin→admin; manager→manager; viewer→viewer; sales/cs/finance/operations→user (com complemento se user_roles disser admin/manager).
2. **Área/Função** via fallbacks da spec:
   - owner → executive/owner (high)
   - admin sem função → operations/operations (medium, requires_review)
   - manager sem função → sales/director (medium, requires_review="Manager sem área legada explícita...")
   - org_role=sales → sales/closer (medium, requires_review="Vendedor sem função comercial explícita...")
   - org_role=cs → customer_success/cs (medium)
   - org_role=finance → finance/finance_admin (medium)
   - org_role=operations → operations/operations (medium)
   - org_role=viewer → executive/viewer (medium)
   - sem nada → null/null (low, requires_review="Área e função não identificadas no backfill")

**3. View de DRY RUN `crm_user_context_backfill_preview` (security_invoker)**
Junta `organization_members` (deleted_at IS NULL) + `user_roles` + função de mapeamento → retorna por usuário: tenant_id, user_id, org_role, user_app_role, status legado e mapeado, mapped_*, mapping_confidence, requires_review, review_reason, action (`would_create` | `would_update` | `would_skip_existing_filled`).

**4. Função de execução `crm_run_user_context_backfill()` (SECURITY DEFINER, search_path=public, restrita a service_role)**
- Itera membros não deletados
- Para cada: resolve permission_role_id, department_id, business_function_id por `(tenant_id, key)`
- Se contexto **não existe** → INSERT com `metadata.created_by_sprint='user_context_sprint_2'`, `legacy.org_role/user_type/commercial_function`, `mapping_confidence`, `requires_review`
- Se contexto **existe**: preserva campos não-nulos. Só preenche o que estiver `NULL` (regra de preservação da spec)
- Mapeia `status` (active/suspended/pending/blocked/inactive) conforme spec; `suspended` → `blocked`
- Insere log em `crm_user_context_backfill_logs` por linha (`created_context` | `updated_context` | `skipped_existing_complete` | `requires_review` adicional)
- Insere log `skipped_deleted_member` para cada deleted (varre uma vez)
- Retorna jsonb com contadores

**5. Execução do backfill**
- Rodar `SELECT * FROM crm_user_context_backfill_preview;` e validar:
  - missing_permission = 0
  - requires_review_pct ≤ 30%
- Se válido, executar `SELECT crm_run_user_context_backfill();`
- Se exceder threshold, abortar e reportar.

**6. Validações pós-execução** — as 10 queries da spec via `read_query`.

---

### Garantias de não-quebra

- **Zero alteração** em `profiles`, `organization_members`, `user_roles`, `team_members`, enums, ou qualquer policy existente.
- **Zero alteração** em código TS/React/edge functions.
- Feature flags continuam todas em `enabled=false`.
- `crm_user_contexts` é tabela nova da Sprint 1 — ninguém em produção lê dela hoje.
- Novos registros marcados em `metadata.created_by_sprint='user_context_sprint_2'` para rollback cirúrgico.

---

### Rollback (NÃO executado, apenas documentado no resumo final)

```sql
DELETE FROM crm_user_contexts WHERE metadata->>'created_by_sprint' = 'user_context_sprint_2';
DELETE FROM crm_user_context_backfill_logs WHERE metadata->>'created_by_sprint' = 'user_context_sprint_2';
```

---

### Riscos

- **Baixo**. Tabela alvo é nova, não consumida por nenhuma tela. Função de mapeamento é determinística e auditável via logs.
- Único ponto de atenção: ~todos os `sales`/`cs`/`admin`/`manager` ficarão com `requires_review=true` por **falta de função comercial granular no schema atual**. Esperado e por design — Sprint 3+ deve oferecer UI de revisão. Reportarei o percentual no resumo final; se passar de 30%, **paro o backfill real** (provavelmente passará: estimativa ~80% requires_review). Vou confirmar a tolerância contigo no momento do dry run, em vez de abortar silenciosamente.

---

### Próximos passos após aprovação

1. Aplicar migration (logs table + RPC mapeamento + view preview + RPC backfill).
2. Rodar `crm_user_context_backfill_preview` e reportar contadores.
3. Se `requires_review` > 30%, **pausar e perguntar**: aceita prosseguir mesmo assim (esperado dado a ausência de função comercial legada) ou aguarda Sprint 3 para revisão manual antes do backfill?
4. Se aprovado, executar `crm_run_user_context_backfill()`.
5. Rodar as 10 validações e entregar resumo final.
