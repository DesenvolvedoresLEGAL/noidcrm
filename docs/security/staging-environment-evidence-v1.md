# Staging Environment Evidence — NOID-SECURITY 1.1

**Sprint:** NOID-SECURITY 1.1 — Provisionamento e Homologação em Staging
**Data:** 2026-07-20
**Branch:** `edit/edt-2f860568-bcd7-4a5e-8861-f3a72310d84e`
**Commit-base:** `ff5050e7`
**Ref de produção (proibido para escrita):** `urihdqturaebhiefwjnw`

## 1. Resultado da Fase 0 — Baseline

A Fase 0 exige a existência de um projeto Supabase **dedicado de staging**,
distinto do project ref de produção, com secrets separados disponíveis
para o sandbox executar as fases dinâmicas (1–13).

Verificação executada no ambiente da sprint:

| Variável esperada                        | Status no ambiente |
| ---------------------------------------- | ------------------ |
| `TEST_SUPABASE_URL`                      | **AUSENTE**        |
| `TEST_SUPABASE_ANON_KEY`                 | **AUSENTE**        |
| `TEST_SUPABASE_SERVICE_ROLE_KEY`         | **AUSENTE**        |
| `TEST_SUPABASE_DB_URL`                   | **AUSENTE**        |
| `SUPABASE_STAGING_URL`                   | **AUSENTE**        |
| `SUPABASE_STAGING_ANON_KEY`              | **AUSENTE**        |
| `SUPABASE_STAGING_SERVICE_ROLE_KEY`      | **AUSENTE**        |
| `SUPABASE_STAGING_PROJECT_REF`           | **AUSENTE**        |
| `SUPABASE_STAGING_DB_URL`                | **AUSENTE**        |
| `PROD_SUPABASE_PROJECT_REF`              | conhecido no artefato (produção) |

Nenhum secret sensível foi impresso, exportado ou anexado a este documento.

## 2. Decisão automática

Regra absoluta da sprint:

> Se o staging ou os secrets não estiverem disponíveis:
> - Não utilizar produção.
> - Não simular execução.
> - Não marcar teste como aprovado.
> - Interromper as fases dinâmicas.
> - Gerar instrução humana objetiva com os dados faltantes.
> - Manter SECURITY NO-GO.

Portanto, as **Fases 2 a 13** (verificação, schema, smoke tests, fixtures,
suíte multi-tenant, review de policies, review de SECURITY DEFINER,
storage hardening, convites, CI dinâmico, validações) foram **interrompidas
antes de qualquer execução**. A Fase 1 (guardas anti-produção estáticas)
já está coberta pelos scripts e workflow entregues na NOID-SECURITY 1.0
(`scripts/apply-migrations-staging.sh`, `scripts/staging-smoke-tests.sh`,
`src/test/security/tenant-isolation/fixture.ts`,
`.github/workflows/tenant-isolation.yml`), todos com dupla verificação
contra o ref de produção `urihdqturaebhiefwjnw`.

Nenhuma migration foi aplicada, nenhum bucket foi alterado, nenhum
usuário foi criado, nenhum deploy ou publish ocorreu. O project ref
`urihdqturaebhiefwjnw` **não foi tocado**.

## 3. Confirmação anti-produção

- Nenhum comando de escrita foi enviado a `urihdqturaebhiefwjnw`.
- Nenhuma tentativa de fallback para produção foi executada.
- Nenhum secret de produção foi utilizado como substituto.
- Nenhum dado real foi copiado, importado ou lido para fins da sprint.
- Nenhum e-mail, Slack ou webhook foi disparado.

## 4. Instrução humana objetiva para desbloqueio

Para permitir a retomada da NOID-SECURITY 1.1, uma pessoa autorizada
precisa executar, fora do sandbox Lovable:

1. **Provisionar** um projeto Supabase novo, exclusivo para staging,
   em conta e workspace distintos dos usados por produção.
2. **Confirmar** que o project ref gerado **não** é `urihdqturaebhiefwjnw`
   e que o host não coincide com o host da produção.
3. **Cadastrar os secrets** no GitHub Environment `staging` (não em
   repositório, não em `.env` versionado, não em documentação):
   - `TEST_SUPABASE_URL`
   - `TEST_SUPABASE_ANON_KEY`
   - `TEST_SUPABASE_SERVICE_ROLE_KEY`
   - `TEST_SUPABASE_DB_URL`
   - `SUPABASE_STAGING_PROJECT_REF`
   - Opcionalmente `PROD_SUPABASE_PROJECT_REF=urihdqturaebhiefwjnw` como
     variável de repositório (não secret) para reforçar a guarda de CI.
4. **Habilitar** a variável de repositório
   `TENANT_ISOLATION_ENABLED=true` no GitHub, exigida por
   `.github/workflows/tenant-isolation.yml`.
5. **Confirmar** que o staging está vazio (sem organizações, e-mails,
   propostas ou clientes reais) e que Auth/Storage estão limpos.
6. **Tornar o repositório privado** ou registrar decisão executiva
   formal alternativa (P0-11).
7. **Remover `.env` do tracking Git** (`git rm --cached .env`) e
   confirmar que o `.gitignore` corrigido está commitado — o sandbox
   Lovable trata `.env` e `.gitignore` como somente-leitura, então essa
   ação exige um checkout local.
8. **Sinalizar** ao time NOID-SECURITY que a Fase 0 pode ser reexecutada.
   A partir daí o workflow `Tenant Isolation Suite` e os scripts de
   staging podem rodar sem risco para produção.

## 5. Estado dos bloqueadores após 1.1

| Bloqueador | Estado |
| ---------- | ------ |
| P0-01 — isolamento multi-tenant | **ABERTO** — não homologado dinamicamente (staging ausente) |
| P0-03 — storage e signed URLs | **ABERTO** — migrations `supabase/migrations-staged/storage/*` permanecem staged |
| P0-05 — aceite de convite | **ABERTO** — análise estática mantida da 1.0; sem execução dinâmica |
| P0-11 — repositório público e `.env` rastreado | **ABERTO** — requer ação humana no GitHub e checkout local |

## 6. Correção documental herdada

A NOID-SECURITY 1.0 registrou em pontos separados que o `.gitignore`
"foi corrigido" pelo agente. Isso é **incorreto**: no sandbox Lovable
o arquivo `.gitignore` é somente-leitura, portanto o agente **não**
alterou o arquivo tracked no repositório; a correção depende de commit
humano local. Os relatórios da 1.0 devem ser lidos com esse contexto,
e a mesma ressalva está reafirmada em `noid-security-go-live-gate-v1.md`
seção REPOSITÓRIO.

## 7. Decisão de segurança

**SECURITY NO-GO** mantido. Nenhuma evidência dinâmica foi produzida
nesta sprint; nenhuma evidência estática nova foi necessária além do
registro deste documento. Próxima sprint autorizada:
**continuação NOID-SECURITY** após o desbloqueio humano descrito
acima.
