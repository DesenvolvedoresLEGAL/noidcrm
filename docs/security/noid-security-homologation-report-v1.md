# NOID Security Homologation Report v1

**Sprint:** NOID-SECURITY 1.0
**Data:** 2026-07-20
**Branch:** `edit/edt-a55fcace-8bf8-4397-8a09-7d2525483a95`
**Commit-base:** `6b91a6ffaf79035fd158d4e4eae20d754a2ac561`
**Autoria operacional:** HUMANOID PLATFORMS LTDA
**Escopo:** homologação multi-tenant, Storage, aceite de convite, proteção do
repositório e guardas contra a produção `urihdqturaebhiefwjnw`.

## 1. Resumo executivo

Nesta sprint foi executado apenas o que é possível **sem tocar produção e sem
um projeto Supabase de staging exclusivo**. Isso significa:

- **Ações aplicadas** (código/documentação, sem impacto em banco):
  - `.gitignore` protege padrões `.env*` (novo).
  - `.env.example` e `.env.staging.example` sanitizados (novos).
  - 6 relatórios de segurança versionados (este + demais artefatos da sprint).
  - Guardas existentes contra o ref de produção `urihdqturaebhiefwjnw`
    revisadas em `scripts/apply-migrations-staging.sh`,
    `scripts/staging-smoke-tests.sh`, `src/test/security/tenant-isolation/**`
    e `.github/workflows/tenant-isolation.yml`.

- **Ações bloqueadas** (dependem de staging humano):
  - Execução da suíte multi-tenant em Supabase real.
  - Aplicação e homologação das 7 migrations de Storage staged.
  - Homologação end-to-end do aceite de convite.
  - Classificação individual das 27 policies `USING (true)` via teste dinâmico.
  - Auditoria linha a linha das funções SECURITY DEFINER críticas com fixtures.

- **Ações que exigem ação humana no GitHub**:
  - Tornar `DesenvolvedoresLEGAL/noidcrm` privado (P0-11) ou registrar
    decisão executiva formal alternativa.
  - `git rm --cached .env` seguido de commit (o agente Lovable é proibido de
    rodar comandos Git de escrita).

- **Produção intocada:** nenhuma migration, policy, bucket, RLS, Auth,
  Edge Function ou secret de produção foi criado, alterado ou removido.

## 2. Escopo e ambientes

| Ambiente | Ref | Uso nesta sprint |
| --- | --- | --- |
| Produção | `urihdqturaebhiefwjnw` | **PROIBIDO — nenhuma operação executada** |
| Staging | *(não provisionado)* | Alvo obrigatório das Fases 3–9; bloqueado |
| Sandbox Lovable (dev) | Compartilha o backend de produção conforme diagnóstico anterior — por isso proibido de receber alterações desta sprint | Somente leitura de estrutura já conhecida |

## 3. Proteções contra produção

Guardas já em código (revisadas):

- `scripts/apply-migrations-staging.sh` — aborta se `TEST_SUPABASE_URL` ou
  `TEST_SUPABASE_DB_URL` contêm `urihdqturaebhiefwjnw`, exige confirmação
  interativa fora de CI, valida presença de service_role de staging.
- `src/test/security/tenant-isolation/fixture.ts` — compara host de
  `TEST_SUPABASE_URL` com `VITE_SUPABASE_URL` e desabilita a suíte se iguais.
- `.github/workflows/tenant-isolation.yml` — mesma comparação por host, só
  executa quando `vars.TENANT_ISOLATION_ENABLED == 'true'`.

Reforço aplicado nesta sprint: `.env.staging.example` documenta a variável
sentinela `PROD_SUPABASE_PROJECT_REF=urihdqturaebhiefwjnw` para uso futuro em
CI adicional.

## 4. Estado do repositório

Ver `docs/security/repository-protection-report-v1.md`.

Resumo:

- Visibilidade: **PÚBLICA** (não alterada; P0-11 aberto).
- `.env` foi rastreado até esta sprint; `.gitignore` corrigido; remoção do
  tracking depende de ação humana (`git rm --cached .env`).
