## Diagnóstico forense

Encontrei dois problemas reais no fluxo da proposta da oportunidade `b92b045f-cf08-4af0-88ab-622c77c534ac`:

1. **Erro atual no aceite público**
   - A função `generate-acceptance-proof` está falhando com `PGRST201`.
   - Motivo: depois das mudanças recentes, existem duas relações entre `proposals` e `opportunities` (`proposal.opportunity_id` e `opportunity.accepted_proposal_id`). A query da função usa `opportunity:opportunities(...)` sem escolher qual relação quer, então o backend não sabe qual caminho usar e retorna “Proposal not found”.
   - Correção: trocar o embed para a relação explícita `opportunity:opportunities!proposals_opportunity_id_fkey(...)`.

2. **Estado inconsistente após reabrir proposta já aceita**
   - A proposta `PROP-2026-00778` está `sent`, mas ainda tem `price_frozen_on_approval = true`, `approved_amount = 1313,40`, `approved_payment_schedule` antigo e `pricing_breakdown_snapshot.frozen = true`.
   - Isso é perigoso porque a proposta está reaberta, mas ainda carrega travas/snapshots de uma aprovação anterior.
   - Correção: ao reabrir, limpar todos os campos de aprovação/freeze da proposta e forçar recálculo do ledger antes de permitir novo aceite.

## Plano de implementação

### 1. Corrigir a função de aceite público
Arquivo: `supabase/functions/generate-acceptance-proof/index.ts`

- Alterar o relacionamento ambíguo:
  - De: `opportunity:opportunities(...)`
  - Para: `opportunity:opportunities!proposals_opportunity_id_fkey(...)`
- Antes de atualizar a proposta como aceita, chamar `freeze_proposal_approval(proposalId, acceptorName, acceptorDocument)` como única fonte de verdade do valor aprovado.
- Usar o resultado da RPC para `approved_amount`, `approved_payment_schedule` e `approval_snapshot`, evitando cálculo paralelo dentro da função.
- Manter o restante do fluxo: histórico, Win/Loss, contato, oportunidade ganha, contrato e prova de aceite.

### 2. Corrigir a reabertura de proposta
Arquivo: `src/services/supabase/proposals.ts`

- Ajustar `reopenProposal()` para limpar campos terminais e campos congelados:
  - `accepted_at`, `acceptor_name`, `acceptor_document`, `acceptor_phone`, `acceptor_email`, `acceptor_position`, `acceptor_ip`, `acceptor_user_agent`, `acceptance_hash`
  - `approved_amount`, `approved_payment_schedule`, `approved_dynamic_pricing_tier_id`, `approval_snapshot`
  - `price_frozen_on_approval = false`
  - `pricing_needs_recalculation = true`
  - `signature_status = 'pending'`
- Depois da reabertura, chamar `ensure_proposal_pricing_ready` para recalcular o ledger da condição atual.

### 3. Corrigir a reabertura de oportunidade
Arquivo: `src/services/supabase/opportunities.ts`

- Quando uma oportunidade ganha for reaberta, não deixar a proposta antiga num meio-termo técnico.
- Para propostas aceitas que serão reabertas para novo aceite:
  - limpar freeze/aprovação igual ao item 2;
  - manter o link público existente;
  - forçar recálculo do ledger.
- Preservar rastreabilidade no `audit_log` com o motivo da reabertura e os valores anteriores.

### 4. Blindagem contra recorrência
Banco de dados via migration

- Criar/ajustar uma RPC segura `reopen_proposal_for_reapproval(p_proposal_id, p_reason)` para centralizar a reabertura no servidor.
- Essa RPC deve:
  - validar organização/tenant;
  - limpar aprovação anterior;
  - recalcular pricing;
  - registrar auditoria;
  - impedir proposta `sent/viewed` com `price_frozen_on_approval = true`.
- Adicionar uma função/trigger de proteção para bloquear estados inválidos futuros:
  - proposta não aceita não pode ficar com `price_frozen_on_approval = true`;
  - proposta reaberta não pode manter `approval_snapshot` ativo como fonte vigente.

### 5. Correção pontual da proposta afetada
Banco de dados via data fix controlado

- Para `PROP-2026-00778`, normalizar o estado atual:
  - manter `status = sent`;
  - limpar freeze e campos de aprovação antiga;
  - recalcular ledger;
  - manter link público para o cliente conseguir aprovar novamente.
- Não alterar PDF histórico, contratos já gerados, ERP, Slack ou receita realizada sem ação explícita.

### 6. Testes e validação

- Testar o aceite público da proposta afetada até passar sem erro.
- Verificar que o valor aprovado novo vem do ledger atual, não do snapshot antigo.
- Confirmar que `generate-acceptance-proof` não gera mais `PGRST201`.
- Confirmar que o Slack continua notificando apenas uma vez.
- Confirmar que o texto do Slack usa o nome do cliente/conta quando o aprovador explícito estiver ausente.

## Arquivos impactados

- `supabase/functions/generate-acceptance-proof/index.ts`
- `src/services/supabase/proposals.ts`
- `src/services/supabase/opportunities.ts`
- Migration de banco para RPC/trigger de proteção
- Data fix pontual para `PROP-2026-00778`

## Riscos

- Baixo risco se a correção ficar restrita ao fluxo de aceite/reabertura.
- Não vou mexer em PDF, ERP, Pix, comissão, receita SSoT ou cálculo financeiro global.
- O ponto sensível é limpar corretamente o snapshot antigo apenas quando a proposta foi reaberta para nova aprovação.