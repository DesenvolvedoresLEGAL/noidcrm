## Objetivo

Transformar a aba **Propostas** (`OpportunityProposalsTab`) em uma tela enxuta, acionável e legível por humanos e agentes de IA — focada em "qual proposta vale agora, quanto vale, e o que fazer". Profundidade analítica continua na aba **Analytics**.

## Arquivos impactados

- `src/components/opportunity/OpportunityProposalsTab.tsx` — refatoração principal
- `src/lib/proposals/effectiveAmount.ts` — **novo**: utilitário centralizado de valor vigente + status comercial + próxima ação
- `src/components/opportunity/proposals/ProposalSummaryCards.tsx` — **novo**: 5 cards do topo
- `src/components/opportunity/proposals/ProposalCardItem.tsx` — **novo**: card individual da proposta
- `src/components/opportunity/proposals/ProposalAISummary.tsx` — **novo**: bloco "Resumo para IA"
- `src/services/supabase/proposals.ts` — `listProposals` passa a selecionar campos extras (`approved_amount`, `dynamic_pricing_*`, `expires_at`, `views_count`) já existentes no schema, sem migração

> Nenhuma migração SQL necessária: todos os campos (`approved_amount`, `dynamic_pricing_enabled`, `dynamic_pricing_status`, `dynamic_pricing_current_amount`, `dynamic_pricing_snapshot`, `payment_expected_amount`, `total_amount`, `expires_at`, `views_count`) já existem na tabela `proposals` e são consumidos por `proposalPdfBuilder`/`acceptProposal`.

## Utilitário centralizado — `effectiveAmount.ts`

Funções puras (testáveis, reusáveis em IA/edge):

```ts
getEffectiveAmount(proposal) -> { value, source: 'approved'|'dynamic'|'total', adjustmentPct }
getCommercialStatus(proposal) -> 'accepted'|'rejected'|'expired'|'expiring_soon'|'engaged'|'viewed'|'sent'|'draft'
getNextAction(proposal) -> { label, tone: 'success'|'warning'|'danger'|'info', cta?: 'call'|'followup'|'resend'|'duplicate'|'register_loss'|'await' }
getDynamicAdjustment(proposal) -> { applied: boolean, pct: number|null, tierName?: string }
```

Regras (conforme spec do usuário):
- `effective = accepted+approved_amount → dynamic_pricing_current_amount → snapshot.current_amount → payment_expected_amount → total_amount`
- `expiring_soon` quando faltar ≤ 48h para `expires_at`
- `engaged` quando `views_count ≥ 3`, `viewed` quando `≥ 1`

## Novos cards do topo (substituem Total / Aceitas / Visualizadas / Valor Total)

1. **Propostas** — total + breakdown compacto (`1 enviada · 0 aceitas · 0 vencidas`)
2. **Valor Vigente** — `effective_amount` da proposta ativa (mais recente não-recusada). Subtexto: "Valor válido para aprovação agora"
3. **Ajuste Dinâmico** — `+10% Tabela dinâmica aplicada` ou `Sem ajuste`
4. **Status Comercial** — badge único derivado de `getCommercialStatus`
5. **Próxima Ação** — frase curta de `getNextAction`, com cor por tom

## Card individual da proposta

```text
Proposta Comercial - CROWN DO BRASIL              [Status]
PROP-2026-00607 • Criada em 27/04/2026

┌─ Financeiro ─────────────────────────────┐
│ Valor Vigente:  R$ 1.709,40              │
│ Valor Original: R$ 1.554,00 (riscado)    │
│ Ajuste:         +10% (tabela dinâmica)   │
└──────────────────────────────────────────┘

Itens: 2 · Validade: 26/05/2026 · Pagamento: PIX

[Alerta condicional: vigente / vencida / vence em 48h]

Tag discreta: Engajada · [Ver analytics]

[Abrir] [Copiar link] [PDF] [Editar]  [⋯]
   ↳ menu: WhatsApp, Duplicar, Recalcular vigente,
            Registrar recusa, Marcar follow up, Arquivar
```

- **Copiar link** vira botão direto (sem abrir aba). "Abrir proposta" passa a ser ação separada.
- "Recalcular valor vigente" chama `orchestrate_proposal_financials` (já existe em `proposalOrchestrator.ts`).
- Removidos: contagem detalhada de visualizações, qualquer dado tipo Analytics. Mantida apenas a tag de comportamento + link "Ver analytics da proposta" que muda a tab para `analytics`.

## Bloco "Resumo para IA"

Coluna lateral curta dentro do card (colapsável, default aberto). Texto plano em bullets curtos, gerado client-side a partir das mesmas funções puras — sem chamada a LLM. Serve como contexto consumível por agentes que leem o DOM/snapshot.

## Estado vazio

Card centralizado com cópia da spec + botão `Nova proposta`.

## Hierarquia visual e cores

Usar tokens semânticos (`success`, `warning`, `destructive`, `primary`, `muted`) — sem `bg-emerald-100`, `text-purple-700` etc. Reduz a poluição cromática atual. Cores aplicadas exclusivamente para sinalizar estado (aceita/atenção/vencida/enviada).

## Riscos

- `listProposals` pode não retornar todos os campos; vou validar e ajustar o `select` para incluir `approved_amount`, `dynamic_pricing_*`, `expires_at`, `views_count`, `public_token` (a maioria já vem).
- "Recalcular vigente" depende de `orchestrate_proposal_financials` — é fire-and-forget seguro, com invalidate de cache.
- Não mexe em backend, RLS, edge functions ou schema. Mudança 100% frontend/presentation.

## Próximos passos

1. Criar `effectiveAmount.ts` + testes unitários simples
2. Garantir campos no `select` de `listProposals`
3. Quebrar `OpportunityProposalsTab.tsx` em 3 subcomponentes novos
4. Aplicar tokens semânticos
5. Validar visualmente com a oportunidade da CROWN DO BRASIL (screenshot) — esperar ver `R$ 1.709,40` como Valor Vigente e `+10%` como ajuste
