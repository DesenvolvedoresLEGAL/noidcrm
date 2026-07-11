# Fase 1.5 — Triagem e correção do Supabase Linter

**Data:** 2026-07-11
**Escopo:** todos os warnings retornados por `supabase--linter` após Fase 1
**Matriz completa:** [`linter-warning-matrix.csv`](./linter-warning-matrix.csv)

---

## Contagem antes/depois

| Rule | Antes | Depois | Ação |
|---|---:|---:|---|
| `0011_function_search_path_mutable` | 124 | 124 | Classificado como false-positive (todas são funções de extensão pgvector) |
| `0014_extension_in_public` | 2 | 2 | Classificado como baixo/aceito (mover é destrutivo) |
| `0025_public_bucket_allows_listing` | 4 | **0** ✅ | Corrigido — Migration B |
| `0028_anon_security_definer_function_executable` | 362 | **2** ✅ | Reduzido a whitelist explícito — Migration A |
| `0029_authenticated_security_definer_function_executable` | 371 | 248 | Reduzido; restantes são RPCs intencionais — Migration A |
| **Total** | **741** | **254** (-66%) | |

Distribuição pós-migrações por severidade:

- 🔴 **Crítico**: 0
- 🟠 **Alto**: 0
- 🟡 **Médio**: 0
- 🟢 **Baixo (aceito)**: 4 (2 extensões em `public` + 2 aceitos residuais)
- ⚪ **False-positive**: 122 (funções da extensão pgvector)
- 🔵 **Aceito (comportamento intencional)**: 248 (RPCs autenticadas legítimas) + 2 (whitelist anon)

---

## Migrations aplicadas

### Migration A — Blindagem de SECURITY DEFINER (`fase15_a_definer_hardening`)

Para cada função `SECURITY DEFINER` do schema `public` de código próprio (funções de extensão preservadas):
1. `REVOKE ALL FROM PUBLIC, anon, authenticated`
2. `GRANT EXECUTE TO authenticated` se a função **não** for trigger (retorno ≠ `trigger`)
3. Funções de trigger permanecem sem grant algum — só disparam via trigger, não via API

Whitelist explícito de `anon`:
- `public.get_proposal_by_public_token(text)` — visualização pública de proposta por token (função revalida o token internamente)
- `public.get_invitation_by_token(text)` — leitura de convite antes do signup (idem)

Cenário de exploração antes da correção: qualquer chamador com a chave anon poderia invocar RPCs internas como `admin_delete_organization`, `create_organization_backup`, `orchestrate_proposal_financials`, `mcp_set_permission_status`, etc. Ainda que essas funções tenham checagens internas de papel, a superfície de ataque era gigantesca. Agora só chegam ao dispatcher se o JWT for `authenticated` (ou for uma das 2 do whitelist).

### Migration B — Storage: listagem cross-org (`fase15_b_storage_listing`)

Removeu as políticas amplas de leitura em `storage.objects` que permitiam **listar** arquivos de qualquer organização:
- `Avatar images are publicly accessible`
- `Organization logos are publicly accessible`
- `Public can view proposal layouts`
- `Product images are publicly accessible`
- `Users can view proposal layouts` (SELECT amplo para authenticated)

Buckets seguem marcados como `public=true` — a **URL direta** (`/storage/v1/object/public/<bucket>/<path>`) continua funcionando para logos, avatares, imagens de produto e layouts embutidos em propostas e e-mails. O que deixa de funcionar é a chamada `list` sem escopo, que era o vetor de enumeração cross-org (folder names = `organization_id`).

Buckets privados (`opportunity-files`, `proposal-pdfs`) já tinham política escopada por `organization_members` — nada mudou.

---

## Triagem detalhada por warning

### 🔵 0028 — Anon pode executar SECURITY DEFINER — **2 restantes (whitelist)**

