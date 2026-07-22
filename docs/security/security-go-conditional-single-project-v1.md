# SECURITY GO CONDICIONAL — PROJETO ÚNICO

**Decisão:** `SECURITY GO CONDICIONAL — PROJETO ÚNICO`
Este GO autoriza continuidade controlada e não constitui certificação, pentest, garantia de ausência de vulnerabilidades ou aprovação irrestrita de produção.

**Data/hora UTC:** 2026-07-22
**Change ID:** `NSEC-1.2-CHG-030`
**Aprovador executivo:** HUMANOID (autorização explícita registrada no briefing NSEC-1.2-CHG-030)
**Programa:** NOID-SECURITY 1.2 — encerramento formal

## 1. Escopo

Consolidar documentalmente os resultados do programa NOID-SECURITY 1.2
(CHG-001 → CHG-029), registrar riscos residuais e condições operacionais
obrigatórias, e emitir a decisão máxima possível para a arquitetura atual.

## 2. Arquitetura atual

- Projeto único Lovable Cloud / Supabase (referência interna controlada).
- Dados reais e desenvolvimento controlado no mesmo backend.
- Sem ambiente de staging independente homologado.
- Modelo operacional: **PROJETO ÚNICO COM HARDENING CONTROLADO**.

## 3. Limitação do projeto único

Por operar em backend único, o nível máximo alcançável é **condicional**.
Não é possível emitir GO irrestrito, "SECURITY CERTIFIED", "SOC 2 READY",
"LGPD CERTIFIED", "PENTEST APPROVED" ou equivalentes.

## 4. Evidências dinâmicas consolidadas

### SELECT multi-tenant
- 168/168 probes aprovados.
- 144 tentativas cross-org bloqueadas.
- 24 verificações positivas same-org aprovadas.
- Zero vazamento confirmado nas superfícies testadas.

### Accounts — homologado
SELECT; INSERT same-org; INSERT cross-tenant bloqueado; viewer INSERT
bloqueado; UPDATE owner same-org; viewer UPDATE bloqueado; UPDATE
cross-tenant bloqueado; DELETE admin same-org; viewer DELETE bloqueado;
DELETE cross-tenant bloqueado.

### Contacts — homologado
SELECT; INSERT básico; viewer INSERT bloqueado; organização cross-tenant
bloqueada; vínculo `account_id` tenant-aware; matriz relacional com
account; UPDATE owner same-org; viewer UPDATE bloqueado; UPDATE
cross-tenant bloqueado; DELETE admin same-org; viewer DELETE bloqueado;
DELETE cross-tenant bloqueado.

### Opportunities — homologado
SELECT; INSERT básico; viewer INSERT bloqueado; organization_id;
pipeline_id; stage_id; compatibilidade pipeline↔stage; account_id
tenant-aware; contact_id tenant-aware; compatibilidade account↔contact
same-tenant; matriz por papel do INSERT relacional; UPDATE owner
same-org; viewer UPDATE bloqueado; UPDATE cross-tenant bloqueado;
DELETE admin same-org; viewer DELETE bloqueado; DELETE cross-tenant
bloqueado.

### Activities — homologação parcial
Smoke final homologado para: INSERT neutro same-org; bloqueio de
`opportunity_id` cross-tenant.

### Proposals — homologação parcial
Smoke final homologado para: INSERT draft neutro same-org; bloqueio de
`opportunity_id` cross-tenant.

### Storage
Bucket `opportunity-files`: privado; write/read/delete same-org
aprovado; escrita cross-tenant bloqueada; zero objeto sintético
persistente.

## 5. Superfícies homologadas

Accounts (SELECT/INSERT/UPDATE/DELETE + matriz por papel + integridade
tenant); Contacts (idem + vínculo account tenant-aware); Opportunities
(idem + pipeline/stage/account/contact tenant-aware + compatibilidade
same-tenant); Activities INSERT smoke (opportunity tenant-aware);
Proposals INSERT smoke (opportunity tenant-aware); Storage
`opportunity-files` (privado, tenant-aware).

## 6. Superfícies não homologadas

- Matriz completa de UPDATE por manager/sales/cs.
- Matriz por papel de activities/proposals.
- UPDATE/DELETE de activities e proposals.
- Relações adicionais de activities.
- Fluxos completos de proposals (PDF, envio, assinatura, aceite,
  cobrança, link público, demais fluxos comerciais).
- Bucket `proposal-pdfs` (fluxo completo e signed URLs).
- Migrations staged de Storage restantes.
- Aceite de convite end-to-end.

