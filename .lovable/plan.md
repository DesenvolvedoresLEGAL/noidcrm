
# Plano — Auditoria de Isolamento Multiempresa NOID RevenueOS

Objetivo: comprovar, com evidência técnica reproduzível, que nenhum dado (linhas, arquivos, métricas, logs, propostas) de uma organização vaza para outra, em nenhum caminho de acesso (Data API, RPC, Edge Function, Storage, Realtime, Views/Reports).

Entregável final: relatório assinado `docs/security/multitenant-isolation-report-v1.md` com resultados de cada teste + suíte automatizada que roda em CI.

---

## Fase 1 — Auditoria estática de RLS (read-only)

**1.1. Inventário de tabelas**
- Consultar `pg_tables` em `public` e cruzar com `pg_class.relrowsecurity`.
- Produzir tabela: `tabela | tem_organization_id | rls_enabled | force_rls | nº_policies | policies_por_comando`.
- Sinalizar toda tabela em `public` sem RLS habilitado (bloqueador).
- Sinalizar toda tabela com `organization_id` cuja policy não referencia `organization_id` nem `user_id` (bloqueador).

**1.2. Auditoria de policies**
- Extrair `pg_policies` completo e classificar cada policy por padrão:
  - `org_isolation` (usa `get_user_organization_id()` ou `user_is_org_member()`)
  - `owner_scoped` (usa `auth.uid()`)
  - `role_gated` (usa `has_role` / `can_view_all`)
  - `public_read` (`USING (true)` — precisa justificativa)
  - `service_only` (`USING (false)` — ok)
- Bloqueadores: policies com `USING (true)` em tabelas que contêm dados de tenant; policies `FOR ALL` sem `WITH CHECK`; policies que referenciam a própria tabela (risco de recursão).

**1.3. Auditoria de GRANTs**
- Cruzar `information_schema.role_table_grants` × RLS: nenhuma tabela com `organization_id` pode ter `SELECT` para `anon` a menos que policy explícita permita.
- Bloqueador: `anon` com privilégio em tabela de tenant.

**1.4. Funções SECURITY DEFINER**
- Listar todas com `prosecdef = true` em `public`.
- Verificar `search_path` fixo (`SET search_path = public`) em cada uma — sem isso é vetor de escalação.
- Verificar que nenhuma função definer retorna dados cross-org sem filtro por `get_user_organization_id()` (exceto helpers de auth reconhecidos).

**1.5. Views e Reports**
- Listar todas as views `v_*` (Reports V2, dashboards, KPIs).
- Para cada view: confirmar `security_invoker = on` OU que a definição já filtra por `organization_id`.
- Bloqueador: view `security_definer` sem filtro de org acessível ao `authenticated`.

**Saída da Fase 1:** `docs/security/rls-audit-matrix.csv` + lista de bloqueadores.

---

## Fase 2 — Testes automatizados de isolamento (Vitest + service_role fixture)

Suíte nova em `src/test/security/tenant-isolation/`, roda em CI, usa duas organizações-fixture (`ORG_A`, `ORG_B`) e 8 usuários (owner/admin/manager/sales/viewer/cs × 2 orgs).

**2.1. Isolamento por Data API (`supabase-js` como cada usuário)**
- Para cada tabela com `organization_id` do inventário:
  - Seed 1 linha em ORG_A e 1 em ORG_B.
  - Autenticar como usuário de ORG_A → `SELECT *` NUNCA pode retornar linha de ORG_B.
  - `UPDATE`/`DELETE` de linha de ORG_B autenticado como ORG_A → deve falhar (0 rows).
  - `INSERT` com `organization_id = ORG_B` autenticado como ORG_A → deve falhar por policy `WITH CHECK`.
- Falha em qualquer tabela = bloqueador.

**2.2. Matriz de roles (dentro da mesma org)**
- Para cada role (`owner`, `admin`, `manager`, `sales`, `viewer`, `cs`):
  - Confirmar visibilidade esperada (matriz do ADR-002): sales só vê próprios; manager vê equipe; admin/owner vê org.
  - Confirmar bloqueio de escrita em tabelas administrativas (`organization_members`, `user_roles`, `platform_admins`) para roles não-admin.

**2.3. RPCs e Edge Functions**
- Inventariar todas as edge functions em `supabase/functions/`.
- Para cada função que aceita `organization_id`/`opportunity_id`/`proposal_id` no body:
  - Chamar autenticado como ORG_A passando ID de ORG_B → deve retornar 403/404, nunca dado.
  - Chamar sem JWT em função que exige auth → 401.
