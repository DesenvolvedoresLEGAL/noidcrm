# Guia Operacional — Provisionamento do Supabase de Staging (NOID)

Data: 2026-07-11
Status: **documentação** — nada foi executado. Nenhum efeito no projeto atual `urihdqturaebhiefwjnw`.

> **Regra absoluta**: o project ref `urihdqturaebhiefwjnw` é PRODUÇÃO. Nunca reutilizar como staging, nunca aplicar migrations de teste, nunca gerar fixtures nele. Todos os scripts abaixo têm guarda dupla contra esse ref.

---

## 0. Papéis e responsabilidades

| Etapa                                | Executor                          | Ferramenta                              |
| ------------------------------------ | --------------------------------- | --------------------------------------- |
| Criar projeto Supabase (staging)     | Operador humano com acesso Supabase | Dashboard Supabase (fora do Lovable)   |
| Registrar secrets no GitHub          | Operador humano com admin do repo | GitHub → Settings → Secrets/Variables   |
| Aplicar migrations em staging        | Operador humano                    | `scripts/apply-migrations-staging.sh`   |
| Executar suíte tenant-isolation      | GitHub Actions (`workflow_dispatch`) | `.github/workflows/tenant-isolation.yml` |
| Smoke tests pós-provisionamento      | Operador humano                    | `scripts/staging-smoke-tests.sh`        |
| Teardown                             | Operador humano                    | Dashboard Supabase + script guiado      |

O agente Lovable **não** provisiona projetos Supabase, **não** aplica migrations em staging, **não** grava secrets no GitHub. Esses passos são humanos por design.

---

## 1. Passo a passo — criar novo projeto Supabase de staging

