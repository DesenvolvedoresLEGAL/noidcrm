

# Corrigir Relatório OTE: Filtrar Usuários Inativos e Resolver Gestor Correto

## Problema
1. Jaqueline, Leonardo Honório e Jessica Machado foram excluídos da empresa mas continuam aparecendo no relatório OTE (seus registros em `ote_seller_config` ainda existem com `end_date = null`, e resultados antigos em `ote_monthly_results` permanecem).
2. Robério Santos aparece como gestor, mas o gestor configurado em Configurações > Equipe é Leandro Andre.

## Alterações

### 1. Edge Function `calculate-ote/index.ts`
- Após buscar `sellerConfigs`, cruzar com `organization_members` (ou `profiles`) para filtrar apenas usuários **ativos** na organização.
- Remover configs de usuários que não existem mais como membros ativos.
- Para gestores de time (`is_team_target`), já usa `teams.manager_id` corretamente — o problema é que Robério tem um `ote_seller_config` ativo com nível gerencial. Precisamos garantir que o cálculo use o manager real da tabela `teams`.

### 2. Hook `useOTEMonthlyResults` em `src/hooks/useOTEData.ts`
- Ao buscar profiles, filtrar resultados cujo `profile` não existe (usuário deletado) — ou seja, não exibir no relatório resultados de usuários sem profile ativo.

### 3. Limpeza de dados (migration SQL)
- Fechar (`end_date = today`) os registros em `ote_seller_config` dos 3 usuários removidos (Jaqueline, Leonardo Honório, Jessica Machado).
- Fechar o config do Robério se ele não é mais gestor.
- Deletar os `ote_monthly_results` do período atual para esses usuários (serão recalculados corretamente ao clicar "Calcular").

### 4. Proteção futura na edge function
- Adicionar validação: buscar lista de `user_id` ativos em `organization_members` e filtrar `sellerConfigs` para incluir apenas esses.

## Arquivos modificados
1. Migration SQL (limpeza de dados)
2. `supabase/functions/calculate-ote/index.ts` (filtrar por membros ativos)
3. `src/hooks/useOTEData.ts` (filtrar resultados sem profile no relatório)