## 7. Findings resolvidos (dinamicamente)

| ID | Descrição | Correção |
|---|---|---|
| SEC-011 | viewer INSERT accounts | `nsec12_accounts_insert_block_viewer` |
| SEC-012 | viewer INSERT contacts | `nsec12_contacts_insert_block_viewer` |
| SEC-013 | viewer INSERT opportunities | `nsec12_opportunities_insert_block_viewer` |
| SEC-014 | pipeline cross-tenant em opportunities | `nsec12_opportunities_insert_tenant_relations_guard` |
| SEC-015 | stage cross-tenant em opportunities | `nsec12_opportunities_insert_tenant_relations_guard` |
| SEC-016 | account cross-tenant em opportunities | `nsec12_opportunities_insert_account_contact_tenant_guard` |
| SEC-017 | contact cross-tenant em opportunities | `nsec12_opportunities_insert_account_contact_tenant_guard` |
| SEC-018 | account/contact incompatível same-tenant | `nsec12_opportunities_insert_account_contact_match_guard` |
| SEC-019 | viewer UPDATE accounts/contacts | `nsec12_accounts_update_block_viewer` + `nsec12_contacts_update_block_viewer` |
| SEC-023 | activity com opportunity cross-tenant | `nsec12_activities_insert_opportunity_tenant_guard` |
| SEC-024 | proposal com opportunity cross-tenant | `nsec12_proposals_insert_opportunity_tenant_guard` |

**SEC-020, SEC-021, SEC-022** não foram confirmados dinamicamente e
não devem ser apresentados como findings abertos.

## 8. Findings abertos / bloqueados

| ID | Severidade | Estado | Resumo |
|---|---|---|---|
| SEC-001 | HIGH | OPEN | Repositório público ou aceite executivo pendente |
| SEC-002 | HIGH | OPEN | `.env` rastreado pelo Git |
| SEC-004 | MEDIUM | OPEN | Histórico Git sem varredura full-history |
| SEC-005 | CRITICAL | BLOCKED | Staging separado não provisionado |
| SEC-006 | HIGH | BLOCKED | Hardening completo de Storage / `proposal-pdfs` |
| SEC-007 | HIGH | BLOCKED | Aceite de convite não homologado end-to-end |
| SEC-008 | MEDIUM | OPEN | 27 policies `USING(true)` sem classificação individual |
| SEC-009 | MEDIUM | OPEN | Auditoria de SECURITY DEFINER parcial |

Também permanecem pendentes: matriz completa UPDATE por
manager/sales/cs; matriz por papel de activities/proposals;
UPDATE/DELETE em activities/proposals; relações adicionais de
activities; fluxos completos de proposals; `proposal-pdfs` dinâmico.

## 9. Dez policies RESTRICTIVE permanentes

Confirmadas em produção read-only (10/10 presentes, todas
`permissive=RESTRICTIVE`):

| # | Policy | Tabela | Operação | Role | Finding | Rollback |
|---|---|---|---|---|---|---|
| 1 | `nsec12_accounts_insert_block_viewer` | accounts | INSERT | authenticated | SEC-011 | `DROP POLICY IF EXISTS ... ON public.accounts` |
| 2 | `nsec12_contacts_insert_block_viewer` | contacts | INSERT | authenticated | SEC-012 | `DROP POLICY IF EXISTS ... ON public.contacts` |
| 3 | `nsec12_opportunities_insert_block_viewer` | opportunities | INSERT | authenticated | SEC-013 | `DROP POLICY IF EXISTS ... ON public.opportunities` |
| 4 | `nsec12_opportunities_insert_tenant_relations_guard` | opportunities | INSERT | authenticated | SEC-014/015 | `DROP POLICY IF EXISTS ... ON public.opportunities` |
| 5 | `nsec12_opportunities_insert_account_contact_tenant_guard` | opportunities | INSERT | authenticated | SEC-016/017 | `DROP POLICY IF EXISTS ... ON public.opportunities` |
| 6 | `nsec12_opportunities_insert_account_contact_match_guard` | opportunities | INSERT | authenticated | SEC-018 | `DROP POLICY IF EXISTS ... ON public.opportunities` |
| 7 | `nsec12_accounts_update_block_viewer` | accounts | UPDATE | authenticated | SEC-019 | `DROP POLICY IF EXISTS ... ON public.accounts` |
| 8 | `nsec12_contacts_update_block_viewer` | contacts | UPDATE | authenticated | SEC-019 | `DROP POLICY IF EXISTS ... ON public.contacts` |
| 9 | `nsec12_activities_insert_opportunity_tenant_guard` | activities | INSERT | authenticated | SEC-023 | `DROP POLICY IF EXISTS ... ON public.activities` |
| 10 | `nsec12_proposals_insert_opportunity_tenant_guard` | proposals | INSERT | authenticated | SEC-024 | `DROP POLICY IF EXISTS ... ON public.proposals` |

