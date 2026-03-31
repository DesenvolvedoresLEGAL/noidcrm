

# Liberar Scoring Org-Wide para Todos os Roles (incluindo SDR)

## Problema
Os hooks de scoring (`useLeadScoreAnalytics` e `useOpportunityScoreAnalytics`) usam `useDataVisibility` para filtrar por `owner_user_id` quando o usuário não é admin/manager. Isso faz o SDR ver apenas seus próprios leads/oportunidades no painel de Scoring, quando deveria ver tudo da organização.

O Win/Loss Hub já é org-wide (não usa `useDataVisibility`), então não precisa de ajuste.

## Alterações

### 1. `src/hooks/useLeadScoreAnalytics.ts`
- Remover o import e uso de `useDataVisibility`
- Remover o filtro `if (!canViewAll) query.eq('owner_user_id', currentUserId)`
- Manter apenas o filtro por `organization_id` (todos veem todos os leads da org)

### 2. `src/hooks/useOpportunityScoreAnalytics.ts`
- Mesmo ajuste: remover `useDataVisibility` e o filtro por `owner_user_id`
- Todos os usuários autenticados da organização veem o scoring completo

## Justificativa
- Scoring é uma ferramenta de **inteligência/análise**, não de gestão de pipeline pessoal
- O SDR precisa ver contas geladas para prospectar (Hunter)
- Win/Loss já funciona assim — scoring deve seguir o mesmo padrão
- A segurança continua garantida pelo filtro `organization_id` (multi-tenant isolado via RLS)

## Arquivos modificados
1. `src/hooks/useLeadScoreAnalytics.ts`
2. `src/hooks/useOpportunityScoreAnalytics.ts`

