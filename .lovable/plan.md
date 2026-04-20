

# Refinar prompt das Sugestões Inteligentes (ai-field-suggestions)

## Diagnóstico

A sugestão "fechamento 27/05" pra um evento dia 14/05 acontece porque o prompt **ignora 3 fontes de verdade críticas**:

1. **Custom fields da oportunidade** — campos como `Data da Entrega` (13/05) e `Data Retirada/Devolução` (14/05) existem em `custom_field_values` mas **nunca são enviados pro modelo**.
2. **Propostas ativas vinculadas** — a proposta `sent` com `expires_at = 29/04` define um teto natural pra qualquer fechamento. Sugerir data depois do vencimento da proposta é incoerente.
3. **Semântica do produto/segmento** — credenciamento de evento tem que fechar **antes** do evento. O modelo não sabe disso porque ninguém disse.

A regra atual diz só "data deve ser ≥ hoje". Faltam tetos contextuais.

## Mudanças no `supabase/functions/ai-field-suggestions/index.ts`

### 1. Buscar contexto adicional antes do prompt

Adicionar 2 queries em paralelo às já existentes:

- **Custom fields** da oportunidade (filtrar por tipos `date`/`datetime`/`number`/`text`):
  ```ts
  supabase.from('custom_field_values')
    .select('value, custom_fields!inner(field_key, label, field_type)')
    .eq('entity_type', 'opportunity')
    .eq('entity_id', opportunityId);
  ```
- **Propostas ativas** (status `draft`, `sent`, `viewed`):
  ```ts
  supabase.from('proposals')
    .select('id, status, expires_at, total_amount, created_at')
    .eq('opportunity_id', opportunityId)
    .in('status', ['draft', 'sent', 'viewed'])
    .order('created_at', { ascending: false });
  ```

### 2. Calcular "âncoras temporais" no servidor (não confiar no modelo pra fazer matemática)

Antes do prompt, computar:
- `eventDate` — menor data encontrada em custom fields cujo `field_key` contenha `data`, `evento`, `entrega`, `inicio`, `prazo`, `vencimento`, `validade` (parse de ISO).
- `proposalExpiresAt` — `expires_at` da proposta ativa mais recente.
- `maxReasonableCloseDate` — `min(eventDate - 1 dia, proposalExpiresAt)` quando existirem; senão `null` (sem teto).
- `minCloseDate` — `today` (já existe).

### 3. Injetar tudo no prompt com regras explícitas

Substituir o bloco "DADOS ATUAIS" pra incluir uma seção **ÂNCORAS TEMPORAIS** e **CAMPOS PERSONALIZADOS**:

```text
ÂNCORAS TEMPORAIS (use como restrições rígidas):
- Hoje: 2026-04-20
- Data prevista de fechamento atual: 2026-05-13
- Data do evento/entrega: 2026-05-13 (custom field "Data da Entrega")
- Data de retirada/devolução: 2026-05-14
- Proposta ativa: enviada, expira em 2026-04-29, valor R$ 1.354,90

CAMPOS PERSONALIZADOS:
- Data da Entrega: 2026-05-13 15:00
- Data Retirada/Devolução: 2026-05-14 20:00
- Endereço Entrega/Retirada: ...

REGRAS DE COERÊNCIA TEMPORAL (obrigatórias):
1. close_date_prevista DEVE ser >= hoje (2026-04-20)
2. Se houver data de evento/entrega, close_date_prevista DEVE ser <= (data do evento - 1 dia).
   Vendas relacionadas a eventos precisam fechar ANTES do evento acontecer.
3. Se houver proposta ativa com expires_at, sugerir close_date_prevista > expires_at
   só faz sentido se você também sugerir renovar/estender a proposta — caso contrário, fique <= expires_at.
4. NUNCA sugira uma data depois de uma âncora temporal sem justificar explicitamente
   o conflito no campo "reasoning".
5. Se a close_date_prevista atual JÁ está coerente com as âncoras, NÃO sugira mudança.
```

### 4. Validação server-side reforçada em `validateSuggestion`

Adicionar ao bloco `field_name === 'close_date_prevista'`:

- Rejeitar se `normalizedDate > eventDate` (quando evento existir).
- Rejeitar se `normalizedDate > proposalExpiresAt` (quando proposta ativa existir), com mensagem clara no log.
- Manter rejeição de data no passado.

Passar `eventDate` e `proposalExpiresAt` como argumentos extras pra função.

### 5. Refinamentos de qualidade no prompt

- Aumentar mudança mínima de probabilidade (já está em 5pp) e **exigir justificativa quantitativa** ("subir prob de X→Y porque [evento concreto da timeline]").
- Para `temperature`, exigir referência a sinal observável (último contato, atividade, resposta de email) — não chutar.
- Reduzir teto de sugestões de 3 pra **máximo 3, mínimo 0** (já está, mas reforçar "prefira 0 sugestões a sugestões fracas").

## Arquivos afetados

- `supabase/functions/ai-field-suggestions/index.ts` — único arquivo editado.
- Sem migrations, sem mudanças de schema, sem mudança de UI.

## Detalhes técnicos

- Parse de custom fields: `value` é JSONB (string JSON). Fazer `JSON.parse` defensivo com try/catch — alguns valores são strings literais `"2026-05-13T15:00"`, outros podem ser objetos.
- Detecção de campo de data: heurística por `field_type IN ('date','datetime')` **ou** `field_key` regex `/(data|date|prazo|vencimento|validade|entrega|evento|inicio)/i`.
- Logs estruturados: imprimir as âncoras calculadas (`console.log('[ai-field-suggestions] anchors:', { eventDate, proposalExpiresAt, maxReasonableCloseDate })`) pra debug futuro.
- Backwards compat: se nenhum custom field nem proposta existir, comportamento atual é preservado (só checa `>= today`).

## Validação após deploy

Reabrir a oportunidade `CREDENCIAMENTO NO JOCKEY CLUB SP` e clicar em regenerar sugestões. Resultado esperado:
- **Não sugerir** estender close date pra 27/05 (passa do evento 14/05 e da expiração da proposta 29/04).
- Se sugerir alguma mudança de data, deve ser ≤ 12/05 (1 dia antes do evento) e mencionar a âncora no `reasoning`.