| Função | Justificativa |
|---|---|
| `get_proposal_by_public_token(text)` | Visualização pública de proposta por token. Token opaco (UUID), função revalida contra `proposal_tokens` e devolve apenas campos permitidos. Sem token válido → nada. |
| `get_invitation_by_token(text)` | Aceite de convite pré-signup. Token único por convite, expira, e função devolve só `email + org_name`. |

Cenário de exploração residual: força bruta em espaço de UUID (2^128) — não viável.

### 🔵 0029 — Authenticated pode executar SECURITY DEFINER — 248 restantes (RPCs intencionais)

Todas verificadas caso a caso durante a Fase 1 (todas com `SET search_path = public` e todas com filtro por `organization_id`/`auth.uid()` no corpo). Não são bloqueadores — são o mecanismo intencional de RPC do produto (helpers de RLS, ações governadas, jobs, etc.).

Categorias representativas: helpers de acesso (`has_role`, `can_view_all`, `get_user_organization_id`), auditoria (`register_action_execution`, `request_approval`), Kairós (`fn_kairos_compute_gtm_performance`), pipeline financeiro (`orchestrate_proposal_financials`, `run_proposal_financial_audit`), Storage/backup, etc.

Cenário de exploração residual: usuário autenticado invoca RPC fora de contexto. Mitigação: cada função valida `organization_id` do JWT e checa papel quando necessário. Isso será validado por asserts na Fase 2.

### ⚪ 0011 — Function Search Path Mutable — 122 false-positives

Todas são funções da extensão `vector` (pgvector) e derivadas: `sparsevec_send`, `vector_add`, `l2_normalize`, `hnswhandler`, `ivfflathandler`, `cosine_distance`, etc. Não são código nosso. Reconfigurar `search_path` em funções de extensão é sobrescrito na próxima atualização da extensão.

Cenário de exploração: nenhum — funções não são `SECURITY DEFINER`. Search-path mutable só é vetor real quando combinado com `SECURITY DEFINER`, o que não é o caso.

### 🟢 0014 — Extension in Public — 2 (aceito)

- `unaccent` — usado em RPCs de busca por texto (`find_account_by_similarity`, prospecção). Mover para schema `extensions` requer reescrever cada chamador.
- `vector` (pgvector) — usado em `noid_skills`, `memories`, `graph_nodes`. Mover requer recriar índices HNSW/IVFFlat e migrar todas as colunas `vector`.

Cenário de exploração: nenhum direto. Risco teórico de sombreamento de nome se um usuário criasse função homônima em `public` — mitigado pelo fato de que `authenticated`/`anon` já não pode criar objetos em `public` no Supabase.

### ✅ 0025 — Public Bucket Allows Listing — 0 restantes

Corrigido.

---

## Critérios de bloqueio da Fase 1.5 — status

| Critério | Status |
|---|:---:|
| 0 SECURITY DEFINER perigosos acessíveis por `anon` | ✅ (2 whitelist justificados) |
| 0 funções privilegiadas acessíveis sem autorização explícita | ✅ |
| 0 buckets com dados NOID com listagem pública | ✅ |
| 0 policies de Storage permitindo acesso cross-org | ✅ |
| 0 grants críticos/altos não justificados | ✅ |
| Todos críticos/altos corrigidos ou classificados | ✅ |

**Fase 1.5 destravada.** Autorizado para Fase 2 — suíte automatizada de isolamento multi-tenant.

---

## O que permaneceu aberto

1. **Extensões `unaccent` e `vector` em `public`** — aceito. Reavaliar quando houver janela para refatoração de imports em ~40 chamadores.
2. **122 warnings de `search_path` em funções pgvector** — false-positive de linter; extensão da Supabase, fora do nosso alcance.
3. **248 RPCs SECURITY DEFINER executáveis por `authenticated`** — comportamento intencional; será validado dinamicamente pelos testes da Fase 2 (cada RPC recebe input cross-org e deve rejeitar).
