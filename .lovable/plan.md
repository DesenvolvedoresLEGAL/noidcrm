# KAI.18.13 — Apollo Reveal Reliability Core (P0)

Escopo congelado: apenas confiabilidade da revelação de telefone/e-mail. Nenhuma tela nova, nenhuma alteração em CRM/Pipeline/Forecast/Queue/Scoring/Copilot.

## Auditoria já executada (fatos confirmados)

Call graph atual:

```text
ProspectContactsTab
  ├─ useRevealContact ──> revealContact() ──> edge: kairos-apollo-reveal-contact  (oficial)
  └─ useRevealApolloContact ──> revealApolloContact() ──> edge: reveal-apollo-contact  (DUPLICADA)

kairos-apollo-reveal-contact ──> Apollo people/match (reveal_phone_number + webhook_url)
                            └─> update enriched_contact_profiles + enrichment_jobs + apollo_reveal_audit
Apollo (async) ──> edge: apollo-phone-webhook ──> update do contato + audit + novo enrichment_jobs

run-apollo-enrichment ──> upsert em enriched_contact_profiles (mesmo alvo, sem guarda de merge)
kairos-apollo-invisible ──> chama reveal internamente
```

Pontos exatos de falso sucesso encontrados:

1. `src/hooks/intelligence/useRevealContact.ts` — o toast usa apenas `res.status` e o rótulo do `requested_data_type`. Com `both`, se só o e-mail voltou, `finalStatus` vira `revealed` e a UI escreve "e-mail e telefone revelado para X (1 crédito)". Foi exatamente o caso HYPERA/Andreia.
2. `supabase/functions/kairos-apollo-reveal-contact/index.ts` — `finalStatus = "revealed"` quando `revealedEmail || revealedPhone`; a resposta não tem status por campo, só um status agregado.
3. Não há read-back: a função responde a partir das variáveis em memória, nunca relê `enriched_contact_profiles` após o `update`.
4. `credits_used` é incrementado por dedução local (+1 por campo), não pelo retorno do provedor.
5. Sobrescrita: `run-apollo-enrichment` faz `upsert(rows, { onConflict: 'prospect_id,email_normalized' })` no mesmo registro, sem regra de merge que proteja valor já revelado. A auditoria de Andreia (`b3f0bfb3…`) tem `status=revealed, phone_after=+55 19 3522-4200`, mas hoje o contato está `phone = null`, `phone_reveal_status = not_found`, `email_reveal_status = not_requested` — o dado revelado foi perdido por escrita posterior.
6. Estado assíncrono é gravado como `requested`, mas não existe reconciliação: se o webhook não chegar, o job fica em `running` para sempre (o hook só faz polling de 30 s no cliente).

Estado atual dos dados (consultado): 0 linhas com `revealed` sem valor, 0 jobs pendentes vencidos. O reparo é preventivo + recuperação de payload.

## O que será implementado

### 1. Orquestrador único
- `kairos-apollo-reveal-contact` passa a ser a única implementação.
- `reveal-apollo-contact` vira wrapper fino que delega (mantido só para não quebrar callers), e `useRevealApolloContact` / `revealApolloContact` passam a apontar para o oficial.
- Nenhuma tela chama Apollo direto (já é o caso).

### 2. Contrato canônico por campo
Resposta passa a conter `overall_status` + blocos `phone` e `email` independentes (`status`, `revealed`, `value`, `source_type`, `credits_used`, `reason`), além de `job_id` e `correlation_id`, conforme o contrato da sprint.

### 3. Máquina de estados por campo
`not_requested | requested | pending_provider | webhook_received | persisting | revealed | not_found | rejected_company_phone | failed`.
`revealed` só é emitido com valor não vazio + flag + status coerentes no banco. `both` resolve para `revealed | partial | pending | not_found | failed`.

### 4. Persistência atômica + read-back
- Nova RPC `fn_finalize_apollo_reveal(...)`: valida org/contato/job, normaliza e classifica telefone, bloqueia telefone corporativo, atualiza contato + job + `apollo_reveal_audit`, e **retorna o registro relido**.
- Se o read-back não trouxer o valor, o resultado é `failed`, nunca `revealed`.
- Webhook (`apollo-phone-webhook`) passa a persistir pela mesma RPC (idempotente por `provider_request_id`/job).