- Auditar toda função que usa `SUPABASE_SERVICE_ROLE_KEY`: precisa validar `auth.getClaims()` + resolver `organization_id` do JWT, **nunca** confiar em `organization_id` do body.
- Bloqueador: qualquer função que aceite `organization_id` do body sem revalidar contra o JWT do chamador.

**2.4. Storage**
- Inventariar buckets (`opportunity_files`, avatares, exports, propostas PDF, etc.).
- Confirmar policies por bucket com prefixo `organization_id/...`.
- Teste: user de ORG_A tentando `download`/`list` de objeto em prefixo ORG_B → negado.

**2.5. Realtime**
- Subscrever `postgres_changes` em tabelas críticas (`opportunities`, `proposals`, `notifications_v2`) como user de ORG_A.
- Executar mutation em ORG_B via service_role → subscriber de ORG_A **não pode** receber o evento.

**2.6. Reports V2 e views**
- Rodar cada endpoint de relatório (`v_report_forecast_v2`, `commercial_won_revenue_view`, `unified_audit_view`, `unified_approval_queue_view`, etc.) autenticado em ORG_A e conferir que nenhum agregado inclui linhas de ORG_B.
- Guardrail: adicionar assertivas em `src/lib/reports/canonicalFilters.ts` audit hook rodando no CI.

**2.7. Convite e troca de organização**
- Convidar user existente para segunda org.
- Confirmar que switch de org limpa cache React Query + refaz `get-current-user`.
- Após switch para ORG_B, nenhum dado de ORG_A pode aparecer em query alguma (verificar por network snapshot).

---

## Fase 3 — Segredos e superfícies de risco

**3.1. Varredura de segredos no bundle**
- `rg` no `dist/` após build: `SERVICE_ROLE`, `service_role`, chaves JWT longas, `OPENAI_API_KEY`, `SLACK_`, etc.
- Bloqueador: qualquer secret server-only encontrado no bundle client.

**3.2. Uso de `service_role`**
- Grep em `src/` — não pode aparecer. Só em `supabase/functions/`.
- Em cada edge function que usa service_role, documentar por que precisa e qual validação de tenant faz antes.

**3.3. `.env` client**
- Confirmar que só `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY` (anon) estão expostos.

---

## Fase 4 — Backup e restauração

- Executar export via Cloud → Advanced settings → Export data para snapshot atual.
- Documentar procedimento de restore (test-restore em ambiente isolado — não em prod).
- Registrar RPO/RTO alvo e responsáveis.
- Teste: após restore em ambiente sombra, rodar suíte da Fase 2 → todos os isolamentos preservados.

---

## Fase 5 — Registro formal

Arquivo `docs/security/multitenant-isolation-report-v1.md` contendo:
1. Escopo, data, versão do schema (hash da última migration).
2. Matriz RLS (Fase 1) resumida + link para CSV.
3. Resultado por suíte da Fase 2 (verde/vermelho, contagem de asserts).
4. Lista de edge functions auditadas + validações confirmadas.
5. Evidência de storage e realtime.
6. Bloqueadores encontrados + fix aplicado + re-teste.
7. Procedimento de backup/restore testado.
8. Assinatura (responsável técnico + data).

CI: workflow `.github/workflows/tenant-isolation.yml` roda Fase 2 em cada PR; falha bloqueia merge.

---

## Detalhes técnicos

- Suíte usa `@supabase/supabase-js` com dois JWTs reais gerados via `auth.admin.generateLink` no setup, não service_role client-side.
- Fixture cria e destrói `ORG_A`/`ORG_B` por run (idempotente), namespace `iso-test-*`.
- Cada teste tem timeout de 30s e roda em paralelo por tabela via `it.concurrent`.
- Inventário de tabelas é gerado dinamicamente (query em `information_schema`) — não hardcoded — para que novas tabelas sejam automaticamente cobertas.
- Bloqueadores impedem release; warnings entram em backlog rastreado.

---

## Fora de escopo desta sprint
- Pentest externo (recomendado após v1 estar verde).
- Criptografia at-rest de campos sensíveis (tema separado).
- SIEM/alertas de acesso anômalo (tema separado — já existe `security_audit_log`).

---

## Riscos
- Inventário revelar tabelas legadas sem `organization_id` → decidir caso a caso (drop, adicionar coluna+backfill, ou marcar como global).
- Edge functions que aceitam `organization_id` do body são o vetor mais provável de vazamento — priorizar Fase 2.3.
- Views `SECURITY DEFINER` sem filtro explícito são o segundo maior risco — Fase 1.5.

## Próximos passos após aprovação
1. Rodar Fase 1 (read-only, sem migrations) e apresentar matriz + bloqueadores.
2. Corrigir bloqueadores via migrations dedicadas.
3. Implementar suíte da Fase 2 e rodar até ficar verde.
4. Gerar relatório final da Fase 5.