Cada policy exige que o payload esteja alinhado ao tenant efetivo
(`USING` e/ou `WITH CHECK` cruzando `organization_id`, papel efetivo ou
relação FK tenant-aware). Definições completas preservadas nas
migrations `20260720…` → `20260721…`.

## 10. Resultado do cleanup (CHG-029)

- Accounts sintéticas ativas: 0
- Contacts sintéticos ativos: 0
- Opportunities sintéticas ativas: 0
- Activities sintéticas persistentes: 0
- Proposals sintéticas persistentes: 0
- Objetos Storage sintéticos: 0
- Memberships sintéticas: 0
- User_roles sintéticos: 0
- RPCs temporárias `nsec12_%`: 0
- Edge Functions temporárias `nsec12-*`: 0
- Secrets `NSEC12_*`: 0

## 11. Evidence retention

Retenções intencionais, sem função operacional:

- Owner A e Owner B (auth users) — `EVIDENCE RETENTION PRINCIPAL`;
  ambos sem `organization_members`, sem `user_roles`, sem uso futuro.
- 2 organizações shell — `EVIDENCE RETENTION SHELL`; sem memberships,
  sem dados sintéticos ativos, sem pipelines/stages operacionais.
- 2 pipelines shell e 2 stages shell (retidos por FK `NO_ACTION`).
- Accounts/contacts/opportunities sintéticas soft-deleted (triggers
  impedem hard delete sem bypass proibido).
- Tombstone metodológico (registro histórico da Fase 3, referenciado
  nos runbooks técnicos).
- `audit_log` e `entity_snapshot` relacionados.
- Migrations históricas `20260720…` → `20260721…`.
- Relatórios e findings.

## 12. Baseline real (leitura read-only CHG-030)

| Métrica | Valor | Observação |
|---|---:|---|
| Organizações (inclui 2 shells) | 10 | 8 reais + 2 retention shells |
| Accounts ativas | 4.784 | Real (drift natural desde baseline CHG-029) |
| Contacts ativos | 1.690 | Real |
| Opportunities ativas | 2.225 | Real |
| Pipelines | 19 | Inclui 2 shells retidos |
| Stages | 100 | Inclui 2 shells retidos |
| Members | 32 | Real (0 sintéticos) |
| Policies `nsec12_*` | 10 | 100% RESTRICTIVE |
| RPCs `nsec12_%` | 0 | Removidas |
| Edge Functions `nsec12-*` | 0 | Removidas |
| Secrets `NSEC12_*` | 0 | Removidos |
| Tombstone metodológico | presente | Intacto |

Variações em contadores reais versus baseline CHG-029 refletem operação
regular do produto (nenhum dado real foi tocado pelo programa NSEC-1.2).

## 13. Condições do GO

Autoriza:

- Retomada do desenvolvimento regular.
- Continuidade do NOID RevenueOS e NOID Revenue Academy.
- Continuidade da NOID-VERTICAL 0.3A.
- Piloto controlado com Founder Client.
- Operação controlada no projeto único.
- Mudanças GREEN.
- Mudanças YELLOW individualmente autorizadas.

Não autoriza automaticamente:

- Onboarding massivo de tenants.
- Migração destrutiva.
- Afrouxamento de RLS.
- Uso de service role no frontend.
- Alteração de Auth ou convites sem revisão.
- Abertura pública de buckets sensíveis.
- Ativação de fluxo não homologado de `proposal-pdfs`.
- Publish de mudança backend sem rollback.
- Remoção das policies `nsec12_*`.
- Compartilhamento de secrets.
- Uso operacional de principals ou shells de evidência.

## 14. Guardrails GREEN / YELLOW / RED

### GREEN (permitido)
Documentação, análise read-only, componentes visuais sem mudança de
autorização, correções frontend sem publish automático, testes
estáticos, relatórios.
Não pode: criar fixture, mudar banco, mudar policy, mudar Auth, mudar
Storage, publicar automaticamente.

### YELLOW (autorização individual)
Migration, policy, RPC, trigger, Auth, Edge Function, Storage,
integração, backend, mudança de autorização, publish com impacto
operacional. Cada YELLOW exige: autorização explícita; escopo único;
pre-flight; baseline; rollback; execução sequencial; zero dado real de
teste; smoke read-only; relatório; parada obrigatória.

