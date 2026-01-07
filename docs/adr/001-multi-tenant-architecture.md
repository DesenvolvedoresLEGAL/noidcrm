# ADR-001: Arquitetura Multi-Tenant

## Status

Aceito

## Data

2024-01-15

## Contexto

O sistema precisa suportar múltiplas organizações (tenants) de forma isolada, garantindo:
- Isolamento completo de dados entre organizações
- Escalabilidade horizontal
- Custo operacional otimizado
- Simplicidade de manutenção

### Forças em Jogo
- **Segurança**: Vazamento de dados entre tenants é inaceitável
- **Custo**: Instâncias separadas por tenant são caras
- **Complexidade**: Schemas separados aumentam complexidade operacional
- **Performance**: Queries cross-tenant não são necessárias

## Decisão

> Nós decidimos usar **Single Database, Shared Schema com Row-Level Security (RLS)** porque oferece o melhor equilíbrio entre segurança, custo e complexidade operacional.

Cada tabela que contém dados de tenant possui uma coluna `organization_id` que:
1. É obrigatória (NOT NULL)
2. Tem RLS policies que filtram por `organization_id`
3. É indexada para performance

## Alternativas Consideradas

### Alternativa 1: Database por Tenant
- **Prós**: Isolamento total, backup/restore por tenant
- **Contras**: Custo alto, complexidade de migrations, conexões limitadas

### Alternativa 2: Schema por Tenant
- **Prós**: Bom isolamento, flexibilidade
- **Contras**: Complexidade de migrations, limite de schemas, overhead de conexões

### Alternativa 3: Shared Schema sem RLS (filtro na aplicação)
- **Prós**: Simples de implementar
- **Contras**: Risco de vazamento por bugs, não há garantia em nível de DB

## Consequências

### Positivas
- **Segurança garantida pelo banco**: RLS é enforced pelo PostgreSQL, impossível bypassar via aplicação
- **Custo otimizado**: Uma única instância serve todos os tenants
- **Migrations simples**: Uma migration atualiza todos os tenants
- **Escalabilidade**: Supabase/PostgreSQL escala bem até milhões de rows

### Negativas
- **Complexidade de RLS**: Policies precisam ser cuidadosamente escritas e testadas
- **Debugging mais difícil**: Logs incluem dados de múltiplos tenants
- **Backup por tenant**: Requer queries específicas, não é nativo

### Riscos
- **RLS Policy incorreta**: Mitigado por testes automatizados de segurança (P0)
- **Performance com muitos tenants**: Mitigado por índices em `organization_id`

## Implementação

```sql
-- Padrão para todas as tabelas com dados de tenant
CREATE TABLE public.exemplo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    -- ... outras colunas
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Índice obrigatório
CREATE INDEX idx_exemplo_org ON public.exemplo(organization_id);

-- RLS obrigatório
ALTER TABLE public.exemplo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant isolation" ON public.exemplo
    FOR ALL
    USING (organization_id IN (
        SELECT organization_id FROM user_organizations WHERE user_id = auth.uid()
    ));
```

## Referências

- [Supabase Multi-tenancy Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL RLS Documentation](https://www.postgresql.org/docs/current/ddl-rowsecurity.html)
