# ADR-004: Hierarquia de Visibilidade de Dados

## Status

Aceito

## Data

2024-02-10

## Contexto

Em um CRM multi-tenant, diferentes usuários precisam ver diferentes conjuntos de dados:
- Vendedores veem apenas seus próprios dados
- Gestores veem dados de suas equipes
- Administradores veem todos os dados da organização

### Forças em Jogo
- **Privacidade**: Vendedores não devem ver dados de colegas
- **Gestão**: Managers precisam acompanhar suas equipes
- **Reporting**: Admins precisam de visão completa
- **Performance**: Hierarquias profundas podem ser lentas
- **Flexibilidade**: Estruturas de equipe variam por empresa

## Decisão

> Nós decidimos implementar **visibilidade hierárquica baseada em manager_id** com **funções RPC otimizadas** e **hook React centralizado**.

### Componentes

1. **Tabela sellers**: Contém `manager_id` para hierarquia
2. **Funções RPC**: `get_visible_user_ids`, `can_view_all`, `is_team_manager`
3. **Hook useTeamVisibility**: Abstrai lógica no frontend

## Alternativas Consideradas

### Alternativa 1: Grupos/Times Explícitos
- **Prós**: Flexibilidade total, múltiplos times
- **Contras**: Complexidade de manutenção, UI adicional

### Alternativa 2: Apenas por Role
- **Prós**: Simples
- **Contras**: Não suporta hierarquia, muito binário

### Alternativa 3: ACLs por Registro
- **Prós**: Controle granular
- **Contras**: Explosão de dados, performance ruim

## Consequências

### Positivas
- **Intuitivo**: Hierarquia reflete estrutura organizacional real
- **Automático**: Subordinados herdam visibilidade do gestor
- **Performático**: CTEs recursivas são otimizadas pelo PostgreSQL
- **Centralizado**: Um hook para todo o frontend

### Negativas
- **Hierarquia única**: Um vendedor só pode ter um gestor direto
- **Reorganizações**: Mudanças de estrutura requerem update de manager_id

### Riscos
- **Ciclos na hierarquia**: Prevenido por constraint/trigger
- **Hierarquia muito profunda**: Limite de recursão (padrão 100 níveis)

## Implementação

### Backend (RPC)

```sql
-- Retorna todos os user_ids visíveis para um usuário
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE team_hierarchy AS (
    -- Base: o próprio usuário
    SELECT user_id FROM sellers WHERE user_id = _user_id
    UNION ALL
    -- Recursão: subordinados diretos
    SELECT s.user_id
    FROM sellers s
    INNER JOIN team_hierarchy th ON s.manager_id = th.user_id
  )
  SELECT COALESCE(ARRAY_AGG(user_id), ARRAY[_user_id])
  FROM team_hierarchy
$$;
```

### Frontend (Hook)

```typescript
// src/hooks/useTeamVisibility.ts
export function useTeamVisibility(): TeamVisibility {
  const { user } = useAuth();
  
  // Determina visibilidade baseada em role e hierarquia
  const canViewAll = hasRole('admin') || hasRole('owner');
  const isTeamManager = await checkIsTeamManager(user.id);
  const visibleUserIds = await getVisibleUserIds(user.id);
  
  return {
    canViewAll,
    isTeamManager,
    visibleUserIds,
    applyVisibilityFilter: (query) => {
      if (canViewAll) return query;
      return query.in('owner_user_id', visibleUserIds);
    },
  };
}
```

### Uso em Componentes

```typescript
function OpportunitiesList() {
  const { applyVisibilityFilter, loading } = useTeamVisibility();
  
  const { data } = useQuery({
    queryKey: ['opportunities'],
    queryFn: async () => {
      let query = supabase.from('opportunities').select('*');
      query = applyVisibilityFilter(query);
      return query;
    },
    enabled: !loading,
  });
}
```

## Matriz de Visibilidade

| Situação | Dados Visíveis |
|----------|----------------|
| Vendedor sem equipe | Apenas próprios |
| Gestor com equipe | Próprios + subordinados |
| Admin/Owner | Toda organização |
| Vendedor em equipe | Apenas próprios (não vê colegas) |

## Referências

- [ADR-002: Estratégia de RLS](002-rls-strategy.md)
- Hook: `src/hooks/useTeamVisibility.ts`
- Testes: `src/test/security/useTeamVisibility.security.test.tsx`
