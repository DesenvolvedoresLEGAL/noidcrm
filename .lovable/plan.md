
Objetivo: corrigir de vez o payload da venda aprovada para que Slack + notificação + modal usem os dados reais da proposta aceita, em vez dos fallbacks genéricos “Cliente” e “Equipe”.

1. Diagnóstico confirmado
- O problema está em `supabase/functions/post-acceptance-effects/index.ts`.
- Hoje a função busca a oportunidade assim:
  - lê a proposta sem `opportunity_id`
  - tenta descobrir a oportunidade via `proposal_items.opportunity_id`
- Esse caminho é frágil e pode voltar vazio/null.
- Quando isso acontece, o código cai nestes fallbacks:
  - `accountName = "Cliente"`
  - `sellerName = "Equipe"`
- Isso explica exatamente o Slack do print e também o modal de celebração, porque ambos usam os mesmos metadados gerados nessa função.

2. Correção principal
- Parar de inferir a oportunidade pelos itens.
- Usar a relação correta e nativa da própria proposta:
  - incluir `opportunity_id` e `client_name` no select da proposta
  - carregar a oportunidade diretamente por `proposal.opportunity_id`
- A partir daí montar os nomes com prioridade correta:
  - Cliente:
    1. `accounts.nome_fantasia`
    2. `accounts.razao_social`
    3. `proposal.client_name`
    4. `"Cliente"`
  - Vendedor:
    1. `profiles.full_name` do `opportunity.owner_user_id`
    2. fallback secundário coerente
    3. `"Equipe"` só como último recurso real

3. Endurecimento do payload
- Centralizar a montagem dos dados exibidos no Slack/notificação/modal em uma única rotina dentro de `post-acceptance-effects`.
- Essa rotina deve retornar sempre:
  - `account_name`
  - `seller_name`
  - `acceptor_name`
  - `primary_color`
  - `opportunity_id`
  - `value`
- Assim Slack e celebração passam a consumir exatamente a mesma fonte de verdade, sem divergência.

4. Ajuste específico de negócio
- Manter a prioridade do cliente por `nome_fantasia`, como já decidido para Slack.
- Manter o vendedor vindo de `profiles.full_name`.
- Importante: o vendedor deve ser lido da oportunidade vinculada à proposta aceita, não de oportunidades duplicadas em funis operacionais.

5. Correção retroativa do caso BaseLinker
- Reprocessar a proposta aprovada da BaseLinker com o payload corrigido.
- Como o post antigo do Slack já saiu errado, o caminho mais seguro é:
  - gerar uma nova notificação interna correta
  - disparar uma nova mensagem correta no Slack para esse fechamento
- Se o sistema não armazena `channel + ts` da mensagem anterior, não vale tentar “editar” o post antigo; melhor publicar a correção certa.

6. Arquivos impactados
- `supabase/functions/post-acceptance-effects/index.ts`
  - corrigir lookup da oportunidade
  - corrigir resolução de cliente/vendedor
  - unificar payload para Slack + notificações
- Possivelmente nenhum outro arquivo precisa mudar, porque o modal já renderiza `metadata.account_name` e `metadata.seller_name` corretamente; o problema está na origem dos dados.

7. Validação
- Testar uma proposta aceita normal
- Testar o caso BaseLinker reprocessado
- Confirmar nos 3 pontos:
  - Slack mostra “Base Linker” e “Vagner Sansevero”
  - notificação no sistema carrega os mesmos nomes
  - modal de celebração mostra os mesmos nomes
- Verificar também que, se faltar conta ou vendedor, os fallbacks só entram no fim da cadeia.

Seção técnica
```text
proposta aceita
   │
   ▼
post-acceptance-effects
   │
   ├─ lê proposals.opportunity_id
   ├─ busca opportunities.owner_user_id + account_id
   ├─ busca profiles.full_name
   ├─ busca accounts.nome_fantasia / razao_social
   └─ monta payload único
           │
           ├─ notifications.metadata
           ├─ modal de celebração
           └─ Slack blocks/text
```

Resultado esperado
- Some o “Cliente / Equipe” genérico do Slack e da celebração
- BaseLinker passa a aparecer como cliente
- Vagner Sansevero passa a aparecer como vendedor
- O mesmo bug deixa de acontecer em qualquer nova aprovação
