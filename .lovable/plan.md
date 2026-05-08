## Diagnóstico

Investiguei e encontrei a causa-raiz pela qual **Top Motivos de Ganho** aparece "Não informado 100% (17)" e **Diferenciais Decisivos** aparece zerado, apesar de o modal de aceite exigir essas respostas.

### Evidências

**1. Não existe NENHUM `win_loss_records` com `outcome='won'` nos últimos 90 dias.**
```
outcome | total | with_reason | with_diff | with_feedback
lost    |  101  |      0      |     0     |       0
(zero linhas para outcome='won')
```

**2. Mesmo as 17 oportunidades ganhas com proposta aceita (CARDAPIO WEB, COMPASS, RZD, FALAE, HC, MAIS MU, etc.) NÃO têm registro em `win_loss_records`.**

### Causa-raiz (dois bugs encadeados em `src/pages/ProposalPublicView.tsx`)

**Bug A — `loadWinReasons()` é definida mas NUNCA é chamada.**
O estado `winReasons` fica sempre `[]`, então o `<Select>` cai no **fallback hardcoded**:
```
best_proposal, price, quality, trust, relationship, deadline, other
```

**Bug B — Esses ids do fallback NÃO são UUIDs.**
São strings literais. O `handleAccept` envia `winReasonId="best_proposal"` para a edge function `generate-acceptance-proof`, que tenta inserir em `win_loss_records.win_reason_id` (UUID FK → `win_reasons.id`). A inserção quebra por **FK violation** e é engolida pelo `try/catch` (linha 226-229 da edge function), sem lançar erro pro usuário. Resultado: **nenhum win_loss_record é criado, levando junto o `key_differentiator` e o `customer_feedback`**.

O hook `useWinLossData` então monta os ganhos a partir de `opportunities.status='won'` sem nenhum win_loss_record correspondente → cai em `'Não informado'` para todos os 17 deals e zera diferenciais/feedback.

---

## Plano de correção

### 1. Frontend — `src/pages/ProposalPublicView.tsx`
- Chamar `loadWinReasons()` quando a proposta carrega (mesmo gatilho do `loadLossReasons`).
- Remover o **fallback hardcoded** de motivos de ganho. Enquanto carrega, mostrar "Carregando…"; se vier vazio, exibir um item único "Outro" com `id=null` e exigir comentário.
- Aplicar o mesmo princípio aos **Diferenciais Decisivos**: persistir os labels reais (não só os codes) no payload, para o Win/Loss Hub poder mostrá-los direto.

### 2. Edge function — `supabase/functions/generate-acceptance-proof/index.ts`
- Validar `winReasonId` como UUID antes do insert; se inválido, salvar `win_reason_id = null` e logar warning, **garantindo que o registro seja criado** com `key_differentiator` e `customer_feedback`.
- Trocar o `console.error` silencioso por log estruturado e devolver flag `winLossSaved: boolean` na resposta para o cliente poder agir/avisar.

### 3. Schema — adicionar colunas-espelho em `proposals`
Para nunca mais perder a resposta do cliente, mesmo que `win_loss_records` falhe:
- `proposals.win_reason_id uuid` (FK opcional)
- `proposals.key_differentiator text`
- `proposals.customer_feedback text`
- Trigger `on update of status to 'accepted'` espelha esses campos para `win_loss_records` (criando se não existir).

### 4. Backfill dos 17 ganhos órfãos
Migração SQL: para toda `opportunity` com `status='won'` que tem `proposal.status='accepted'` mas não tem `win_loss_records`, inserir um registro base (`outcome='won'`, `acceptor_name`, `acceptor_position`, `final_value`, `recorded_by_customer=true`, `closed_by_proposal_id`). **Os motivos/diferenciais perdidos não podem ser recuperados** (nunca chegaram no banco), mas o Hub passa a refletir corretamente quem aceitou e a partir de agora todos os novos aceites trarão as respostas completas.

### 5. Win/Loss Hub — `src/hooks/useWinLossData.ts` e `WinAnalysisSection.tsx`
- Já lê `win_reason_name`, `key_differentiator`, `customer_feedback` corretamente — nenhuma mudança de lógica necessária após (1)–(4).
- Adicionar pequeno ajuste: quando o win_reason vier `null` mas o registro existir com `customer_feedback` ou `key_differentiator`, **rotular como "Sem motivo selecionado"** (em vez de "Não informado"), para distinguir lacuna histórica vs. novos aceites incompletos.

---

## Resultado esperado
- A partir do próximo aceite via link público: motivo, diferenciais e feedback do cliente aparecem corretamente em **Top Motivos de Ganho**, **Diferenciais Decisivos** e **Feedback dos Clientes**.
- Os 17 ganhos passados aparecem com nome do aceitante/cargo no Hub (sem motivos, pois nunca foram salvos).
- Bug semelhante não pode mais acontecer em silêncio (validação + log + flag de retorno + colunas-espelho na própria proposta).

## Riscos
- Pequena migração de schema em `proposals` + trigger.
- Backfill atualiza dados históricos (idempotente, só insere onde não existe).

Posso seguir com a implementação?