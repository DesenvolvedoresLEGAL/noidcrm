

# Plano: corrigir repetição da IA cliente + acelerar encerramento e avaliação do Roleplay

## Diagnóstico

### 1) IA cliente repetitiva
Pelo print, a IA repetiu 3x praticamente a mesma resposta (checklist, CNPJ, horários, "vou procurar outros fornecedores"). Causas reais no código:

- `ai-simulate-client/index.ts` envia um system prompt enorme (~400 linhas), mas **não inclui as últimas N falas como exemplos do que NÃO repetir**.
- O `userPrompt` só passa o histórico em texto plano, sem instrução explícita: "não repita estrutura, frases ou exigências já feitas".
- `objectionsResolved` quase nunca é populado (não vi pipeline que escreva nele), então a regra "não repita objeções resolvidas" fica vazia.
- O modelo é `gpt-5-mini` sem `temperature` nem `presence_penalty`/`frequency_penalty` para variar.
- O prompt incentiva "manter postura/objeção" mas não força **avanço de fase** quando o vendedor já respondeu.

### 2) Encerramento lento e/ou travando
O `endMutation` em `ChatView.tsx` roda **6 edge functions em série**, todas com IA pesada, antes de navegar para o summary:
1. `endSession` (DB update)
2. `ai-evaluate-session` (IA, ~10–25s)
3. `ai-generate-insights` (IA)
4. `ai-recommend-videos` (IA)
5. `gamification-engine`
6. `missions-engine` (1 ou 2 calls)

Resultado: usuário fica preso 30–60s na tela "Avaliando…" e, se qualquer step falhar, o `onError` reseta tudo e a sessão fica em estado inconsistente (a do print: terminou os 20 turnos, clicou Encerrar, e o app não saiu da tela).

Além disso: `ai-evaluate-session` faz parsing JSON em até 3 tentativas + fallback regex, e o `model: gpt-5-mini` sem `response_format: json_object` aumenta chance de retrabalho.

---

## O que vou corrigir

### Parte A — IA cliente mais natural (anti-repetição)

**Arquivo:** `supabase/functions/ai-simulate-client/index.ts`

1. **Anti-repetição explícita no prompt**, alimentada pelas últimas 4 falas da IA:
   - Calcular no edge function `recentClientLines = conversationHistory.filter(m => m.sender !== 'seller').slice(-4)`.
   - Injetar bloco no system prompt:
     ```
     ⚠️ ANTI-REPETIÇÃO (CRÍTICO):
     Suas últimas falas foram:
     - "..."
     - "..."
     NÃO repita: as mesmas exigências, mesma estrutura de frase,
     mesmas palavras-chave (checklist, CNPJ, horários, "vou procurar outros fornecedores").
     Se já pediu algo, ASSUMA que pediu — agora avance: pergunte algo novo,
     mude o ângulo, mostre cansaço/impaciência real, ou aceite o avanço.
     ```

2. **Detecção de loop**: se as 2 últimas respostas da IA tiverem similaridade alta (mesmas 5+ palavras-chave), forçar prompt extra: "VOCÊ ESTÁ REPETINDO. Mude completamente de assunto ou avance a conversa".

3. **Parâmetros do modelo**:
   - Adicionar `temperature: 0.9`, `presence_penalty: 0.6`, `frequency_penalty: 0.5` para reduzir repetição lexical (GPT-5-mini aceita esses params).

4. **Reduzir o tamanho do system prompt** (~400 linhas hoje):
   - Manter regras essenciais (anti-quarta-parede, tom, fase).
   - Remover repetições de "lembre-se" e blocos de "AVALIAÇÃO INTERNA SILENCIOSA" que poluem o contexto.
   - Prompt menor → modelo presta mais atenção ao histórico recente.

5. **Forçar progressão real**: quando `exchangeCount >= minExchanges` do arquétipo, injetar gatilho dominante: "PARE de pedir mais coisas. Decida: aceite avanço OU encerre o contato. NÃO peça checklist/CNPJ de novo."

### Parte B — Encerramento rápido e confiável

**Arquivos:** `src/pages/roleplay/ChatView.tsx`, novo `supabase/functions/finalize-roleplay-session/index.ts`

1. **Criar 1 edge function orquestradora** `finalize-roleplay-session`:
   - Faz no servidor, em paralelo via `Promise.allSettled`, os passos pesados: `evaluate` + `videos`.
   - `insights`, `gamification`, `missions` movidos para `EdgeRuntime.waitUntil` (background, não bloqueiam resposta).
   - Retorna assim que `evaluate` terminar (única coisa essencial para a tela de summary).
   - Marca `finished_at` no início (para a sessão sair de "ativa" imediatamente).

2. **`ChatView.tsx`**:
   - `endMutation` passa a chamar **1 função só** (`finalize-roleplay-session`).
   - Tempo total cai de 30–60s para ~10–15s (só o evaluate bloqueante).
   - Se `evaluate` falhar, ainda assim a sessão fica `finished_at` setado e o usuário vai pro summary com aviso "Avaliação em processamento".

3. **Otimizar `ai-evaluate-session`**:
   - Adicionar `response_format: { type: 'json_object' }` no payload OpenAI → elimina markdown/code blocks e remove a maior parte das tentativas de parse.
   - Manter o fallback regex como segurança, mas em 99% dos casos vai parsear de primeira.

4. **Loading overlay com timeout de segurança**:
   - Se `endMutation` passar de 30s, mostrar botão "Ir para resumo agora" — leva o usuário pro summary mesmo se o background estiver rodando.

5. **Resgate de sessões "presas"**: adicionar verificação no início do `ChatView` — se `session.finished_at` já existe ao montar, redirecionar direto pro summary (resolve o caso atual: sessão do print está terminando mas IA travou na avaliação).

---

## Arquivos modificados

**Backend:**
- `supabase/functions/ai-simulate-client/index.ts` — anti-repetição + temperature + prompt enxuto
- `supabase/functions/ai-evaluate-session/index.ts` — `response_format: json_object`
- `supabase/functions/finalize-roleplay-session/index.ts` — **novo**, orquestrador

**Frontend:**
- `src/pages/roleplay/ChatView.tsx` — usar nova função, redirect se já finalizada, timeout de segurança no overlay
- `src/components/roleplay/EvaluationLoadingOverlay.tsx` — botão "Ir para resumo agora" após 30s

---

## Validação após deploy

1. Treinar com cliente simulado por 15+ trocas: IA deve **variar** assunto/tom, sem repetir checklist/CNPJ literalmente.
2. Após 2 respostas similares, próxima resposta deve mudar de ângulo (anti-loop ativo).
3. Clicar **Encerrar**: tela de avaliação aparece e em ~10–15s navega pro summary.
4. Recarregar a sessão atual presa do print: deve redirecionar direto pro summary se já tem `finished_at`.
5. Forçar erro no `evaluate` (cortar internet): mesmo assim sessão sai de "ativa" e usuário vai pro summary com aviso.

