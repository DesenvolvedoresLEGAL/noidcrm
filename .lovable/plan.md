# PRICE UX 1.0.3 — Fluxo público e financeiro da proposta

## Objetivo
Esconder o pagamento público (Pix/ERP) enquanto a integração real não existir, manter só o aceite com valor vigente, criar tela pós-aprovação com resumo e snapshot, corrigir o cronograma à vista (sem "Parcela 1") e preparar 50% + 50% sem recálculo da segunda parcela pela tabela dinâmica.

## Mudanças

### 1. Feature flag `public_payment_enabled`
- Migration: adicionar coluna `public_payment_enabled boolean default false` em `organizations` (mais simples que settings) **e** opcional override `public_payment_enabled boolean` em `proposals` (nullable).
- Helper resolve: `proposals.public_payment_enabled ?? organization.public_payment_enabled ?? false`.
- Expor flag dentro do `get_proposal_by_public_token` RPC para o link público ler sem login.

### 2. Snapshot de aprovação
Migration em `proposals`:
- `approval_snapshot jsonb default '{}'::jsonb`
- `approved_dynamic_pricing_tier_id uuid null`
- `approved_amount numeric null`
- `approved_payment_schedule jsonb default '{}'::jsonb`
- (já existe `accepted_at`; reaproveitar)

RPC nova `accept_proposal_with_snapshot(p_token, p_acceptor_name, p_acceptor_email, ...)` (security definer, search_path public) que:
- valida token
- monta snapshot a partir de `dynamic_pricing_snapshot`, `proposal_items`, `proposal_payment_terms`, totais e dados do consultor
- congela `approved_amount = dynamic_pricing_current_amount` (ou total)
- congela `approved_payment_schedule` calculado server-side
- atualiza `status='accepted'`, `accepted_at=now()`, persiste snapshot
- continua disparando `notify-deal-won` / `post-acceptance-effects` (chamados pelo frontend como hoje)

### 3. Link público (`src/pages/ProposalPublicView.tsx`)
- Manter `PublicProposalDynamicPricingBanner` (Condição Comercial Vigente).
- Renderizar `PublicProposalPaymentBlock` somente se `public_payment_enabled === true`. Como ainda não existe ERP integrado, na prática some.
- Bloco final de aceite passa a ter título **"Pronto para avançar?"** + texto + botão **"Aprovar proposta com valor vigente"** (já existe rótulo, ajustar copy do header).
- Ao chamar accept, usar a nova RPC para gravar snapshot.

### 4. Tela pós-aprovação
Novo componente `PublicProposalApprovedScreen` exibido quando `proposal.status === 'accepted'` (substitui o banner verde atual minimal):
- Título "Proposta aprovada com sucesso" + subtítulo.
- Cards: número, cliente, valor aprovado, condição vigente aplicada (faixa, ajuste, validade), forma de pagamento, condição, cronograma aprovado, itens contratados, consultor.
- Lê de `approval_snapshot`; fallback para dados ao vivo se snapshot vazio (compat com propostas antigas).
- Ações: "Baixar PDF da proposta aprovada" (reusa `downloadProposalPDF`), "Falar com consultor" (link wpp/email), "Voltar para proposta".
- Se `public_payment_enabled === false`: mostrar mensagem "A cobrança será enviada pela equipe LEGAL conforme a condição aprovada."
- Se `true`: também renderiza `PublicProposalPaymentBlock`.

### 5. Cronograma à vista — labels
Em `calculateInstallments` (mantém shape) e em todos os consumidores (`ProposalPublicView`, `ProposalPreview`, `proposalPdfGenerator`):
- Detectar à vista: `installments_count <= 1 && entry_percent === 0`.
- Renderizar bloco único "Pagamento à vista" com forma de pagamento + vencimento + valor, em vez de "Parcela 1".

### 6. Suporte a `split_50_50`
- Adicionar coluna opcional `payment_condition text` (`upfront | split_50_50 | installments | custom`) em `proposal_payment_terms` + `second_payment_due_strategy text` (`post_event | after_valid_until | manual_date`) + `second_payment_due_date date null`.
- Helper `calculateInstallments` reconhece `payment_condition='split_50_50'` e gera Entrada (50%) + Saldo (50%) com `dueDate` = `second_payment_due_date` ou `proposal.expires_at` (após validade) — labels "Entrada" / "Saldo".
- Quando proposta já aprovada: usar `approved_amount` como base do split (não recalcular pela tabela dinâmica).
- Editor interno (`ProposalPaymentTerms`): adicionar select de `payment_condition` com opções À vista / 50% + 50%; expor campo de estratégia da segunda parcela.

### 7. Visualização rápida (`ProposalPreview.tsx`)
- Aplicar mesma lógica de labels (à vista / Entrada+Saldo).
- Não mostrar "Pagar valor vigente".

### 8. PDF (`proposalPdfGenerator.ts`)
- Cronograma à vista: linha única "Pagamento à vista".
- Split 50/50: linhas "Entrada" e "Saldo".
- Usar `approved_amount` quando proposta aceita; caso contrário `dynamic_pricing_current_amount` / total.

## Arquivos impactados
- `supabase/migrations/<new>.sql` (flag, snapshot, RPC, payment_condition)
- `src/services/supabase/proposals.ts` (nova `acceptProposalWithSnapshot`)
- `src/services/supabase/proposal-payment-terms.ts` (`calculateInstallments` reconhece `payment_condition`)
- `src/pages/ProposalPublicView.tsx` (gate do bloco de pagamento, copy do CTA, render da tela pós-aprovação, labels do cronograma)
- `src/components/proposals/PublicProposalApprovedScreen.tsx` (novo)
- `src/components/proposals/ProposalPreview.tsx` (labels)
- `src/components/proposals/ProposalPaymentTerms.tsx` (select payment_condition)
- `src/lib/proposalPdfGenerator.ts` + `proposalPdfBuilder.ts` (labels + approved_amount)

## Critérios de aceite
- Link público sem botão "Pagar valor vigente" enquanto `public_payment_enabled=false`.
- Banner de Condição Comercial Vigente continua aparecendo.
- CTA final = "Aprovar proposta com valor vigente".
- Aceite grava `approval_snapshot` + `approved_amount` + `approved_payment_schedule`.
- Tela pós-aprovação aparece com resumo, PDF, mensagem da equipe LEGAL.
- Cronograma à vista mostra "Pagamento à vista" (sem "Parcela 1").
- 50% + 50% mostra Entrada e Saldo dividindo `approved_amount`, sem recalcular pela tabela dinâmica.
- Visualização rápida e PDF usam novos labels.
- Typecheck e build passam; nada da PRICE 1.1 quebra.

## Riscos
- Mudança em RPC pública precisa manter `security definer` + `set search_path = public` (memória do projeto).
- Snapshot legacy (propostas já aceitas sem snapshot) precisa fallback para dados ao vivo.
- Adicionar coluna em `organizations` exige RLS já existente — só leitura para o owner; flag exposta via RPC para anon.
