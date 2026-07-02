
## Diagnóstico

Puxei os últimos 3h da base + auditoria e o problema tem duas caras — nenhuma é bug do Apollo em si, é como a gente interpreta a resposta.

- **Aguardando infinito**: em 3h houve **26 stale_pending_cleanup** e **0 chamadas do webhook** do Apollo. Ou seja, marcamos `phone_reveal_status = 'requested'` esperando um webhook assíncrono que **nunca vem**, e só o cron de 5min mata como "failed". Confirmado nos contatos das 19:09: `phone_match_quality=unknown`, `phone_confidence=0`, `phone_quality_reason=no_person_phone_returned` — Apollo respondeu 200 OK, **sem telefone algum**, e a função de reveal considerou isso como "pendente async". Não é: quando Apollo não devolve `phone_numbers`, ele não vai chamar webhook depois.
- **Rejeita alguns**: os `rejected_company_phone` (Vaccinar, etc.) são casos em que o Apollo devolveu somente o telefone da matriz/recepção. A classificação está correta (KAI.15.1), mas o toast atual (`Telefone da empresa rejeitado`) parece "falha do sistema" para o usuário e não deixa claro que **nenhum crédito foi cobrado** nem por que aconteceu.

## Correções

### 1. Edge `kairos-apollo-reveal-contact` — só marcar `pending` quando Apollo realmente enfileirou async

Trocar a heurística atual (`phonePending = wantsPhone && !revealedPhone && !companyPhoneRejected`) por uma detecção baseada no payload do Apollo:

- Considerar pendente **apenas se** `person.phone_numbers` existir e tiver ao menos uma entrada com `sanitized_number == null && raw_number == null` (padrão do Apollo em pending assíncrono) **e** o campo `dnc_status`/`status` indicar fetch pendente.
- Caso contrário (`phone_numbers` vazio/ausente ou só com company): marcar direto como `not_found` (ou `rejected_company_phone`), fechando o job e o audit no mesmo tick.
- Persistir `raw_phone_numbers` no `apollo_reveal_audit.raw_response` para termos telemetria real das próximas revelações.

### 2. Edge `kairos-apollo-reveal-contact` — não enviar `webhook_url` quando não há chance de callback

Só incluir `payload.webhook_url` quando o próprio Apollo tiver retornado sinal de pending numa chamada anterior. Isso evita continuar "esperando" retorno que nunca chega. (Simplificação: manter `webhook_url` só como fallback; a decisão de pending passa a ser exclusivamente pela leitura da resposta síncrona.)

### 3. Hook `useRevealContact.ts` — polling curto e mensagem clara

- Reduzir o polling de 90s → 30s (5 tentativas × 6s) — se em 30s não terminou, cai para `not_found` no toast (não "erro").
- Quando status final for `rejected_company_phone`, exibir toast **informativo**, não warning de erro:
  > "Apollo só encontrou o telefone da empresa para {contato}. Nenhum crédito cobrado."
- Quando `not_found`, mensagem clara: "Apollo não tem telefone individual desse contato."

### 4. UI `ProspectContactsTab.tsx` — badge coerente

O badge `Buscando telefone...` já existe. Adicionar tooltip para os estados terminais:
- `rejected_company_phone`: "Apollo só encontrou telefone da empresa — não salvamos."
- `not_found`: "Apollo não tem telefone individual desse contato."

Sem mudanças estruturais na UI, só cópia + tooltip.

### 5. Migration — backfill dos travados atuais

Migration única que:
- Marca como `not_found` (com `phone_quality_reason='resolved_stuck_requested'`) todo `enriched_contact_profiles` com `phone_reveal_status IN ('requested','pending')` e `last_reveal_attempt_at < now() - interval '2 minutes'`.
- Fecha o `apollo_reveal_audit` correspondente com `status='not_found'`, `reason='resolved_stuck_requested'`.
- Reaproveita a função existente de cleanup (já roda a cada 5min) — só reduzir a janela para 2min para dar feedback mais rápido em novos casos que escaparem.

## Arquivos impactados

- `supabase/functions/kairos-apollo-reveal-contact/index.ts` — nova detecção de pending, remoção do `webhook_url` incondicional, telemetria em audit.
- `supabase/functions/apollo-phone-webhook/index.ts` — nenhum change funcional, só ajustar log para caso o Apollo eventualmente chame.
- `src/hooks/intelligence/useRevealContact.ts` — polling 30s, toasts refinados.
- `src/components/playbook/ProspectContactsTab.tsx` — tooltip nos badges terminais.
- `supabase/migrations/<timestamp>_fix_stuck_phone_reveals.sql` — backfill + ajuste da janela do cron.

## Riscos

- **Baixo**. A detecção nova de pending é mais estrita → no pior caso trocamos "espera infinita" por "not_found" imediato, que é o comportamento correto.
- Se algum dia o Apollo passar a devolver phone assíncrono de fato, a leitura de `phone_numbers[].sanitized_number == null` cobre o caso e o webhook continua funcional.
- Nenhuma alteração de RLS, schema (fora backfill) ou modelo multi-tenant.

## Próximos passos após aprovação

1. Aplicar a migration de backfill (destrava os 2 contatos parados agora).
2. Deploy das 2 edge functions.
3. Publicar as mudanças de frontend.
4. Monitorar `apollo_reveal_audit` por 30min para confirmar que `stale_pending_cleanup` some.