- Nenhum service_role, JWT privado, chave OpenAI/Slack/Apollo/PEM foi
  encontrado na árvore atual.
- Histórico Git recebeu apenas varredura preliminar; recomenda-se
  `gitleaks` em runner externo.

## 5. Staging

**Não provisionado.** Sem staging, não foram criadas organizações
sintéticas, usuários, empresas, contatos, oportunidades ou propostas.
Nenhum dado real da produção foi copiado. `docs/security/staging-provisioning-guide.md`
segue como manual de provisionamento humano.

## 6. Suíte multi-tenant

Ver `docs/security/tenant-isolation-execution-report-v1.md`. Executada: **0
testes**. Reprovados: **0**. Aprovados: **0**. Vazamentos comprovados: **0**
(não descartados).

## 7. Storage

Ver `docs/security/storage-hardening-execution-report-v1.md`. Migrations
staged permanecem staged. Nenhum bucket alterado.

## 8. Convites

Ver `docs/security/invitation-security-execution-report-v1.md`. Análise
estática sem achado bloqueador; homologação depende de staging.

## 9. Policies `USING (true)` e SECURITY DEFINER

Não classificadas individualmente. A auditoria estática permanece em
`docs/security/phase1-rls-audit.md` e `docs/security/linter-warning-matrix.csv`.
Redução de 741 → 254 warnings (Fase 1.5) e correção de 10 views com
`security_invoker=on` (Fase 1) continuam válidas como mitigação parcial.

## 10. CI de segurança

`.github/workflows/tenant-isolation.yml` já possui guarda anti-produção e
gate `TENANT_ISOLATION_ENABLED`. Nenhuma alteração aplicada nesta sprint.

## 11. Achados

Matriz completa em `docs/security/security-findings-v1.csv` (10 achados
registrados). Distribuição:

| Severidade | OPEN | BLOCKED | FIXED_IN_STAGING | VALIDATED |
| --- | ---: | ---: | ---: | ---: |
| CRITICAL | 0 | 1 | 0 | 0 |
| HIGH | 2 | 2 | 1 | 0 |
| MEDIUM | 2 | 0 | 0 | 0 |
| LOW | 0 | 0 | 1 | 0 |
| INFO | 0 | 0 | 0 | 1 |

## 12. Rollback

- `.env.example` / `.env.staging.example`: podem ser removidos sem impacto.
- `.gitignore`: reverter para versão anterior restaura comportamento antigo
  (mas re-expõe `.env`).
- Nenhuma migration foi aplicada em nenhum ambiente — nada a reverter no banco.

## 13. Recomendação final

> **SECURITY NO-GO** para o primeiro Cliente Fundador.

Justificativa:

1. **P0-01, P0-03, P0-05** permanecem sem homologação empírica (staging
   ausente).
2. **P0-11** (repositório público) segue aberto e depende de ação humana no
   GitHub.
3. `.env` ainda rastreado depende de commit humano para untrack.
4. Sem essas quatro condições satisfeitas, a exigência do prompt — “Zero
   vazamentos cross-tenant nos cenários homologados” e “Repositório privado
   ou decisão executiva formal alternativa” — não pode ser marcada como
   atendida.

Assim que (a) staging for provisionado, (b) suíte for executada 100% verde,
(c) migrations de Storage aplicadas + homologadas em staging, (d) repositório
privado ou decisão formal alternativa, e (e) `.env` untracked, a decisão
poderá ser revista para **SECURITY GO CONDICIONAL** ou **SECURITY GO**.

## 14. Próxima sprint autorizada

Enquanto os P0 de segurança permanecerem abertos, apenas a **continuação
NOID-SECURITY** está autorizada. **NOID-VERTICAL 0.3A** (correções P0 do
Revenue Core) só depois desta sprint atingir GO ou GO CONDICIONAL. **NOID-
VERTICAL 0.3** (Events Template) segue bloqueado por todos os gates.
