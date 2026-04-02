

# Corrigir exibição do declínio no histórico e alerta de classificação pendente

## Problemas identificados

**1. Timeline não mostra detalhes do declínio**
O evento `proposal_declined` no histórico aparece só como "PROPOSAL DECLINED / Por: Usuário" sem nenhum detalhe. Isso acontece porque:
- `getEventActionLabel()` não tem case para `proposal_declined` — cai no `default` que só faz replace de underscore
- `TimelineEventCard.tsx` no case `audit` tem tratamento especial para `proposal_accepted` e `handoff_received`, mas nenhum para `proposal_declined`
- Resultado: motivo, valor da proposta e nome do cliente ficam escondidos no metadata sem serem renderizados

**2. Notificação foi criada mas sem alerta proativo**
A notificação de declínio FOI criada e entregue (confirmei no banco). Porém, diferente da venda (que tem modal de celebração em realtime), o declínio chega apenas como badge no sino — fácil de perder. Falta um alerta mais visível para declínios que exigem ação do vendedor.

## Correções

### 2.1 Timeline — Exibir detalhes do declínio

**`src/services/crm/enhanced-timeline.ts`**
- Adicionar `case 'proposal_declined': return 'Proposta recusada';` no switch do `getEventActionLabel()`

**`src/components/opportunity/TimelineEventCard.tsx`**
- No case `audit`, adicionar bloco para `proposal_declined`:
  - Mostrar campo "Proposta" com `metadata.metadata.proposal_title`
  - Mostrar campo "Valor" com `metadata.metadata.proposal_value` formatado
  - Mostrar campo "Motivo do cliente" com `metadata.metadata.declined_reason`
  - Mostrar campo "Recusado por" com `metadata.metadata.declined_by`
  - Mostrar campo "Data" com `metadata.metadata.declined_at` formatado

### 2.2 Timeline — Ícone e badge corretos para declínio

**`src/components/opportunity/TimelineEventCard.tsx`**
- Em `getEventIcon()`: adicionar case para `proposal_declined` com ícone vermelho (XCircle ou similar)
- Em `getBadgeVariant()`: retornar variant `destructive` para `proposal_declined`

### 2.3 Alerta realtime para declínio com classificação pendente

**`src/hooks/useNotifications.ts`** (ou onde o realtime de notificações é ouvido)
- Quando uma notificação do tipo `proposal_declined` chegar via realtime, mostrar um toast/alert visível com:
  - Título: "Proposta Recusada"
  - Mensagem: nome do cliente + motivo
  - Botão/link para ir à oportunidade e classificar

Isso garante que o vendedor não precise ficar monitorando o sino — o alerta aparece na tela em tempo real, similar ao que já acontece com o modal de celebração para vendas.

## Arquivos impactados

| Arquivo | Alteração |
|---------|-----------|
| `src/services/crm/enhanced-timeline.ts` | Label para `proposal_declined` |
| `src/components/opportunity/TimelineEventCard.tsx` | Ícone, badge e campos detalhados para declínio |
| `src/hooks/useNotifications.ts` | Toast realtime para declínio |

## Resultado

- Timeline mostra motivo do cliente, valor, nome da proposta e data do declínio
- Evento aparece com badge vermelho "Proposta recusada" em vez de "PROPOSAL DECLINED"
- Vendedor recebe alerta visível em tempo real quando proposta é recusada
- Banner de classificação pendente já existe na tela da oportunidade e continuará funcionando