### RED (proibido)
DROP destrutivo sem plano aprovado; DELETE genérico; hard delete com
bypass; desabilitar trigger; alterar `session_replication_role`; usar
SECURITY DEFINER para contornar RLS; service role no `Authorization`
de probe; editar dado real para testar; remover logs de auditoria;
remover migrations históricas; remover policies homologadas sem
autorização executiva.

## 15. Regras de secrets

- Service role somente server-side; nunca no frontend.
- Nunca JWT/secret em relatório, documentação ou log.
- Rotacionar qualquer secret privado exposto.
- `VITE_*` apenas publishable — nunca tratar como segredo.

## 16. Restrições para invites

Até SEC-007 ser homologado: não utilizar convite como único controle
de segurança; evitar onboarding externo automatizado; preferir
provisionamento administrativo controlado; qualquer mudança em
invitation flow exige YELLOW.

## 17. Restrições para `proposal-pdfs`

Até SEC-006 ser resolvido: manter bucket privado; não criar URL pública
permanente; usar signed URLs curtas quando o fluxo for ativado;
qualquer mudança exige YELLOW; não declarar fluxo PDF homologado.

## 18. Restrições para repositório

Enquanto SEC-001/002/004 permanecerem abertos: nenhum secret privado
commitado; revisão antes de merge; priorizar tornar o repositório
privado; remover `.env` do tracking; executar scan full-history;
qualquer hit privado exige rotação imediata.

## 19. Invalidação automática do GO

O GO fica suspenso até nova revisão caso ocorra:

1. Remoção ou alteração de policy `nsec12_*`.
2. Desativação de RLS.
3. Mudança material em `organization_members` ou `org_role`.
4. Mudança no fluxo de Auth/invites.
5. Bucket sensível tornado público.
6. Mudança no path tenant-aware de Storage.
7. Service role exposta ao cliente.
8. Novo secret privado no Git.
9. Alteração de FK/trigger usado nos controles homologados.
10. Novo tenant externo sem aplicação das condições.
11. Vazamento cross-tenant confirmado.
12. Dado real alterado por teste.
13. Restauração de principal, membership ou role sintético.
14. Recriação de ferramenta NSEC temporária.
15. Nova arquitetura multi-projeto ou migração de Supabase.

## 20. Backlog pós-GO

Detalhado em `docs/security/post-go-hardening-backlog-v1.md`.

## 21. Rollbacks disponíveis

- Cada policy `nsec12_*`: `DROP POLICY IF EXISTS <policy> ON <tabela>`
  (registrado por policy nas migrations históricas).
- Migrations de Storage staged em `supabase/migrations-staged/storage/`
  possuem README/plano de rollback próprio.
- Nenhuma migration desta CHG-030 (documental).

## 22. Declaração de aceite de risco executivo

A administração reconhece que:

1. O projeto permanece em ambiente único.
2. Não existe staging independente homologado.
3. Existem findings HIGH/CRITICAL residuais fora das superfícies
   dinamicamente corrigidas.
4. O GO não representa ausência de risco.
5. O GO autoriza continuidade controlada sob os guardrails definidos.
6. Qualquer remoção dos guardrails invalida automaticamente o GO.

## 23. Verificações read-only realizadas (CHG-030)

- 10/10 policies `nsec12_*` presentes e RESTRICTIVE. ✅
- 0 RPCs `nsec12_%` em `public`. ✅
- 0 Edge Functions `nsec12-*` no projeto. ✅
- 0 secrets `NSEC12_*`. ✅
- 0 referências funcionais a ferramentas NSEC em `src/`,
  `supabase/functions/`, `scripts/`. ✅
- Tombstone metodológico presente. ✅
- Zero fixture sintética ativa. ✅
- Contadores reais consistentes com cleanup (drift natural de operação
  regular). ✅
- Nenhum dado real alterado pelo programa. ✅
- Nenhum secret ou JWT nos relatórios. ✅

## 24. Decisão final

`NSEC-1.2-CHG-030 VALIDATED — SECURITY GO CONDICIONAL — PROJETO ÚNICO`

`SECURITY GO CONDICIONAL — PROJETO ÚNICO`
Este GO autoriza continuidade controlada e não constitui certificação,
pentest, garantia de ausência de vulnerabilidades ou aprovação
irrestrita de produção.

**Programa NOID-SECURITY 1.2 formalmente encerrado.**
