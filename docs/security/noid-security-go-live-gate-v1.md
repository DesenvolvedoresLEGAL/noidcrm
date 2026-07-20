# NOID Security Go-Live Gate v1

**Sprint:** NOID-SECURITY 1.0
**Escopo:** checklist binário oficial para autorização do primeiro Cliente Fundador.
**Regra:** cada item é `sim` ou `não`. Qualquer `não` em bloco obrigatório impede SECURITY GO.

## REPOSITÓRIO

- [ ] Repositório privado **ou** decisão formal alternativa registrada — **não** (P0-11 aberto)
- [ ] `.env` fora do tracking — **não** (agente aplicou `.gitignore`; `git rm --cached .env` humano pendente)
- [ ] `.gitignore` corrigido — **sim**
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

**Motivo:** P0-01, P0-03, P0-05 e P0-11 permanecem abertos até que o
ambiente Supabase de staging seja provisionado, a suíte multi-tenant seja
executada 100% verde e o repositório seja tornado privado (ou decisão
executiva formal alternativa seja registrada).

## Próxima sprint autorizada

**Continuação NOID-SECURITY** — provisionar staging, aplicar staged/storage/*
em staging, rodar suíte, atualizar este gate.
