## Análise forense

Encontrei a causa raiz do bug em produção:

1. A sessão do print `94436dff-c621-4fb8-959a-5d14bccce76b` está no banco com:
   - `current_phase = 'evaluating'`
   - `score_overall = null`
   - `scores_json = {}`
   - `message_count = 21`

2. Existem outras sessões recentes no mesmo estado travado (`evaluating`, com muitas mensagens, sem nota).

3. O `finalize-roleplay-session` hoje cria um “lock” usando `current_phase = 'evaluating'`. Quando uma tentativa anterior falha ou fica interrompida, a sessão permanece em `evaluating` para sempre. Depois disso, qualquer nova chamada ao finalize apenas retorna `{ evaluationStatus: 'evaluating' }` e nunca reprocessa.

4. Há regressões adicionais no código atual:
   - O frontend tenta atualizar a coluna `evaluation_error`, mas essa coluna não existe em `roleplay_sessions`.
   - O frontend tenta ler uma tabela `roleplay_evaluations`, mas essa tabela não existe.
   - O fallback de summary não ajuda porque a avaliação real fica somente em `roleplay_sessions`.
   - O fluxo fica preso porque `scores_json = {}` é considerado existente no banco, mas não contém `overall_score`.

## Correção definitiva proposta

Vou fazer uma correção pequena, direta e segura: `summary chama finalize, finalize avalia, salva, summary renderiza`.

### 1. Backend: corrigir `finalize-roleplay-session`

Editar `supabase/functions/finalize-roleplay-session/index.ts` para:

- Remover a armadilha do lock eterno em `current_phase = 'evaluating'`.
- Permitir reprocessar sessões travadas em `evaluating` quando ainda não existe `score_overall`.
- Considerar avaliação existente somente quando `score_overall` é número válido e `scores_json.overall_score` existe.
- Não depender da coluna inexistente `evaluation_error`.
- Retornar JSON claro em todos os casos:
  - `complete` quando avaliou/salvou.
  - `already_complete` quando já tinha avaliação válida.
  - `failed` com erro claro quando não conseguiu avaliar.
- Manter validação de autenticação e organização antes de processar.
- Manter tarefas secundárias em background, sem bloquear a nota.

### 2. Backend: tornar avaliação mais resiliente

Ajustar `ai-evaluate-session` apenas no necessário:

- Garantir que, ao salvar a avaliação, também marque `current_phase = 'completed'`.
- Se a IA/API falhar, devolver erro claro sem deixar o registro num estado invisível.
- Manter limite de até 100 mensagens, que atende sessões com 20, 50 ou mais mensagens dentro desse teto.

### 3. Frontend: corrigir `SessionSummary.tsx`

Editar `src/pages/roleplay/SessionSummary.tsx` para:

- Parar de tentar atualizar `evaluation_error`, pois a coluna não existe.
- Remover a busca na tabela inexistente `roleplay_evaluations`.
- Ao receber avaliação da função, atualizar/refazer a query da sessão imediatamente, sem depender só de polling.
- Se a função retornar erro, mostrar botão de reprocessar, mas o reprocessar deve chamar diretamente o finalize novamente.
- Tratar `current_phase = 'error'` e `evaluation_error` sem quebrar por coluna inexistente.

### 4. Frontend: corrigir comportamento de reprocessamento

O botão “Reprocessar avaliação” vai:

- Chamar `finalize-roleplay-session` diretamente.
- Não tentar alterar colunas inexistentes pelo cliente.
- Invalidar/refazer cache de sessão ao concluir.
- Não duplicar avaliação em refresh: se a sessão já tiver `score_overall`, o backend retorna avaliação existente.

### 5. Validação em produção

Depois da alteração, vou validar com a sessão real do print:

- Chamar `finalize-roleplay-session` para `94436dff-c621-4fb8-959a-5d14bccce76b`.
- Conferir que `score_overall` foi preenchido.
- Conferir que `scores_json` contém dimensões.
- Conferir que `current_phase` saiu de `evaluating` para `completed`.
- Conferir que chamadas repetidas não duplicam avaliação.

## Arquivos impactados

- `supabase/functions/finalize-roleplay-session/index.ts`
- `supabase/functions/ai-evaluate-session/index.ts`
- `src/pages/roleplay/SessionSummary.tsx`

## Riscos

- Baixo risco visual: não vou mexer no layout geral.
- Baixo risco de RLS: a validação de usuário/organização será mantida no backend antes do service role processar.
- Principal risco é a chamada da IA falhar; nesse caso a tela deixará de ficar infinita e exibirá erro claro com reprocessamento.

## Resultado esperado

- Sessões travadas em `evaluating` passam a ser reprocessáveis.
- Summary não fica preso em loading infinito.
- Nota, feedback, insights e scores por dimensão aparecem novamente.
- Refresh não duplica avaliação.
- Usuário não acessa sessão de outra organização.
- Sessões com 20, 50+ mensagens continuam funcionando.