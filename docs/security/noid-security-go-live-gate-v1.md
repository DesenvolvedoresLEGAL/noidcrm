# NOID Security Go-Live Gate v1

**Sprint:** NOID-SECURITY 1.0
**Escopo:** checklist binário oficial para autorização do primeiro Cliente Fundador.
**Regra:** cada item é `sim` ou `não`. Qualquer `não` em bloco obrigatório impede SECURITY GO.

## REPOSITÓRIO

- [ ] Repositório privado **ou** decisão formal alternativa registrada — **não** (P0-11 aberto)
- [ ] `.env` fora do tracking — **não** (agente aplicou `.gitignore`; `git rm --cached .env` humano pendente)
- [ ] `.gitignore` corrigido — **não** (arquivo read-only no sandbox Lovable; pendente de edição humana)
- [x] Árvore atual sem secret privado conhecido — **sim**
- [ ] Histórico Git revisado exaustivamente — **não** (só preliminar; gitleaks pendente)
- [ ] Secrets privados rotacionados quando aplicável — **n/a** (nenhum privado detectado)
- [ ] Branch principal protegida ou risco registrado — **não confirmado**

## STAGING

- [ ] Projeto Supabase separado provisionado — **não**
- [ ] Ref diferente da produção `urihdqturaebhiefwjnw` — **n/a** (staging inexistente)
- [ ] Secrets separados no GitHub Environment `staging` — **não**
- [ ] Sem dados reais em staging — **n/a**
- [ ] Smoke tests verdes — **não executados**

## MULTI-TENANT

- [ ] Duas organizações sintéticas criadas — **não**
- [ ] Doze usuários (6 papéis × 2 orgs) — **não**
- [ ] SELECT cross-org negado — **não executado**
- [ ] INSERT cross-org negado — **não executado**
- [ ] UPDATE cross-org negado — **não executado**
- [ ] DELETE cross-org negado — **não executado**
- [ ] RPCs isoladas — **não executado**
- [ ] Views isoladas — **não executado**
- [ ] Edge Functions isoladas — **não executado**
- [ ] Importação isolada — **não executado**
- [ ] Notificações isoladas — **não executado**

## STORAGE

- [ ] Buckets sensíveis privados — **não** (migrations staged não aplicadas)
- [ ] Direct URL negada em buckets sensíveis — **não executado**
- [ ] Signed URL válida funciona — **não executado**
- [ ] Signed URL expirada falha — **não executado**
- [ ] Cross-org negado em signed URL — **não executado**
- [ ] `proposals.pdf_url` protegido (07b) — **não** (07a → 07b não executado)
- [ ] Rollback validado — **não executado**

## CONVITES

- [ ] TTL obrigatório — **estatico ok, dinâmico não executado**
- [ ] Single-use enforcement — **estatico ok, dinâmico não executado**
- [ ] Replay negado — **não executado**
- [ ] Cross-org negado — **não executado**
- [ ] Role escalation negada — **não executado**
- [ ] Token não aparece em log — **não executado**

## PRODUÇÃO (obrigatório: TODOS `sim`)

- [x] Nenhuma escrita realizada em produção — **sim**
- [x] Nenhuma migration aplicada em produção — **sim**
- [x] Nenhuma policy alterada em produção — **sim**
- [x] Nenhum bucket alterado em produção — **sim**
- [x] Nenhum dado criado em produção — **sim**
- [x] Nenhum deploy realizado em produção — **sim**
- [x] Nenhum secret de produção utilizado — **sim**

## DECISÃO

- [ ] SECURITY GO
- [ ] SECURITY GO CONDICIONAL
- [x] **SECURITY NO-GO**

**Motivo:** P0-01, P0-03, P0-05 e P0-11 permanecem abertos.
A sprint NOID-SECURITY 1.1 foi **interrompida na Fase 0** porque nenhum
secret de staging (`TEST_SUPABASE_*` / `SUPABASE_STAGING_*`) estava
disponível no ambiente de execução. Conforme a regra absoluta da 1.1,
produção **não** foi usada como fallback, nada foi simulado e nenhum
teste foi marcado como aprovado. Evidência completa em
`docs/security/staging-environment-evidence-v1.md`.

## Ressalva sobre `.gitignore` (correção herdada da 1.0)

No sandbox Lovable os arquivos `.env` e `.gitignore` são somente-leitura.
O agente **não** corrigiu o `.gitignore` tracked no repositório na 1.0;
qualquer frase anterior nesse sentido deve ser lida como "diff proposto,
não aplicado". A correção depende de commit humano local
(`git rm --cached .env` + edição do `.gitignore`).

## Próxima sprint autorizada

**Continuação NOID-SECURITY 1.1** — provisionar staging fora do sandbox,
cadastrar secrets `TEST_SUPABASE_*` no GitHub Environment `staging`,
habilitar `TENANT_ISOLATION_ENABLED=true`, tornar repositório privado
e remover `.env` do tracking; em seguida reexecutar Fase 0 e prosseguir
com as fases dinâmicas (schema, smoke, multi-tenant, storage, convites).
