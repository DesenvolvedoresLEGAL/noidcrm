

# Corrigir Insights SDR: Missões, Conquistas, Ranking e Coach

## Problemas identificados

1. **Botão "Atualizar Análise" não funciona** - O botão chama `refetch()` do `useSalesCoach`, mas para contas sem dados, o coach data é null e o botão nem deveria aparecer (ou deveria funcionar corretamente).

2. **Coach mostra conteúdo irrelevante para conta sem dados** - AI Briefing mostra "ações prioritárias" e "propostas aguardando resposta" mesmo sem nenhum registro. O AI Sales Coach mostra pontos fortes/dicas mesmo sem dados.

3. **Missões SDR mostram missões de closer/manager/finance** - O `missions-engine` cria entradas para TODAS as missões ativas, ignorando a coluna `target_roles` que já existe na tabela `missions`. SDR vê "Validar Comissões" (finance), "Revisar Pipeline" (manager), "Proposta do Dia" (closer).

4. **Conquistas com barra de progresso parecendo cheia** - O componente `Progress` usa `bg-secondary` como cor da trilha. No tema atual, `secondary` tem cor similar ao `primary` (ambos azul), dando a impressão de barra completa quando está em 0%.

5. **Ranking exibe usuários excluídos** - Jaqueline, Leonardo, Jessica, Robério ainda estão com `active = true` na tabela `sellers` e aparecem em `organization_members`. O leaderboard filtra por `active = true` mas esses usuários não deveriam estar lá.

## Alterações

### 1. Migration SQL — Limpar dados de usuários excluídos
- Desativar sellers de Jaqueline Mota, Leonardo Honório, Jessica Machado, Robério Santos (`active = false`)
- Remover de `organization_members` os user_ids correspondentes
- Isso resolve o ranking automaticamente (já filtra por `active = true`)

### 2. `supabase/functions/missions-engine/index.ts` — Filtrar por `target_roles`
- Na função `ensureMissionEntries`, receber o `sellerRole` como parâmetro
- Buscar o role do seller (da tabela `sellers` ou `ote_seller_config`)
- Filtrar missões onde `target_roles` contém o role do seller
- Isso impede que SDRs vejam missões de finance/manager/owner

### 3. `src/components/insights/SalesInsightsView.tsx` — Coach adaptativo para SDR sem dados
- Quando `coachData` é null ou stats são todos zero, mostrar estado vazio com mensagem motivacional em vez de cards com dados falsos
- Esconder seções "Pontos Fortes", "Foco em Melhorar", "Dicas do Coach" quando não há dados reais
- Manter "Plano de Desenvolvimento" (que faz sentido mesmo sem dados)

### 4. `src/components/insights/AIBriefingCard.tsx` — Não mostrar ações quando não há dados
- Verificar se briefing tem dados reais antes de renderizar "Ações Prioritárias"
- Para SDR sem atividades, mostrar mensagem de boas-vindas/onboarding

### 5. `src/components/gamification/AchievementProgress.tsx` — Corrigir visual da barra
- Na `Progress` dentro de conquistas, usar classe customizada para a trilha (`bg-muted` em vez do default `bg-secondary`)
- Ou adicionar `className="h-1.5 [&>div]:bg-primary bg-muted"` para garantir contraste visual
- Quando `progress = 0`, não mostrar barra de progresso ou mostrar trilha vazia com cor neutra

### 6. `src/pages/Insights.tsx` — Botão Atualizar funcional
- O botão "Atualizar Análise" precisa invalidar as queries corretas e dar feedback visual

## Arquivos modificados
1. Migration SQL (desativar sellers excluídos, remover de organization_members)
2. `supabase/functions/missions-engine/index.ts` (filtrar por target_roles)
3. `src/components/insights/SalesInsightsView.tsx` (coach adaptativo sem dados)
4. `src/components/insights/AIBriefingCard.tsx` (estado vazio quando sem dados)
5. `src/components/gamification/AchievementProgress.tsx` (barra de progresso com contraste)
6. `src/pages/Insights.tsx` (botão atualizar funcional)

