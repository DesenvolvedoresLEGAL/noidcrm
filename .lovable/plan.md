
Objetivo: garantir que, quando uma proposta for aprovada, aconteçam sempre 3 coisas para toda a empresa: notificação interna, modal de celebração e aviso no Slack.

1. Unificar o fluxo de efeitos pós-aprovação
- Hoje a lógica está duplicada em `generate-acceptance-proof` e `post-acceptance-effects`.
- Vou concentrar notificações, celebração e Slack em um único fluxo backend, chamado sempre após a aprovação.
- Isso evita o cenário “aprovou, mas uma parte disparou e outra não”.

2. Fazer a celebração ir para todos os usuários ativos da empresa
- Hoje a entrega depende da configuração `celebration_recipients` e de perfis específicos.
- Vou alterar a distribuição para criar notificação para todos os usuários ativos em `organization_members` da organização da proposta.
- O vendedor continua recebendo o contexto especial dele, mas todos os demais também recebem a celebração.

3. Corrigir o payload da notificação/celebração
- Vou enriquecer `metadata` com:
  - `seller_name`
  - `account_name`
  - `value`
  - `opportunity_id`
  - `proposal_id`
  - `acceptor_name`
- O modal passará a exibir exatamente:
  - nome do vendedor
  - nome do cliente
  - valor fechado

4. Ajustar o modal visual
- Atualizar `DealWonCelebrationModal` para mostrar os campos pedidos no card principal.
- Manter o CTA para abrir a oportunidade.
- Garantir que o modal use os novos dados sem depender de textos genéricos.

5. Corrigir o comportamento de notificação em tempo real
- Revisar o caminho entre inserção em `notifications` e consumo no `CelebrationProvider`.
- Garantir que todas as notificações criadas para aprovação tenham `show_celebration: true` e tipo compatível com o listener atual.
- Se necessário, padronizar o tipo para evitar casos em que chega na central mas não abre o modal.

6. Corrigir o Slack de forma confiável
- Remover o falso positivo atual de sucesso (`slack_sent: true` fixo).
- Fazer o backend retornar status real do envio.
- Padronizar a mensagem com:
  - cliente
  - proposta
  - valor
  - vendedor
- Assim fica visível quando falhou de verdade e não “parece que foi”.

7. Blindar contra duplicidade sem perder eventos
- Manter idempotência por `proposal_id`, mas sem bloquear o fan-out correto para todos os usuários.
- A checagem anti-duplicação ficará no evento da proposta aprovada, não por usuário individual.

8. Ajustar a configuração de celebrações
- Como você pediu que apareça para todos da empresa, vou tratar aprovação de proposta como celebração organizacional.
- Posso manter a tela de configurações apenas para som/animação, sem limitar quem recebe esse evento específico.

Arquivos impactados
- `supabase/functions/post-acceptance-effects/index.ts`
- `supabase/functions/generate-acceptance-proof/index.ts`
- `src/components/notifications/DealWonCelebrationModal.tsx`
- `src/components/CelebrationProvider.tsx`
- possivelmente `src/pages/settings/system/sections/CelebracoesSection.tsx` para alinhar a regra nova

Resultado esperado
- Cliente aprova proposta
- Slack recebe aviso
- Todos os usuários ativos da empresa recebem notificação
- Todos veem o modal de celebração em tempo real
- O modal mostra vendedor, cliente e valor fechado corretamente
