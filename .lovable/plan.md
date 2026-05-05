
## Problema

Hoje, ao abrir uma oportunidade:

1. **Aba Inteligência → "Sugestões Inteligentes"** (`AIFieldSuggestions`) — o `useQuery` chama `generateFieldSuggestions` como `queryFn`, ou seja, **toda vez que o cache do React Query expira (10min) ou em outra sessão/aba sem cache, dispara a edge function `ai-field-suggestions`**, que por sua vez chama `gpt-5-mini`. Pior: a própria edge function começa marcando todas as sugestões `pending` como `expired` antes de gerar — então nunca há reaproveitamento real do que já está no banco.

2. **Aba Atividades → "Próximas Ações (AI)"** (`AINextActionCard` + `useAINextActions`) — as sugestões até são salvas em `ai_suggestions` com `status='pending'` e `expires_at = +7 dias`, mas: (a) o usuário relata que "somem ao trocar de aba" — provavelmente porque outras edge functions (ex: `ai-field-suggestions`) expiram **todas** as `pending` da opp no início, sem filtrar pelo `suggestion_type`; (b) não existe controle de "regenerar só se mudou algo".

## Solução: Assinatura de Contexto + Persistência

Introduzir uma **assinatura determinística** do estado relevante da oportunidade. Sugestões só são regeneradas via IA quando essa assinatura muda. Caso contrário, o que está em `ai_suggestions` é reaproveitado.

### Campos que compõem a assinatura
- `stage_id`
- `prob`
- `temperature` (normalizada)
- `valor_previsto`
- `close_date_prevista`
- `score` (overall do deal) e timestamp do último recálculo
- contagem de indicadores NRHS / lacunas
- `updated_at` da atividade mais recente
- `updated_at` do último email / nota
- existência e `expires_at` da proposta ativa

Hash: `sha256(JSON.stringify(orderedFields))` → 16 chars. Salvo em `ai_suggestions.context_signature` (nova coluna `text`, indexada junto com `opportunity_id`, `suggestion_type`, `status`).

### Mudanças

**1. Migração SQL**
- Adicionar coluna `context_signature text` em `ai_suggestions`.
- Índice parcial `(opportunity_id, suggestion_type, status) WHERE status = 'pending'`.

**2. Helper compartilhado** `supabase/functions/_shared/opportunity-signature.ts`
- `computeOpportunitySignature(supabase, opportunityId)` → retorna `{ signature, snapshot }`.
- Usado pelas duas edge functions.

**3. `supabase/functions/ai-field-suggestions/index.ts`**
- Aceitar `force_refresh: boolean` no body (default `false`).
- Antes de chamar a IA:
  - Computar `signature` atual.
  - Buscar `ai_suggestions` com `suggestion_type='field_update'`, `status='pending'`, `opportunity_id=…`.
  - Se existirem **e** todas terem o mesmo `context_signature` da atual **e** `force_refresh=false` → retornar diretamente, **sem chamar `callAI`**.
  - Caso contrário: marcar **apenas** as `field_update` antigas como `expired` (filtrando por `suggestion_type`, **não** todas), gerar novas via IA, gravar com `context_signature`.
- Log de cache hit/miss.

**4. `supabase/functions/ai-next-action/index.ts`** (mesma lógica)
- Buscar pendentes `suggestion_type='next_action'`.
- Se assinatura bate e não é `force_refresh` → retornar cache.
- Senão expirar **apenas** `suggestion_type='next_action'` e gerar.

**5. `src/hooks/useAINextActions.ts`**
- `generate()` continua sendo gatilho manual (botão "Atualizar"), passando `force_refresh: true`.
- Adicionar carregamento automático: quando o componente monta e não há pendentes, **não** chama IA — apenas mostra estado vazio. (Comportamento atual já é assim, OK.)
- Atualizar `fetchSavedActions` para não depender de `current_value` para metadados; usar nova coluna `metadata` ou primeiro registro como hoje.

**6. `src/components/ai/AIFieldSuggestions.tsx`**
- Trocar `queryFn` para primeiro consultar `ai_suggestions` direto via Supabase client (`status='pending'`, `suggestion_type='field_update'`).
- Se vazio → **não** dispara edge function automaticamente; mostra CTA "Gerar sugestões com IA" (igual ao card de Próximas Ações).
- Botão refresh (♻) chama edge function com `force_refresh: true`.
- Remover `staleTime: 10min` automático que mascarava o problema; cache vira `Infinity` porque a invalidação passa a ser explícita (aceitar/rejeitar/forçar).

**7. Invalidação reativa (sem polling de IA)**
- Em `invalidateOpportunity` (ou hook equivalente), quando o usuário muda manualmente `stage_id`, `prob`, `temperature`, `valor_previsto`, etc., **não** disparar IA — apenas marcar a query `aiSuggestionKeys.fields(opportunityId)` como stale. O próximo `refetch` ainda só consulta o banco; a IA só roda se o usuário clicar em "Gerar/Atualizar".

### Resultado esperado
- Abrir oportunidade 10x sem mudar nada → **0 chamadas** à OpenAI.
- Sugestões de campos e próximas ações **persistem** entre abas/refresh enquanto não forem aceitas/rejeitadas e o contexto não mudar.
- Regeração só acontece: (a) clique manual em "Atualizar", ou (b) primeira vez que o contexto da oportunidade muda significativamente após o usuário pedir nova geração.

### Arquivos impactados
- `supabase/migrations/<novo>.sql` (nova coluna + índice)
- `supabase/functions/_shared/opportunity-signature.ts` (novo)
- `supabase/functions/ai-field-suggestions/index.ts`
- `supabase/functions/ai-next-action/index.ts`
- `src/components/ai/AIFieldSuggestions.tsx`
- `src/hooks/useAINextActions.ts`
- `src/services/crm/ai-automation.ts` (passar `force_refresh`)
- `src/services/crm/ai-sales.ts` (passar `force_refresh` em `getNextActions`)

### Riscos
- Assinatura "muito sensível" → invalida cache demais. Mitigação: incluir só campos de alto sinal (lista acima), arredondar timestamps por hora.
- Usuários que esperavam regeneração automática: o botão "Atualizar/Gerar" continua disponível e visível.
- Sugestões antigas com `context_signature = NULL`: tratadas como cache miss na primeira leitura (regeneram uma vez).
