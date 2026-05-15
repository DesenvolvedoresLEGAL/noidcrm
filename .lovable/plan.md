## Diagnóstico

A sessão da tela (`5db6a4dc-...`) e **9 das últimas 16 sessões finalizadas (56%)** terminaram com um "fallback de contingência" — não com avaliação real da IA.

Quando isso acontece, todas as dimensões recebem **a mesma frase genérica**:

> "Avaliação de contingência gerada porque a IA principal não respondeu dentro do tempo. Revise a conversa para feedback qualitativo mais profundo."

…e a sessão é marcada como `current_phase = 'completed'` com uma nota inventada (média ponderada por sinais simples como "tem '?' na mensagem"). É exatamente o que aparece no print: 7.7/7.9/8.1 com texto idêntico em todas as dimensões. Não há onde acertou, onde errou, nem aderência a metodologia — porque a IA real nunca foi consultada com sucesso.

### Causa raiz em `supabase/functions/ai-evaluate-session/index.ts`

1. **Modelo + timeout subdimensionados**: `gpt-5-nano` com `timeoutMs: 18000` e `max_completion_tokens: 2500`. `gpt-5-nano` é modelo de raciocínio — gasta tokens em "thinking" antes de emitir JSON. Em conversas de 12-16 mensagens, dispara `AbortError: "The signal has been aborted"` (mensagem confirmada no `coach_notes` da sessão).
2. **`maxRetries: 1`** (apenas 1 retentativa) cai rápido demais.
3. **Fallback mascara a falha**: quando o AbortError acontece, `buildContingencyEvaluation` retorna nota plausível e `current_phase = 'completed'`. O frontend não sabe distinguir uma avaliação real de uma de contingência → não oferece "Reprocessar".
4. **Frontend (`SessionSummary.tsx`)** já tem botão "Reprocessar avaliação" — mas só aparece em `evaluation_error`, nunca em `completed`. Logo, o usuário nunca pode pedir uma reavaliação real.

## Plano

### 1. Edge function `ai-evaluate-session`
- Trocar modelo de `gpt-5-nano` → **`gpt-5-mini`** (segue a regra do projeto: já está no wrapper `_shared/openai-client.ts`).
- `timeoutMs: 18000` → **`60000`** e `maxRetries: 1` → **`2`**.
- `max_completion_tokens: 2500` → **`4000`** (gpt-5-mini precisa de mais headroom para reasoning + JSON).
- Em `buildContingencyEvaluation`: **NÃO** marcar `current_phase = 'completed'`. Em vez disso, persistir `current_phase = 'evaluation_error'` e devolver `_contingencyFallback: true` no payload, **sem** fingir nota válida. Manter `coach_notes` com motivo técnico.
- Garantir que o handler retorne HTTP 200 com `{ evaluation: null, contingency: true }` para o caller.

### 2. Edge function `finalize-roleplay-session`
- Quando `aiData.contingency === true` ou `_contingencyFallback === true`: forçar `current_phase = 'evaluation_error'` (não `'completed'`) e devolver `status: 'failed'`.
- Manter idempotência: se já existir avaliação real válida (não-contingência), retornar como hoje.

### 3. UI `src/pages/roleplay/SessionSummary.tsx`
- Detectar `scores_json._contingencyFallback === true` e renderizar o mesmo bloco de erro/retry usado em `evaluation_error` (com botão "Reprocessar avaliação"), em vez do resultado falso.
- Pequeno banner "Avaliação anterior falhou — clique para reavaliar com a IA real."

### 4. Backfill das 9 sessões já contaminadas
- Script SQL one-shot: para cada sessão `WHERE scores_json->>'_contingencyFallback' = 'true'`, marcar `current_phase = 'evaluation_error'` e `score_overall = NULL`. Usuário pode então clicar "Reprocessar" para gerar avaliação real (agora com gpt-5-mini + 60s).

### 5. Validação
- Curl `finalize-roleplay-session` para a sessão `5db6a4dc-...` após o deploy e confirmar que volta avaliação real (não-fallback) com feedback específico por dimensão.
- Conferir logs de `ai-evaluate-session`: zero `AbortError` em sessões de 16 mensagens.
- Verificar no print do usuário: feedbacks distintos por dimensão (Situação ≠ Problema ≠ Implicação) com citações da conversa.

## Riscos
- **Custo**: gpt-5-mini > gpt-5-nano. Aceitável — avaliação só roda 1x por sessão e hoje 56% precisam reprocessar do zero.
- **Latência**: usuário pode esperar até ~60s. Aceitável dado que o pipeline já é assíncrono via `EdgeRuntime.waitUntil` para tarefas pós-avaliação. A chamada principal continua bloqueante, mas sessões reais hoje rodam em ~10-25s.
- **Backfill**: zera notas falsas. Usuário verá "reprocessar" nas sessões antigas — comportamento desejado, já que as notas atuais são placeholders.

## Arquivos impactados
- `supabase/functions/ai-evaluate-session/index.ts` (modelo, timeout, comportamento do fallback)
- `supabase/functions/finalize-roleplay-session/index.ts` (não persistir 'completed' em contingência)
- `src/pages/roleplay/SessionSummary.tsx` (detectar `_contingencyFallback` e mostrar retry)
- 1 migration SQL para reset das 9 sessões em contingência
