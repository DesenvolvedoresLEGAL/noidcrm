

# Motivos de Ganho/Perda: Separação Cliente vs Vendedor

## Conceito
Adicionar uma coluna `audience` nas tabelas `loss_reasons` e `win_reasons` com valores `'client'`, `'seller'` ou `'both'`. Isso permite que no cadastro do motivo o admin escolha se ele aparece para o cliente (link público), para o vendedor (CRM interno), ou ambos.

O fluxo de decline do cliente permanece como hoje, mas quando o cliente declina, o vendedor recebe notificação e precisa classificar com o **motivo real (interno)** antes de poder marcar como LOST. Isso cria os dois campos: "Motivo informado pelo cliente" e "Motivo real (interno)".

## Alterações

### 1. Migration SQL
- Adicionar coluna `audience TEXT DEFAULT 'both'` em `loss_reasons` e `win_reasons`
  - Valores: `'client'` (só cliente vê), `'seller'` (só vendedor vê), `'both'` (ambos)
- Adicionar coluna `client_loss_reason_id UUID` em `opportunities` (motivo informado pelo cliente, separado do `loss_reason_id` que é o do vendedor)
- Adicionar coluna `client_reason_id UUID` em `win_loss_records` (motivo do cliente vs `reason_id` que é do vendedor)
- Adicionar flag `requires_seller_classification BOOLEAN DEFAULT false` em `opportunities` — setado `true` quando cliente declina, impedindo marcar como LOST até vendedor classificar

### 2. Edge Functions — Filtrar por audience
- **`get-public-loss-reasons`**: adicionar `.in('audience', ['client', 'both'])` na query
- **`get-public-win-reasons`**: adicionar `.in('audience', ['client', 'both'])` na query
- **`handle-proposal-decline`**: salvar o `declineReasonId` em `client_loss_reason_id` (motivo do cliente), setar `requires_seller_classification = true`, e NÃO preencher `loss_reason_id` (fica para o vendedor)

### 3. Settings — Modal de cadastro com campo "Público"
- **`src/components/settings/LossReasonModal.tsx`**: adicionar select "Visibilidade" com opções "Cliente (link público)", "Vendedor (interno)", "Ambos"
- **`src/components/settings/WinReasonModal.tsx`**: mesmo campo
- **`src/pages/settings/WinLossReasons.tsx`**: mostrar badge de visibilidade na tabela (Cliente / Vendedor / Ambos)

### 4. Vendedor — Modal de classificação obrigatória
- **`src/components/opportunity/LossReasonModal.tsx`** (o do vendedor): filtrar motivos com `.in('audience', ['seller', 'both'])`
- **`src/components/opportunity/WinReasonModal.tsx`**: filtrar motivos com `.in('audience', ['seller', 'both'])`
- Novo componente **`src/components/opportunity/SellerClassificationBanner.tsx`**: banner de alerta na tela da oportunidade quando `requires_seller_classification = true`, com botão que abre o `LossReasonModal` para o vendedor classificar o motivo real

### 5. OpportunityDetail — Exibir ambos os motivos
- Na sidebar/header da oportunidade perdida, mostrar:
  - "Motivo informado pelo cliente: X"
  - "Motivo real (interno): Y"
- Quando vendedor confirma classificação, setar `loss_reason_id` e `requires_seller_classification = false`

### 6. Services — Filtro por audience
- **`src/services/supabase/loss-reasons.ts`**: `getLossReasonsByPipeline` já é usada pelo modal do vendedor — adicionar filtro `audience IN ('seller', 'both')`
- **`src/services/crm/win-reasons.ts`**: `listWinReasons` — adicionar filtro `audience IN ('seller', 'both')`

### 7. ProposalPublicView — Fluxo de decline atualizado
- `directProposalDecline`: salvar em `client_loss_reason_id` em vez de `loss_reason_id`, setar `requires_seller_classification = true`, NÃO marcar como `status: 'lost'` ainda (fica pendente até vendedor classificar)

## Resultado
- Admin configura quais motivos o cliente vê e quais o vendedor vê
- Cliente declina com motivo simples → vendedor é obrigado a classificar internamente
- Dados cruzados permitem análise: onde o cliente mente vs onde o vendedor erra
- Win/Loss Hub ganha duas dimensões de análise

## Arquivos (10 arquivos)
1. Migration SQL (audience column + client_loss_reason_id + requires_seller_classification)
2. `supabase/functions/get-public-loss-reasons/index.ts`
3. `supabase/functions/get-public-win-reasons/index.ts`
4. `supabase/functions/handle-proposal-decline/index.ts`
5. `src/components/settings/LossReasonModal.tsx`
6. `src/components/settings/WinReasonModal.tsx`
7. `src/pages/settings/WinLossReasons.tsx`
8. `src/components/opportunity/LossReasonModal.tsx`
9. `src/components/opportunity/SellerClassificationBanner.tsx` (novo)
10. `src/pages/OpportunityDetail.tsx`
11. `src/pages/ProposalPublicView.tsx`
12. `src/services/supabase/loss-reasons.ts`
13. `src/services/crm/win-reasons.ts`

