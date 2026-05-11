## Diagnóstico confirmado

- A proposta aceita da CANON (`PROP-2026-00673`) tem:
  - `total_amount/value`: R$ 1.994,00
  - `dynamic_pricing_current_amount`: R$ 2.392,80
  - `payment_expected_amount`: R$ 2.392,80
  - oportunidade de vendas já está com `valor_previsto`: R$ 2.392,80
- O Slack e a bandeja foram gerados pelo `post-acceptance-effects` usando `proposal.total_amount`, por isso saíram com R$ 1.994,00.
- O ERP foi chamado por `notify-deal-won`, que recalcula o total pelos itens e também ignora `dynamic_pricing_current_amount/payment_expected_amount`, por isso enviou R$ 1.994,00.
- A bandeja lateral não destacou a venda porque `deal_won` cai na categoria `all`; hoje só `proposal_*` entra na aba “Propostas”, e a notificação ainda foi criada com mensagem/metadata de R$ 1.994,00.
- Forecast atual usa `opportunities.valor_previsto`; para CANON já está correto em R$ 2.392,80. O risco está em telas/hooks que ainda somam propostas aceitas por `total_amount`.

## Plano de correção

1. **Criar uma fonte única de valor aprovado da proposta**
   - Adicionar helper compartilhado para resolver o valor comercial aprovado com prioridade:
     1. `payment_expected_amount`
     2. `dynamic_pricing_current_amount`, quando `dynamic_pricing_enabled = true` e status válido
     3. `dynamic_pricing_snapshot.current_amount`
     4. fallback `total_amount`
     5. fallback `value`
   - Incluir metadados de auditoria: fonte usada, valor base, valor dinâmico, tier aprovado/current tier e snapshot.

2. **Corrigir Slack e notificações internas**
   - Alterar `post-acceptance-effects` para buscar os campos de tabela dinâmica e usar o valor aprovado resolvido.
   - Gravar em `notification_events.payload.value` e em `notifications_v2.message` o valor correto: R$ 2.392,80.
   - Preservar idempotência por estágio para não reenviar notificações antigas em massa.

3. **Corrigir envio ao ERP**
   - Alterar `notify-deal-won` para usar a mesma regra de valor aprovado.
   - Payload para ERP deve enviar `amount = 2392.80` quando houver tabela dinâmica vigente/aprovada.
   - Incluir campos auxiliares no payload, se aceitos pelo ERP, como `base_amount`, `approved_amount`, `amount_source`, `dynamic_pricing_snapshot`, sem remover campos existentes.

4. **Corrigir métricas que leem propostas aceitas diretamente**
   - Revisar hooks/views/RPCs que somam `proposals.total_amount` para propostas aceitas.
   - Priorizar valor aprovado dinâmico em dashboard/relatórios onde a fonte é proposta aceita.
   - Manter Forecast que usa `opportunities.valor_previsto`, mas garantir que sincronização da oportunidade use valor aprovado, não `total_amount`.

5. **Corrigir a bandeja lateral do CRM**
   - Categorizar `deal_won` como `proposals` ou `priority`, para aparecer claramente na bandeja e nos filtros relevantes.
   - Garantir badge/unread para venda ganha como alta prioridade.
   - Ajustar mensagem da CANON já existente no banco para mostrar R$ 2.392,80, sem criar avalanche de novas notificações.

6. **Reparar especificamente a CANON sem replay global**
   - Atualizar somente os registros da CANON em:
     - `notification_events.payload.value`
     - `notifications_v2.message`
     - notificações legadas relacionadas, se existirem
   - Reenviar somente o Slack da CANON com valor correto, evitando worker/backfill em lote.
   - Reenviar/sincronizar somente o ERP da CANON com `amount = 2392.80`, com idempotência/log claro para não duplicar cobrança se o ERP suportar atualização/upsert.

7. **Validação final**
   - Conferir no banco que CANON está com valor R$ 2.392,80 em oportunidade, evento, inbox e payload de ERP.
   - Conferir logs das duas funções (`post-acceptance-effects`, `notify-deal-won`).
   - Testar uma execução específica por `proposalId`, nunca worker em lote.

## Arquivos impactados

- `supabase/functions/post-acceptance-effects/index.ts`
- `supabase/functions/notify-deal-won/index.ts`
- Possível novo helper em `supabase/functions/_shared/approved-proposal-value.ts`
- `src/lib/notifications/normalizeInboxItems.ts`
- `src/services/supabase/proposals.ts`
- Hooks de dashboard/relatórios que ainda usam `proposals.total_amount` para receita aceita
- Migração/RPC se necessário para centralizar cálculo no banco e corrigir dados da CANON com segurança

## Riscos e mitigação

- **Risco de duplicar Slack/ERP:** só executar por `proposalId` da CANON e não usar worker global.
- **Risco de métrica divergente:** centralizar a regra e substituir leituras diretas de `total_amount`.
- **Risco de cobrança duplicada no ERP:** preferir upsert/atualização quando o endpoint suportar; se não houver garantia, registrar tentativa e sinalizar que é reenvio corretivo da mesma proposta.