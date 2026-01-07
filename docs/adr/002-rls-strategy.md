# ADR-002: Estratégia de Row-Level Security (RLS)

## Status

Aceito

## Data

2024-01-20

## Contexto

Com a decisão de usar arquitetura multi-tenant com shared schema (ADR-001), precisamos definir uma estratégia consistente de RLS que:
- Seja segura por padrão
- Suporte hierarquia de visibilidade (Admin > Manager > User)
- Seja performática
- Seja fácil de manter e auditar

### Forças em Jogo
- **Hierarquia**: Gestores precisam ver dados de suas equipes
- **Performance**: Policies complexas podem degradar queries
- **Manutenibilidade**: Policies duplicadas são difíceis de manter
- **Segurança**: Funções SECURITY DEFINER devem ser usadas com cuidado

## Decisão

> Nós decidimos usar **funções helper SECURITY DEFINER** centralizadas para checar permissões, combinadas com policies declarativas simples.

### Padrão de Implementação

1. **Funções Helper** (SECURITY DEFINER, search_path fixo):
   - `has_role(user_id, role)`: Verifica se usuário tem role específico
   - `can_view_all(user_id)`: Verifica se pode ver todos os dados da org
   - `is_team_manager(user_id)`: Verifica se é gestor de equipe
   - `get_visible_user_ids(user_id)`: Retorna IDs visíveis para o usuário

2. **Policies Declarativas**: Usam as funções helper

## Alternativas Consideradas

### Alternativa 1: Policies Inline Complexas
- **Prós**: Sem dependência de funções
- **Contras**: Duplicação, difícil manutenção, risco de inconsistência

### Alternativa 2: Verificação apenas na aplicação
- **Prós**: Flexibilidade total
- **Contras**: Inseguro, bypass possível

### Alternativa 3: Views com SECURITY INVOKER
- **Prós**: Abstração limpa
- **Contras**: Performance ruim, complexidade

## Consequências

### Positivas
- **Centralização**: Lógica de permissão em um único lugar
- **Testabilidade**: Funções podem ser testadas isoladamente
- **Performance**: Funções compiladas são otimizadas pelo PostgreSQL
- **Auditabilidade**: Fácil revisar toda a lógica de acesso

### Negativas
- **Curva de aprendizado**: Devs precisam entender o padrão
- **SECURITY DEFINER**: Requer cuidado extra (search_path fixo)

### Riscos
- **Bug em função helper**: Afeta múltiplas tabelas. Mitigado por testes P0.
- **Recursão infinita**: Funções que consultam tabelas com RLS. Mitigado por SECURITY DEFINER.

## Implementação

```sql
-- Função helper para verificar role (sem recursão)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Função para visibilidade hierárquica
CREATE OR REPLACE FUNCTION public.get_visible_user_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE team_hierarchy AS (
    -- Usuário sempre vê a si mesmo
    SELECT _user_id AS user_id
    UNION
    -- Subordinados diretos e indiretos
    SELECT s.user_id
    FROM sellers s
    INNER JOIN team_hierarchy th ON s.manager_id = th.user_id
  )
  SELECT ARRAY_AGG(user_id) FROM team_hierarchy
$$;

-- Policy usando função helper
CREATE POLICY "Visibilidade hierárquica" ON public.opportunities
    FOR SELECT
    USING (
        owner_user_id = ANY(public.get_visible_user_ids(auth.uid()))
        OR public.can_view_all(auth.uid())
    );
```

## Matriz de Visibilidade

| Role | Próprios Dados | Equipe | Toda Org |
|------|----------------|--------|----------|
| user | ✅ | ❌ | ❌ |
| manager | ✅ | ✅ | ❌ |
| admin | ✅ | ✅ | ✅ |
| owner | ✅ | ✅ | ✅ |

## Referências

- [ADR-001: Arquitetura Multi-Tenant](001-multi-tenant-architecture.md)
- [PostgreSQL SECURITY DEFINER](https://www.postgresql.org/docs/current/sql-createfunction.html)
- Testes de segurança: `src/test/security/`
