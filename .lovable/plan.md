# Fix: Email Agent — "Aprovar e enviar" retornando 502

## Diagnóstico forense

Quando você clicou em **Aprovar e enviar**, o edge function `approve-email-agent-action` chamou o dispatcher e o SMTP retornou:

```
[smtp_send_failed] Falha SMTP: No valid emails provided!
```

Investigando o registro `ai_email_messages.id = 905fa24a-…`, descobri que `recipient_email` foi salvo como **objeto JSON do contato**, não como string de e-mail:

```json
{"type":"personal","value":"j.brene@hotmail.com","is_primary":false}
```

### Causa raiz

Em `supabase/functions/execute-email-agent-run/index.ts` (linha 175):

```ts
const contactEmail = context.contact?.emails?.[0] || context.contact?.email;
```

Para contatos no formato estruturado novo (`emails` como array de objetos `{type, value, is_primary}`), `emails?.[0]` devolve o objeto inteiro — que é gravado como string JSON na coluna `recipient_email`. O SMTP recebe isso e rejeita.

Contatos no formato legado (string simples) continuam funcionando — por isso outros agentes funcionaram normalmente.

## Correção (mínima, defensiva, sem quebrar o resto do Email Agent)

### 1. Helper de normalização (novo)

`supabase/functions/_shared/normalize-recipient-email.ts`

Função `normalizeRecipientEmail(input)`:
- Aceita string, objeto `{value}`, ou string JSON contendo qualquer um dos dois (defensivo contra dados antigos)
- Prefere o objeto com `is_primary: true` se receber um array
- Valida regex de e-mail; retorna `null` se inválido

### 2. `execute-email-agent-run/index.ts` — corrigir na origem

Substituir linha 175 para usar o helper:
```ts
const contactEmail = normalizeRecipientEmail(
  context.contact?.emails ?? context.contact?.email
);
```
Mantém comportamento atual quando já é string; corrige quando é objeto/array.

### 3. `approve-email-agent-action/index.ts` — defesa em profundidade

Antes de chamar `dispatchAgentEmail`, normalizar `emailMsg.recipient_email`:
```ts
const normalizedRecipient = normalizeRecipientEmail(emailMsg.recipient_email);
if (!normalizedRecipient) {
  // marca falha com código claro, retorna 502 estruturado (UI já trata)
  ...errorCode: "invalid_recipient"
}
```
Isso garante que **nenhum e-mail antigo na fila** quebre na aprovação — ele será normalizado on-the-fly. Também grava de volta o valor corrigido em `ai_email_messages.recipient_email` para os próximos retries.

### 4. Healing do registro travado

Atualizar via SQL o `ai_email_messages.id = 905fa24a-…` (e qualquer outro com `recipient_email` em formato JSON) para o e-mail extraído (`j.brene@hotmail.com`), e resetar o item da fila `ai_agent_approval_queue` correspondente de `send_failed` → `pending` para você poder reaprovar imediatamente.

## Arquivos alterados

- **novo** `supabase/functions/_shared/normalize-recipient-email.ts`
- `supabase/functions/execute-email-agent-run/index.ts` (1 linha — uso do helper)
- `supabase/functions/approve-email-agent-action/index.ts` (validação + persistência do valor normalizado antes do dispatch)
- migration SQL para curar registros existentes em formato JSON

## Riscos

- **Baixo.** Helper é puro, idempotente, e mantém 100% compatibilidade com strings já válidas.
- A normalização no `approve` roda **antes** de qualquer mudança de estado de envio, então e-mails que já funcionavam continuam funcionando exatamente igual.
- Não toco em nenhum outro caminho do Email Agent (rejeição, retry, auto-send, dashboards, atribuição).

## Próximos passos pós-aprovação

1. Implementar os 3 arquivos
2. Deploy das 2 edge functions
3. Rodar migration de healing
4. Validar reaprovando o e-mail travado da Spot Mediatech