### 5. Proteção contra sobrescrita
- Guarda no merge: em `run-apollo-enrichment` (e demais writers de `enriched_contact_profiles`), valor revelado válido nunca é substituído por `null`, string vazia, dado obfuscado, telefone corporativo ou status inferior.
- Implementado no nível do banco (trigger `BEFORE UPDATE` de preservação) para cobrir todos os caminhos, incluindo replay/raw/sync.

### 6. Idempotência e créditos
- Chave canônica `organization_id + contact_id + requested_data_type + provider`.
- Dado já revelado → retorna sem chamar Apollo. Job pendente para o mesmo par → retorna o job existente. Duplo clique/refresh/polling não geram chamada paga.
- Retry pago só após estado terminal e com confirmação explícita na UI.
- `credits_used` exibido apenas quando confirmado pela auditoria/retorno.

### 7. Reconciliação
- Nova edge `kairos-apollo-reveal-status-sync`: varre jobs `pending_provider`, consulta status pelo provider request id (sem repetir operação paga), persiste via a mesma RPC, encerra jobs, respeita limite de tentativas e timeout.
- Sem edge function aberta esperando 90 s.

### 8. Frontend sem falso sucesso
- `useRevealContact` reescrito: acompanha o job (Realtime em `enriched_contact_profiles` + fallback de polling), só mostra mensagem final após estado terminal e valor lido do banco.
- Mensagens exatamente conforme a sprint (pendente, telefone salvo, e-mail salvo, ambos salvos, parcial, telefone corporativo, não encontrado, erro).
- `ProspectContactsTab`: botões desabilitados apenas durante job pendente do mesmo campo; "Telefone" permanece ativo com e-mail já revelado e vice-versa; "Ambos" solicita só o que falta; retry após `not_found` exige confirmação; `rejected_company_phone` não entra em loop.

### 9. Reparo de dados (sem consumir crédito)
Migration idempotente:
- `phone_revealed = true AND phone IS NULL` → `failed` / `revealed_without_persisted_value`.
- `email_revealed = true AND email IS NULL` → mesma correção.
- jobs pendentes > 15 min → reconciliar por provider request id; sem id, `failed`.
- payload já salvo em `apollo_reveal_audit` / `enrichment_jobs` com telefone pessoal válido não persistido → reprocessa localmente e marca `recovered_from_existing_payload`.

### 10. Testes
Suite cobrindo os 22 cenários listados na sprint (imediato, assíncrono, parcial, corporativo, accepted sem dado, timeout, webhook duplicado, duplo clique, refresh, tentativas de sobrescrita, cross-org, toast só após read-back, créditos não inventados, reparo, ausência de "eternamente aguardando"). Rodar typecheck, lint, testes e build. Nenhuma chamada paga ao Apollo durante a implementação.

## Arquivos afetados

- `supabase/functions/kairos-apollo-reveal-contact/index.ts` (reescrita do fluxo de decisão/resposta)
- `supabase/functions/reveal-apollo-contact/index.ts` (vira delegador)
- `supabase/functions/apollo-phone-webhook/index.ts` (persistência via RPC, idempotente)
- `supabase/functions/kairos-apollo-reveal-status-sync/index.ts` (novo)
- `supabase/functions/run-apollo-enrichment/index.ts` (merge protegido)
- `supabase/functions/_shared/apollo-reveal-contract.ts` (novo: tipos/estados)
- Migration: RPC `fn_finalize_apollo_reveal`, trigger de preservação, colunas de job/idempotência se faltarem, script de reparo
- `src/hooks/intelligence/useRevealContact.ts`, `src/hooks/useRevealApolloContact.ts`, `src/services/intelligence/apolloInvisible.ts`, `src/services/enrichment/apolloService.ts`, `src/components/playbook/ProspectContactsTab.tsx`
- Testes em `src/test/…` e testes Deno das edges

## Entrega final

Ao concluir, o resumo trará: causa raiz, call graph antes/depois, duplicidades removidas, arquivos criados/alterados, migration/RPC aplicada, estados implementados, estratégia webhook/polling, proteção de créditos, registros corrigidos pelo reparo, resultado de testes/typecheck/build, funções publicadas, plano de teste manual de 1 contato e riscos remanescentes.

## Riscos

- Trigger de preservação pode bloquear correções legítimas: previsto caminho administrativo auditado para invalidar dado revelado.
- Formato real do payload assíncrono do Apollo é inferido do código atual; a reconciliação será tolerante a formatos e sempre cairá em `pending_provider`/`failed` em vez de `revealed`.