1. Entrar em [https://supabase.com/dashboard](https://supabase.com/dashboard) com uma conta que **não** seja a conta do Lovable Cloud (ideal: conta corporativa NOID dedicada a segurança/QA).
2. `New project`:
   - **Name**: `noid-staging-tenant-isolation`
   - **Organization**: organização Supabase dedicada a QA (nunca a org de produção).
   - **Database Password**: gerar via password manager (≥ 32 chars, alta entropia). Guardar em cofre corporativo. Nunca commitar.
   - **Region**: mesmo continente da produção (ver §2).
   - **Pricing plan**: Free tier é suficiente para a suíte tenant-isolation (2 orgs × 6 usuários = 12 rows em auth + ~algumas dezenas em `public.*`). Se o time quiser rodar carga de fixtures maiores, subir para Pro.
3. Aguardar o provisionamento (~2 minutos). Anotar:
   - **Project ref** (subdomínio, ex.: `abcxyzstaging1234`)
   - **Project URL**: `https://<ref>.supabase.co`
   - **anon key** (Settings → API → Project API keys → `anon` `public`)
   - **service_role key** (Settings → API → Project API keys → `service_role` `secret`)

   **Nunca** enviar `service_role` em canais não seguros. Guardar em cofre.

4. Em `Authentication → Providers`:
   - Habilitar `Email` (mesmo modo de produção).
   - **Desabilitar** confirmação de email (a fixture cria usuários já confirmados via `auth.admin`).
   - Não habilitar OAuth providers em staging — a suíte não precisa.
5. Em `Authentication → URL Configuration`:
   - `Site URL`: `http://localhost:8080` (a suíte roda no runner, não em navegador).
   - Redirect URLs: vazio.
6. Em `Database → Extensions`, confirmar que as extensões usadas por NOID estão disponíveis: `pg_trgm`, `pgcrypto`, `uuid-ossp`, `pg_net` (se aplicável). Não habilitar aqui — as migrations habilitam.

---

## 2. Requisitos de região, plano e configuração

| Item                    | Recomendação                                             | Motivo                                                        |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------- |
| Região                  | `sa-east-1` (São Paulo) se produção estiver na América   | Reduz variância de latência ao replicar comportamento         |
| Plano                   | Free (para tenant-isolation) ou Pro (se rodar dumps)     | Free comporta a suíte inteira; Pro apenas se precisar de PITR |
| Compute size            | Menor disponível (Micro)                                 | Custo mínimo; carga é insignificante                          |
| Backup                  | Não obrigatório em staging                               | Ambiente é descartável por definição                          |
| PITR                    | Não                                                      | Idem                                                          |
| SSL enforcement         | On (default)                                             | Consistência com produção                                     |
| Auth email confirmation | **Off** (diferente de produção)                          | Fixture cria usuários já confirmados; economia de tempo       |
| Anonymous sign-in       | **Off** (default)                                        | Fixture usa email/senha                                       |
| Storage                 | Habilitar; buckets serão criados por migration           | Espelha produção                                              |

---

## 3. Vincular temporariamente o CLI ao project ref de staging

Assumindo Supabase CLI instalado (`brew install supabase/tap/supabase` ou `nix run nixpkgs#supabase-cli`).

Exportar credenciais em uma sessão de shell **isolada** (nova janela de terminal só para staging):

```bash
# NUNCA colar em .env / .envrc / arquivos versionados.
export SUPABASE_ACCESS_TOKEN="<personal access token do operador humano>"
export STAGING_PROJECT_REF="<ref do projeto staging>"
export STAGING_DB_PASSWORD="<senha do banco staging>"

# Guarda: aborta se alguém trocar staging pelo ref de produção.
if [ "$STAGING_PROJECT_REF" = "urihdqturaebhiefwjnw" ]; then
  echo "ABORT: STAGING_PROJECT_REF aponta para PRODUÇÃO." >&2
  return 1 2>/dev/null || exit 1
fi

supabase link --project-ref "$STAGING_PROJECT_REF" --password "$STAGING_DB_PASSWORD"
supabase projects list   # confirmar que o link ficou no ref esperado
```

Após terminar, sempre desvincular:

```bash
supabase unlink
unset SUPABASE_ACCESS_TOKEN STAGING_DB_PASSWORD STAGING_PROJECT_REF
```

**Nunca** deixar a sessão aberta com o CLI linkado a staging em máquina compartilhada.

---

## 4. Aplicar schema e migrations sem dados reais

Objetivo: reproduzir o **esquema** de produção em staging, sem copiar dados de clientes.

Fluxo recomendado:

1. Confirmar que `supabase/migrations/` está atualizado (todas as migrations de produção estão no repo).
2. Confirmar que `supabase/migrations-staged/` **não** foi promovido: essas migrations são staging-only e serão aplicadas separadamente após aceite.
3. Rodar `scripts/apply-migrations-staging.sh` (já existe no repo — valida o ref antes de aplicar):
   ```bash
   ./scripts/apply-migrations-staging.sh
   ```
   O script:
   - Lê `STAGING_PROJECT_REF` do env.
   - Aborta se o ref for `urihdqturaebhiefwjnw` ou se `STAGING_PROJECT_REF` estiver vazio.
   - Roda `supabase db push` (aplica todas as migrations do repo em ordem).
   - Faz smoke check das tabelas/roles.
4. **Não** rodar `supabase db dump` da produção para staging. Nenhum dado real. Fixture da suíte cria as 2 orgs e 12 usuários do zero.
5. Depois de aprovado o rollout de Storage (`docs/security/phase2-approval-decisions.md`), copiar manualmente os arquivos de `supabase/migrations-staged/storage/` para `supabase/migrations/` **num commit à parte** e re-rodar o script. Ordem: `01 → 02 → 03 → 04 → 05b → 06 → 07a`. Aplicar `07b` só depois de `07a` validar cobertura.

Regra de ouro: se `supabase db push` em staging falhar, **parar** e corrigir a migration antes de qualquer tentativa em produção.

---

## 5. Secrets necessários

### 5.1 No projeto Supabase de staging (Dashboard → Edge Functions → Secrets)

Somente valores **sandbox / fake** — nunca chaves reais de terceiros:

| Secret                    | Valor recomendado em staging                  |
| ------------------------- | --------------------------------------------- |
| `OPENAI_API_KEY`          | chave de conta OpenAI dedicada a QA (com limite baixo) OU deixar unset e mockar respostas |
| `LOVABLE_API_KEY`         | não configurar em staging (não há gateway de conectores em staging) |
| `SLACK_*`                 | webhook fake apontando para canal `#noid-staging-noise` privado |
| `SMTP_*`                  | Mailtrap.io sandbox ou similar — nunca SMTP de produção |
| `HUMAN_ERP_API_KEY`       | valor fake `staging-fake-key` — endpoints ERP não devem responder |
| `UMMA_ERP_*`              | idem                                          |
| `APOLLO_API_KEY`          | conta trial dedicada ou fake                  |
| `FIRECRAWL_API_KEY`       | idem                                          |
| `WEBHOOK_SIGNING_SECRET`  | gerar novo valor exclusivo de staging         |

Regra: nenhuma chave reutilizada entre staging e produção. Se um valor vaza no runner do GitHub Actions, produção segue intacta.

### 5.2 Locais (para operador humano rodar CLI/scripts)

- `SUPABASE_ACCESS_TOKEN` — personal access token do operador
- `STAGING_PROJECT_REF`
- `STAGING_DB_PASSWORD`
- `STAGING_ANON_KEY`
- `STAGING_SERVICE_ROLE_KEY`

Guardar em cofre corporativo. Nunca em `.env` versionado. Nunca no chat do Lovable.

---

## 6. Configuração dos GitHub Actions

No repo, `Settings → Secrets and variables → Actions`:

### 6.1 Repository secrets (aba **Secrets**)

| Nome                              | Valor                                             |
| --------------------------------- | ------------------------------------------------- |
| `TEST_SUPABASE_URL`               | `https://<STAGING_PROJECT_REF>.supabase.co`       |
| `TEST_SUPABASE_ANON_KEY`          | anon key do projeto staging                       |
| `TEST_SUPABASE_SERVICE_ROLE_KEY`  | service_role key do projeto staging               |

### 6.2 Repository variables (aba **Variables**)

| Nome                        | Valor                                       |
| --------------------------- | ------------------------------------------- |
| `TENANT_ISOLATION_ENABLED`  | `true`                                      |
| `VITE_SUPABASE_URL`         | `https://urihdqturaebhiefwjnw.supabase.co`  |

`VITE_SUPABASE_URL` em variables (não secrets) é intencional: é o valor de produção, público, e o workflow usa apenas para comparar hosts na guarda anti-produção.

### 6.3 Verificação

O workflow `.github/workflows/tenant-isolation.yml` já contém:

```yaml
if: ${{ vars.TENANT_ISOLATION_ENABLED == 'true' }}
...
- name: Guard against production
  run: |
    test_host=$(echo "$TEST_SUPABASE_URL" | awk -F/ '{print $3}')
    prod_host=$(echo "$PROD_SUPABASE_URL" | awk -F/ '{print $3}')
    if [ "$test_host" = "$prod_host" ]; then
      echo "TEST_SUPABASE_URL matches production host; aborting." && exit 1
    fi
```

Após configurar os secrets/variables, disparar manualmente: `Actions → Tenant Isolation Suite → Run workflow`. Confirmar que:

- A guarda **não** aborta (host de teste ≠ host de produção).
- Todos os testes marcados obrigatórios passam.
- Nenhum teste é pulado sem justificativa registrada.

---

## 7. Guarda obrigatória contra o project ref de produção

Todos os scripts, workflows e utilitários devem falhar imediatamente se qualquer variável apontar para `urihdqturaebhiefwjnw`. Camadas em ordem:

1. **`scripts/apply-migrations-staging.sh`** — valida `STAGING_PROJECT_REF != "urihdqturaebhiefwjnw"` antes de qualquer chamada CLI.
2. **`scripts/staging-smoke-tests.sh`** — mesma guarda.
3. **`.github/workflows/tenant-isolation.yml`** — compara host de `TEST_SUPABASE_URL` com host de `VITE_SUPABASE_URL` (produção); aborta se coincidirem.
4. **`src/test/security/tenant-isolation/fixture.ts`** — aborta em `beforeAll` se `TEST_SUPABASE_URL === VITE_SUPABASE_URL`.
5. **Discipline humana** — nenhum operador jamais roda `supabase link --project-ref urihdqturaebhiefwjnw` em sessão de terminal usada para testes. Máquinas separadas ou terminais dedicados ajudam.

Se qualquer guarda falhar de forma inesperada, **parar** e investigar. Falha de guarda não é warning — é bloqueio.

---

## 8. Smoke tests após provisionamento

Rodar `scripts/staging-smoke-tests.sh` (novo, entregue neste guia). Ele executa, contra o projeto staging:

1. `SELECT 1` — conectividade.
2. Lista extensões e confirma `pg_trgm`, `pgcrypto`.
3. Conta tabelas em `public` e compara com número esperado (mínimo).
4. Confirma que `public.organizations` existe e está vazia (sem dados de produção).
5. Confirma que `auth.users` está vazia ou contém apenas o dono do projeto.
6. Testa `auth.admin.createUser` + `auth.admin.deleteUser` com um email `smoke-<uuid>@example.test`.
7. Confirma buckets do Storage: existem? qual visibilidade?
8. Chama uma RPC pública trivial (ex.: `has_role`) com JWT anon — deve retornar `false` sem erro.

Se qualquer smoke test falhar, teardown + recomeço. Não prosseguir para tenant-isolation com staging quebrado.

---

## 9. Teardown e recriação

### 9.1 Teardown lógico (mantém o projeto Supabase)

Preferido entre execuções da suíte. A própria suíte tenant-isolation faz teardown em `afterAll`:

```sql
delete from public.organization_members where organization_id in (
  select id from public.organizations where slug like 'iso-%'
);
delete from public.organizations where slug like 'iso-%';
-- + auth.admin.deleteUser para cada usuário 'iso-*@example.test'
```

Se sobrar lixo (falha de rede no teardown), rodar manualmente via SQL editor do dashboard staging.

### 9.2 Teardown físico (destrói o projeto Supabase)

Fazer quando:

- Staging ficou em estado inconsistente e migrations não reconciliam.
- Rotação de credenciais completa (nova service_role + nova senha DB).
- Fim de projeto / limpeza trimestral.

Passos:

1. Dashboard Supabase → Project → Settings → General → **Delete project**.
2. Confirmar digitando o nome do projeto.
3. Aguardar confirmação por email.
4. Remover secrets do GitHub (`TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`).
5. Setar `TENANT_ISOLATION_ENABLED=false` até novo staging entrar no ar (evita que workflow rode com secrets vazios).
6. Registrar em `docs/security/evidence/phase2/teardown-<data>.md` com timestamp e motivo.

### 9.3 Recriação

Repetir §§ 1 → 8 com novo `STAGING_PROJECT_REF`. Nenhum valor antigo é reutilizado.

---

## 10. Checklist final de isolamento staging × produção

Antes de considerar staging apto para receber a suíte tenant-isolation:

- [ ] Projeto Supabase staging tem `project_ref` **diferente** de `urihdqturaebhiefwjnw`.
- [ ] Staging está em organização Supabase **diferente** da organização de produção.
- [ ] Senha do banco de staging **não é** a de produção.
- [ ] `service_role` de staging **não é** o de produção.
- [ ] `anon` de staging **não é** o de produção.
- [ ] Nenhum dado de cliente foi copiado. `auth.users` e tabelas de negócio estão vazias após migrations.
- [ ] Nenhum secret de terceiro (OpenAI, Slack, SMTP, ERPs) reutiliza valor de produção.
- [ ] Webhooks de staging apontam para canais/inboxes de sandbox.
- [ ] `TEST_SUPABASE_URL` no GitHub aponta para o host de staging.
- [ ] `TENANT_ISOLATION_ENABLED=true` só depois que todos os itens acima estão OK.
- [ ] Workflow `Tenant Isolation Suite` roda com sucesso ao menos uma vez em `workflow_dispatch`.
- [ ] Guarda "TEST_SUPABASE_URL matches production host" foi testada com valor forjado apontando para produção — a suíte abortou como esperado (registrar evidência).
- [ ] Nenhum `git grep` retorna o project ref de staging em código de produção; ele só aparece em segredos e docs marcadas como staging.
- [ ] `.env` local do dev **não** contém credenciais de staging (staging é acessado só por operadores humanos autorizados, nunca pelo bundle do app).
- [ ] Time de plantão sabe qual é o projeto staging, quem tem acesso e como fazer teardown.

Somente com todos os itens marcados, avançar para execução end-to-end da Fase 2.

---

## Anexos

- Script de aplicação: `scripts/apply-migrations-staging.sh` (existente)
- Script de smoke tests: `scripts/staging-smoke-tests.sh` (novo — ver arquivo)
- Workflow CI: `.github/workflows/tenant-isolation.yml` (existente)
- Fixture: `src/test/security/tenant-isolation/fixture.ts` (existente)
- Plano da Fase 2: `docs/security/phase2-tenant-isolation.md`
- Decisões aprovadas: `docs/security/phase2-approval-decisions.md`
