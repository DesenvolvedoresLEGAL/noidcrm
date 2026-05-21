## Problema

O bloco "Composição do valor" (editor → aba Pagamento) e o link público da proposta (header, condições de pagamento, forma e prazo) leem de `proposals.pricing_breakdown_snapshot`. Esse snapshot só é regravado em ações de cobrança/ERP ou clique manual no alerta de divergência. Alterações em itens, desconto, condição comercial, validade ou modo de precificação **não** disparam recálculo, então o snapshot fica velho.

Caso real PROP-2026-00740: snapshot mostra subtotal R$ 2.544,00 / vigente R$ 2.798,40, enquanto os itens reais somam R$ 4.579,00 e o vigente dinâmico real é R$ 5.036,90. O PDF está correto porque é gerado server-side a partir dos dados reais.

Escopo: apenas frontend/orquestração de recálculo. **Não** mexer em `approved_amount`, `approval_snapshot`, preço dinâmico, propostas aceitas, clones operacionais, updates em massa, PDF, Pix, ERP, Slack, SSoT de receita.

## Ajustes

### 1. Recálculo no editor (aba Pagamento)

Em `src/pages/ProposalEditor.tsx`:
- `useEffect` ao carregar `proposalData`, se status ∈ {`draft`,`open`,`pending_approval`}, disparar `recalculateProposalLedger(currentProposalId)` uma vez por sessão e invalidar `proposalKeys.detail`.
- Helper `scheduleLedgerRecalc()` com debounce ~400 ms chamado nos handlers de save de: itens, condições de pagamento, desconto, modo dinâmico, validade, save geral.
- Pular auto-recálculo em `accepted`/`declined`/`expired`/`cancelled`.

### 2. Recálculo no link público

Em `src/pages/ProposalPublicView.tsx` (e/ou edge function que monta o bundle público):
- Ao carregar o bundle público, se o snapshot estiver vencido (`snapshot.calculated_at < proposal.updated_at`, ou ausente), chamar a RPC `ensure_proposal_pricing_ready` server-side **uma vez** antes de devolver o bundle ao cliente.
- Implementação preferida: na edge function `get-public-proposal` (ou equivalente que já resolve o token), executar `ensure_proposal_pricing_ready(p_proposal_id)` via service role antes de montar o payload. Mantém o token de acesso público inalterado e garante que header, "Condições de Pagamento" e "Forma e prazo do pagamento" leiam números frescos.
- Se a proposta estiver `accepted` com `frozen=true`, a RPC é no-op (o ledger já respeita o congelamento). Seguro.
- Cliente não dispara recálculo — público nunca escreve.

### 3. Indicador defensivo no breakdown interno

Em `ProposalPricingBreakdown` (audience `internal`), quando `snapshot.calculated_at < proposal.updated_at`, mostrar chip "Atualizando valores…" e acionar callback do editor para o recálculo debounced. Cobre propostas legadas.

### 4. Propostas legadas

Sem backfill em massa. O fluxo dos itens 1 e 2 garante recálculo na primeira abertura (interna ou pública) de cada proposta afetada.

## Detalhes técnicos

- Reutilizar `recalculateProposalLedger` (`src/services/proposals/proposalPricingGuard.ts`).
- Para o público: a RPC já existente `ensure_proposal_pricing_ready` é idempotente; chamar via service role na edge function que serve o bundle público. **Sem** novos endpoints, sem mudar RLS, sem mudar contrato do token público.
- Reutilizar `proposalKeys.detail` em `src/lib/query-keys.ts` para invalidar caches no editor.
- Sem mudanças em PDF, ERP, Pix, Slack, aprovação, clone, SSoT.

## Arquivos impactados

- `src/pages/ProposalEditor.tsx` — `useEffect` de recálculo na carga + `scheduleLedgerRecalc` nos handlers de save existentes.
- `src/components/proposals/ProposalPricingBreakdown.tsx` — chip "Atualizando valores…" + callback `onStaleSnapshot`.
- `supabase/functions/<edge-do-bundle-público>/index.ts` — chamar `ensure_proposal_pricing_ready` server-side antes de montar o payload (identificar a função real ao implementar; candidatos: `get-public-proposal` / `public-proposal-bundle`).
- `src/pages/ProposalPublicView.tsx` — sem mudança de lógica de cálculo; só passa a receber bundle já com snapshot fresco.

## Riscos

- Latência extra no primeiro load público (1 RPC). Aceitável; é cache hit nas próximas.
- Múltiplos saves rápidos no editor: mitigado pelo debounce.
- Race save↔recálculo: invalidate só após Promise do save resolver.
- Propostas congeladas: RPC é no-op, sem efeito colateral.

## Validação

1. Editor PROP-2026-00740 → Pagamento → subtotal **4.579,00**, vigente **5.036,90**.
2. Link público da mesma proposta → header, "Condições de Pagamento" (Resumo Financeiro) e "Forma e prazo do pagamento" mostram **5.036,90** (alinhado ao PDF).
3. Editar item → salvar → editor e (após reload) link público atualizam.
4. Mudar condição comercial → recalcula em ambos.
5. Build e typecheck verdes.
