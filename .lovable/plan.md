## Objetivo
Restaurar o CRM sem quebrar o que já foi corrigido: salvar proposta, visualização rápida/link público, autenticação e reconciliação de oportunidades reabertas/perdidas para parar de contar venda cancelada em forecast/dashboard/relatórios.

## Diagnóstico inicial
- O backend hospedado está respondendo, mas consultas de metadados/logs tiveram timeout intermitente, então a correção precisa ser conservadora e com validação por sinais reais.
- A migração de backfill pendente existe em `supabase/migrations/20260512184458_38d80755-0b30-4bfd-bd85-57b1d9d1c9e2.sql` e reprocessa todas as propostas não recorrentes chamando `orchestrate_proposal_financials`.
- O console enviado mostra erros de CORS/522 em chamadas diretas para Auth/REST. Isso tende a ser consequência de falha temporária de sessão/rede, mas o app também tem pontos que podem agravar o problema com refresh/signOut e chamadas de tracking.
- O save da proposta depende desta ordem: proposta -> itens -> termos de pagamento -> totais -> sync da oportunidade -> orquestração. Vou manter essa regra.
- A visualização rápida depende de gerar `public_token`, marcar proposta como `sent` quando não terminal e abrir `/proposta/<token>` via RPC `get_proposal_by_public_token`.

## Plano de implementação

### 1. Rodar o backfill de reconciliação com segurança
- Aplicar novamente a migração/backfill solicitada, mas de forma segura para produção:
  - Reconciliar propostas não recorrentes sem alterar lógica de recorrência.
  - Garantir que `payment_expected_amount` continue sendo o valor líquido com desconto manual.
  - Garantir que `opportunities.valor_previsto` receba o mesmo valor líquido aprovado/esperado.
- Validar especificamente casos recentes como MOTOPPAR/IFood/ONFLY/Agro Summit se os dados forem localizáveis por query.

### 2. Corrigir a venda cancelada que continua entrando em métricas
- Criar uma reconciliação de dados para oportunidades com status atual `lost` que ainda têm registros antigos como `won` em `win_loss_records`.
- Para oportunidades `open`, remover registro ativo de `win_loss_records` ligado ao fechamento revertido.
- Para oportunidades `lost`, converter/upsertar `win_loss_records.outcome = 'lost'` e limpar campos exclusivos de ganho.
- Preservar `closed_at` somente como data real do último fechamento atual; não restaurar fechamento antigo cancelado.

### 3. Estabilizar autenticação sem deslogar usuários por erro transitório
- Ajustar o fluxo para não fazer `signOut()` automático quando `refreshSession`/`get-current-user` falhar por erro transitório, 5xx, timeout, CORS/522 ou queda momentânea.
- Manter logout apenas quando o usuário explicitamente sair ou quando a sessão estiver comprovadamente ausente/inválida.
- Tornar o tracking `track-auth-event` ainda mais isolado: falha de audit não pode afetar login, refresh, save ou navegação.

### 4. Corrigir save de proposta e visualização rápida
- Revisar e ajustar os pontos de save para tratar sessão temporariamente indisponível sem bloquear indevidamente o salvamento quando a sessão local ainda existe.
- Garantir que erro de orquestração financeira continue não bloqueando o save quando a proposta principal, itens e termos foram salvos.
- Garantir que gerar link rápido só dependa do update mínimo em `proposals.public_token/status` e que falha apresente erro real em log/toast.
- Se a RPC pública estiver falhando, corrigir permissões/`SECURITY DEFINER`/`search_path`/resiliência da função sem abrir dados sensíveis.

### 5. Validação objetiva
- Testar por query os invariantes críticos:
  - propostas com desconto manual: `payment_expected_amount = total líquido`;
  - oportunidades perdidas não aparecem como ganhas em `win_loss_records`;
  - oportunidades abertas não mantêm fechamento ativo;
  - propostas públicas com token carregam via RPC.
- Validar no código que o editor não apaga itens/termos antes de falhar por sessão/transiente.
- Verificar logs de funções implicadas: `track-auth-event`, `get-current-user`, `post-acceptance-effects`, `generate-proposal-pdf` se necessário.

### 6. Análise forense após estabilizar
Entregar um relatório curto com:
- Causa raiz provável por área: valores, reabertura/perda, ERP, forecast/dashboard, autenticação, save de proposta e link público.
- Arquivos/funções envolvidos.
- Riscos restantes.
- Correções aplicadas.
- Próximos checks recomendados sem mexer em funcionalidades já estáveis.

## Arquivos/áreas impactadas esperadas
- `src/hooks/useCurrentUser.ts`
- `src/hooks/useSupabaseAuth.ts`
- `src/pages/ProposalEditor.tsx`
- `src/components/proposals/ProposalEditorHeader.tsx`
- `src/services/supabase/proposals.ts`
- `src/services/supabase/opportunities.ts`
- `supabase/functions/track-auth-event/index.ts`
- Migração SQL de reconciliação/backfill em `supabase/migrations/...`

## Riscos
- O backfill pode demorar se rodar em todas as propostas; vou limitar a lógica para ser idempotente e segura.
- Se houver instabilidade externa de Auth/REST, o app deve degradar sem derrubar a sessão, mas não dá para impedir falha de infraestrutura externa.
- Não vou alterar cálculos já corrigidos de desconto manual, ERP e comissão; só vou preservar e reconciliar as inconsistências atuais.