

## Problema

A página pública da proposta (`ProposalPublicView.tsx`) registra a visualização no carregamento, mas **nunca envia dados de duração, scroll ou interações** ao backend. O backend (`track-proposal-view` edge function) já suporta `action: 'update_view'` com `durationSeconds`, `scrollDepthPercent`, `sectionsViewed`, `timePerSection` e `interactions` -- mas o cliente simplesmente nunca chama essa atualização. Por isso todos os analytics mostram 0s de duração e 0% scroll. Além disso, os cards de "Ações Recomendadas" nos AI Insights não têm botão para criar atividade diretamente.

## Plano

### 1. Criar hook `useProposalEngagementTracker`
**Novo arquivo**: `src/hooks/useProposalEngagementTracker.ts`

Um hook que, quando ativado na `ProposalPublicView`, faz tracking contínuo:

- **Gera `sessionId`** (UUID) ao montar
- **Rastreia duração**: timer a cada segundo (`startTime = Date.now()`)
- **Rastreia scroll depth**: listener de `scroll` que calcula `scrollY / (documentHeight - windowHeight) * 100`, mantendo o max
- **Rastreia seções visíveis**: IntersectionObserver nos elementos `[data-section]` com timestamps de entrada/saída para calcular `timePerSection`
- **Rastreia interações**: contagem de clicks, eventos de copy, PDF download, print
- **Envia heartbeat** a cada 30s chamando `supabase.functions.invoke('track-proposal-view', { body: { proposalId, action: 'update_view', metadata: { sessionId, durationSeconds, scrollDepthPercent, sectionsViewed, timePerSection, interactions } } })`
- **Envia dados finais** no `beforeunload` / `visibilitychange` via `navigator.sendBeacon` (fallback para fetch)

### 2. Integrar o hook na ProposalPublicView
**Arquivo**: `src/pages/ProposalPublicView.tsx`

- Usar o hook passando `proposalId` e `viewerType`
- Adicionar `data-section="header"`, `data-section="items"`, `data-section="payment"`, `data-section="documents"`, `data-section="cta"` nos blocos principais da proposta
- Enviar `sessionId` na chamada inicial de `trackView`
- Expor callbacks para `onPdfDownload`, `onCopy` e `onPrint` para o hook registrar interações

### 3. Atualizar `trackView` para enviar sessionId
**Arquivo**: `src/services/supabase/proposals.ts`

- Adicionar `sessionId` ao metadata enviado na chamada de `trackView`
- Criar função `updateProposalView(proposalId, metadata)` que chama a edge function com `action: 'update_view'`

### 4. Adicionar botão "Criar Atividade" nas Ações Recomendadas
**Arquivo**: `src/components/proposals/AIProposalInsightCard.tsx`

- Adicionar prop `opportunityId` ao componente
- Em cada card de ação recomendada, adicionar botão "Criar Atividade" que chama `createActivity` com:
  - `title`: mensagem da ação
  - `type`: mapear `action.type` (call → call, email → email, meeting → meeting, follow_up → follow_up)
  - `description`: descrição completa da ação
  - `opportunity_id`: da proposta
  - `status`: 'pending'
  - `scheduled_date`: amanhã
- Feedback via `toast.success` ao criar

### Detalhes Técnicos

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useProposalEngagementTracker.ts` | **NOVO** - Hook de tracking de engajamento (scroll, duração, seções, interações) |
| `src/pages/ProposalPublicView.tsx` | Integrar hook, adicionar `data-section` attributes, passar `sessionId` ao `trackView` |
| `src/services/supabase/proposals.ts` | Adicionar `sessionId` ao `trackView`, criar `updateProposalView` |
| `src/components/proposals/AIProposalInsightCard.tsx` | Adicionar botão "Criar Atividade" em cada ação recomendada |

O backend (edge function) **não precisa de mudanças** -- já suporta tudo via `action: 'update_view'`.

